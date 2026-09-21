import { Cause, Effect, Exit, Latch, Stream } from "effect"
import * as DateTime from "effect/DateTime"
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { MessageID, PartID, type SessionID } from "../schema"
import { Shell } from "@opencode-ai/core/shell"
import { ShellID } from "@/tool/shell/id"
import { NamedError } from "@opencode-ai/core/util/error"
import { SessionEvent } from "@opencode-ai/core/session/event"
import { SessionMessage } from "@opencode-ai/core/session/message"
import { InstanceState } from "@/effect/instance-state"
import { CommandTimeout } from "@/foxcode/command-timeout"
import { ulid } from "ulid"
import { Session } from "../session"
import type { Agent } from "../../agent/agent"
import type { EventV2 } from "@opencode-ai/core/event"
import type { RuntimeFlags } from "@/effect/runtime-flags"
import type { SessionRevert } from "../revert"
import type { Config } from "@/config/config"
import type { Plugin } from "../../plugin"
import type { SessionRunState } from "../run-state"
import type { ModelV2 } from "@opencode-ai/core/model"
import type { ProviderV2 } from "@opencode-ai/core/provider"
import type { ShellInput } from "./schema"

export interface ShellContext {
  sessions: Session.Interface
  agents: Agent.Interface
  events: EventV2.Interface
  flags: typeof RuntimeFlags.Service.Service
  revert: SessionRevert.Interface
  config: Config.Interface
  plugin: Plugin.Interface
  spawner: typeof ChildProcessSpawner.ChildProcessSpawner.Service
  state: SessionRunState.Interface
  goals: { pause: (sessionID: SessionID) => Effect.Effect<void> }
  currentModel: (sessionID: SessionID) => Effect.Effect<{ providerID: ProviderV2.ID; modelID: ModelV2.ID }>
  lastAssistant: (sessionID: SessionID) => Effect.Effect<SessionV1.WithParts, unknown, never>
}

