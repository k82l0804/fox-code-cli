import { Effect } from "effect"
import { fileURLToPath } from "url"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { NamedError } from "@opencode-ai/core/util/error"
import { BUILTIN_COMMANDS } from "@/foxcode/session/builtin-commands"
import { ConfigMarkdown } from "@/config/markdown"
import { Shell } from "@opencode-ai/core/shell"
import { CommandTimeout } from "@/foxcode/command-timeout"
import { ChildProcessSpawner } from "effect/unstable/process"
import { Provider } from "@/provider/provider"
import * as FoxWorkflowVariant from "@/foxcode/session/workflow-variant"
import { FoxSessionProcessor } from "@/foxcode/session/processor"
import { SKILL_SHELL_DISABLED, SKILL_SHELL_UNTRUSTED } from "@/foxcode/skills/display"
import { Session } from "../session"
import { Command } from "../../command"
import { bashRegex, interpolateCommandTemplate, parseCommandArgs, type CommandInput } from "./command"
import type { PromptInput } from "./schema"
import type { FoxSessionControl } from "@/foxcode/session/control"
import type { Agent } from "../../agent/agent"
import type { Config } from "@/config/config"
import type { Plugin } from "../../plugin"
import type { EventV2 } from "@opencode-ai/core/event"
import type { RuntimeFlags } from "@/effect/runtime-flags"
import type { ProviderV2 } from "@opencode-ai/core/provider"
import type { ModelV2 } from "@opencode-ai/core/model"
import type { SessionID } from "../schema"

import type { Image } from "@/image/image"

export interface CommandRunnerContext {
  goals: {
    command: (input: CommandInput) => Effect.Effect<SessionV1.WithParts, Error>
    pause: (sessionID: SessionID) => Effect.Effect<void>
  }
  control: Effect.Success<typeof FoxSessionControl.make>
  commands: Command.Interface
  events: EventV2.Interface
  agents: Agent.Interface
  config: Config.Interface
  spawner: typeof ChildProcessSpawner.ChildProcessSpawner.Service
  flags: typeof RuntimeFlags.Service.Service
  plugin: Plugin.Interface
  currentModel: (sessionID: SessionID) => Effect.Effect<{ providerID: ProviderV2.ID; modelID: ModelV2.ID }>
  getModel: (providerID: ProviderV2.ID, modelID: ModelV2.ID, sessionID: SessionID) => Effect.Effect<Provider.Model>
  resolvePromptParts: (template: string) => Effect.Effect<PromptInput["parts"]>
  prompt: (input: PromptInput, ticket: FoxSessionControl.Ticket) => Effect.Effect<SessionV1.WithParts, Image.Error>
}