export function makeShellRunner(ctx: ShellContext) {
  const {
    sessions,
    agents,
    events,
    flags,
    revert,
    config,
    plugin,
    spawner,
    state,
    goals,
    currentModel,
    lastAssistant,
  } = ctx

  const shellImpl = Effect.fn("SessionPrompt.shellImpl")(function* (input: ShellInput, ready?: Latch.Latch) {
    return yield* Effect.uninterruptibleMask((restore) =>
      Effect.gen(function* () {
        const markReady = ready ? ready.open.pipe(Effect.asVoid) : Effect.void
        const { msg, part, cwd } = yield* Effect.gen(function* () {
          yield* goals.pause(input.sessionID)
          const instanceCtx = yield* InstanceState.context
          const session = yield* sessions.get(input.sessionID).pipe(Effect.orDie)
          if (session.revert) {
            yield* revert.cleanup(session)
          }
          const agent = yield* agents.get(input.agent)
          if (!agent) {
            const available = (yield* agents.list()).filter((a) => !a.hidden).map((a) => a.name)
            const hint = available.length ? ` Available agents: ${available.join(", ")}` : ""
            const error = new NamedError.Unknown({ message: `Agent not found: "${input.agent}".${hint}` })
            yield* events.publish(Session.Event.Error, { sessionID: input.sessionID, error: error.toObject() })
            throw error
          }
          const model = input.model ?? agent.model ?? (yield* currentModel(input.sessionID))
          const userMsg: SessionV1.User = {
            id: input.messageID ?? MessageID.ascending(),
            sessionID: input.sessionID,
            time: { created: Date.now() },
            role: "user",
            agent: input.agent,
            model: { providerID: model.providerID, modelID: model.modelID },
          }
          yield* sessions.updateMessage(userMsg)
          const userPart: SessionV1.Part = {
            type: "text",
            id: PartID.ascending(),
            messageID: userMsg.id,
            sessionID: input.sessionID,
            text: "The following tool was executed by the user",
            synthetic: true,
          }
          yield* sessions.updatePart(userPart)

          const msg: SessionV1.Assistant = {
            id: MessageID.ascending(),
            sessionID: input.sessionID,
            parentID: userMsg.id,
            mode: input.agent,
            agent: input.agent,
            cost: 0,
            path: { cwd: instanceCtx.directory, root: instanceCtx.worktree },
            time: { created: Date.now() },
            role: "assistant",
            tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            modelID: model.modelID,
            providerID: model.providerID,
          }
          yield* sessions.updateMessage(msg)
          const callID = ulid()
          const started = Date.now()
          const part: SessionV1.ToolPart = {
            type: "tool",
            id: PartID.ascending(),
            messageID: msg.id,
            sessionID: input.sessionID,
            tool: ShellID.ToolID,
            callID,
            state: {
              status: "running",
              time: { start: started },
              input: { command: input.command },
            },
          }
          yield* sessions.updatePart(part)
          if (flags.experimentalEventSystem) {
            yield* events.publish(SessionEvent.Shell.Started, {
              sessionID: input.sessionID,
              messageID: SessionMessage.ID.create(),
              timestamp: DateTime.makeUnsafe(started),
              callID: part.callID,
              command: input.command,
            })
          }
          return { msg, part, cwd: instanceCtx.directory }
        }).pipe(Effect.ensuring(markReady))

        const cfg = yield* config.get()
        const sh = Shell.preferred(cfg.shell)
        const args = Shell.args(sh, input.command, cwd)
        let output = ""
        let aborted = false
        let timeout: string | undefined
        const finish = Effect.uninterruptible(
          Effect.gen(function* () {
            if (aborted) {
              output += "\n\n" + ["<metadata>", "User aborted the command", "</metadata>"].join("\n")
            }
            if (timeout) output += "\n\n" + ["<metadata>", timeout, "</metadata>"].join("\n")
            const completed = Date.now()
            if (flags.experimentalEventSystem) {
              yield* events.publish(SessionEvent.Shell.Ended, {
                sessionID: input.sessionID,
                timestamp: DateTime.makeUnsafe(completed),
                callID: part.callID,
                output,
              })
            }
            if (!msg.time.completed) {
              msg.time.completed = completed
              yield* sessions.updateMessage(msg)
            }
            if (part.state.status === "running") {
              part.state = {
                status: "completed",
                time: { ...part.state.time, end: completed },
                input: part.state.input,
                title: "",
                metadata: { output },
                output,
              }
              yield* sessions.updatePart(part)
            }
          }),
        )

        const exit = yield* restore(
          Effect.gen(function* () {
            const shellEnv = yield* plugin.trigger(
              "shell.env",
              { cwd, sessionID: input.sessionID, callID: part.callID },
              { env: {} },
            )
            const cmd = ChildProcess.make(sh, args, {
              cwd,
              extendEnv: true,
              env: { ...shellEnv.env, TERM: "dumb" },
              stdin: "ignore",
              forceKillAfter: "3 seconds",
            })
            const handle = yield* spawner.spawn(cmd)
            timeout = yield* CommandTimeout.drain(
              handle,
              Stream.runForEach(Stream.decodeText(handle.all), (chunk) =>
                Effect.gen(function* () {
                  output += chunk
                  if (part.state.status === "running") {
                    part.state.metadata = { output }
                    yield* sessions.updatePart(part)
                  }
                }),
              ),
              "shell command terminated",
            )
          }).pipe(Effect.scoped, Effect.orDie),
        ).pipe(Effect.exit)

        if (Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause) && !Cause.hasDies(exit.cause)) {
          aborted = true
        }
        yield* finish

        if (Exit.isFailure(exit) && !aborted && !Cause.hasInterruptsOnly(exit.cause)) {
          return yield* Effect.failCause(exit.cause)
        }

        return { info: msg, parts: [part] } satisfies SessionV1.WithParts
      }),
    )
  })

  const shell: (input: ShellInput) => Effect.Effect<SessionV1.WithParts, Session.BusyError> = Effect.fn(
    "SessionPrompt.shell",
  )(function* (input: ShellInput) {
    const ready = yield* Latch.make()
    return yield* state.startShell(
      input.sessionID,
      lastAssistant(input.sessionID).pipe(Effect.orDie),
      shellImpl(input, ready).pipe(Effect.orDie) as Effect.Effect<SessionV1.WithParts>,
      ready,
    )
  })

  return { shellImpl, shell }
}