export function makeCommandRunner(ctx: CommandRunnerContext) {
  const {
    goals,
    control,
    commands,
    events,
    agents,
    config,
    spawner,
    flags,
    plugin,
    currentModel,
    getModel,
    resolvePromptParts,
    prompt,
  } = ctx

  const command: (input: CommandInput) => Effect.Effect<SessionV1.WithParts, Image.Error | Error> = Effect.fn(
    "SessionPrompt.command",
  )(function* (input: CommandInput) {
    if (input.command === "goal") return yield* goals.command(input)
    const ticket = yield* control.begin(input.sessionID, false)
    yield* Effect.logInfo("command", {
      "session.id": input.sessionID,
      command: input.command,
      agent: input.agent,
    })
    const cmd = yield* commands.get(input.command)
    if (!cmd) {
      const available = (yield* commands.list()).map((c) => c.name)
      available.push(...BUILTIN_COMMANDS)
      available.sort()
      const hint = available.length ? ` Available commands: ${available.join(", ")}` : ""
      const error = new NamedError.Unknown({ message: `Command not found: "${input.command}".${hint}` })
      yield* events.publish(
        Session.Event.Error,
        { sessionID: input.sessionID, error: error.toObject() },
        { metadata: { phase: "admission" } },
      )
      throw error
    }
    if (!ticket.current()) return yield* Effect.interrupt
    yield* goals.pause(input.sessionID)
    const agentName = cmd.agent ?? input.agent
    const raw = parseCommandArgs(input.arguments)
    const args = raw
    const templateCommand = yield* Effect.promise(async () => cmd.template)
    let template = interpolateCommandTemplate(templateCommand, args, input.arguments)

    const shellMatches = ConfigMarkdown.shell(template)
    // mirroring the skill tool's gate (the slash-command path is user-initiated, so it is not prompted).
    const skillTemplate = cmd.source === "skill"
    const skillShellBlocked = skillTemplate && (cmd.trusted !== true || flags.disableSkillShell)
    if (shellMatches.length > 0 && skillShellBlocked) {
      const note = cmd.trusted !== true ? SKILL_SHELL_UNTRUSTED : SKILL_SHELL_DISABLED
      template = template.replace(bashRegex, () => note)
    } else if (shellMatches.length > 0) {
      const cfg = yield* config.get()
      const sh = Shell.preferred(cfg.shell)
      const results = yield* CommandTimeout.texts(
        shellMatches.map(([, cmd]) => cmd),
        sh,
      ).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner))
      let index = 0
      template = template.replace(bashRegex, () => results[index++])
    }
    template = template.trim()

    const taskModel = yield* Effect.gen(function* () {
      if (cmd.model) return Provider.parseModel(cmd.model)
      if (cmd.agent) {
        const cmdAgent = yield* agents.get(cmd.agent)
        if (cmdAgent?.model) return cmdAgent.model
      }
      if (input.model) return Provider.parseModel(input.model)
      return yield* currentModel(input.sessionID)
    })

    const task = yield* getModel(taskModel.providerID, taskModel.modelID, input.sessionID)
    const agent = agentName ? yield* agents.get(agentName) : yield* agents.defaultInfo()
    if (!agent) {
      const available = (yield* agents.list()).filter((a) => !a.hidden).map((a) => a.name)
      const hint = available.length ? ` Available agents: ${available.join(", ")}` : ""
      const error = new NamedError.Unknown({ message: `Agent not found: "${agentName}".${hint}` })
      yield* events.publish(Session.Event.Error, { sessionID: input.sessionID, error: error.toObject() })
      throw error
    }
    const variant = FoxWorkflowVariant.resolve({
      command: cmd,
      agent,
      model: taskModel,
      selected: task,
      input: input.variant,
    })
    const templateParts = yield* resolvePromptParts(template)
    FoxSessionProcessor.markReviewTelemetry(templateParts, input.command)
    const inputFiles = new Set(
      input.parts?.filter((part) => new URL(part.url).protocol === "file:").map((part) => fileURLToPath(part.url)),
    )
    const uniqueTemplateParts = templateParts.filter(
      (part) => part.type !== "file" || !inputFiles.has(fileURLToPath(part.url)),
    )
    const isSubtask = (agent.mode === "subagent" && cmd.subtask !== false) || cmd.subtask === true
    const parts = isSubtask
      ? [
          {
            type: "subtask" as const,
            agent: agent.name,
            description: cmd.description ?? "",
            command: input.command,
            model: { providerID: taskModel.providerID, modelID: taskModel.modelID },
            variant,
            prompt: templateParts.find((y) => y.type === "text")?.text ?? "",
          },
        ]
      : [...uniqueTemplateParts, ...(input.parts ?? [])]

    const userAgent = isSubtask ? (input.agent ?? (yield* agents.defaultInfo()).name) : agent.name
    const userModel = isSubtask
      ? input.model
        ? Provider.parseModel(input.model)
        : yield* currentModel(input.sessionID)
      : taskModel

    yield* plugin.trigger(
      "command.execute.before",
      { command: input.command, sessionID: input.sessionID, arguments: input.arguments },
      { parts },
    )

    const result = yield* prompt(
      {
        sessionID: input.sessionID,
        messageID: input.messageID,
        model: userModel,
        agent: userAgent,
        parts,
        variant: isSubtask ? input.variant : variant,
        snapshotInitialization: input.snapshotInitialization,
      },
      yield* control.begin(input.sessionID, true, ticket),
    )
    yield* events.publish(Command.Event.Executed, {
      name: input.command,
      sessionID: input.sessionID,
      arguments: input.arguments,
      messageID: result.info.id,
    })
    return result
  })

  return { command }
}
