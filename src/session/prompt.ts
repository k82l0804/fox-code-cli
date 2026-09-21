import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { PermissionV1 } from "@opencode-ai/core/v1/permission"
import path from "path"
import fs from "node:fs"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import os from "os"
import { FoxSessionPrompt } from "@/foxcode/session/prompt"
import { BoardContext } from "@/foxcode/board/context"
import { SKILL_SHELL_DISABLED, SKILL_SHELL_UNTRUSTED } from "@/foxcode/skills/display"
import { FoxSessionMessageOrder } from "@/foxcode/session/message-order"
import { FoxSessionPromptQueue } from "@/foxcode/session/prompt-queue"
import { FoxSession } from "@/foxcode/session"
import { FoxSessionTitle } from "@/foxcode/session/title"
import { SessionTranscript } from "@/foxcode/session/transcript"
import { FoxCostPropagation } from "@/foxcode/session/cost-propagation"
import { FoxSessionProcessor } from "@/foxcode/session/processor"
import * as FoxWorkflowVariant from "@/foxcode/session/workflow-variant"
import { FoxSessionOverflow } from "@/foxcode/session/overflow"
import { FoxReference } from "@/foxcode/reference/contains"
import { FoxReadObject } from "@/foxcode/tool/read-object"
import { isInterrupted } from "@/foxcode/effect/cause"
import * as SandboxPolicy from "@/foxcode/sandbox/policy"
import { CommandTimeout } from "@/foxcode/command-timeout"
import { Suggestion } from "@/foxcode/suggestion"
import { Question } from "@/question"
import { BUILTIN_COMMANDS } from "@/foxcode/session/builtin-commands"
import { zod } from "@opencode-ai/core/effect-zod"
import { withStatics } from "@opencode-ai/core/schema"
import { SessionID, MessageID, PartID } from "./schema"
import type { NotFoundError } from "@/storage/storage"
import { MessageV2 } from "./message-v2"
import { SessionRevert } from "./revert"
import { Session } from "./session"
import { Agent } from "../agent/agent"
import { Provider } from "@/provider/provider"

import { type Tool as AITool, tool, jsonSchema } from "ai"
import type { JSONSchema7 } from "@ai-sdk/provider"
import { SessionCompaction } from "./compaction"
import { SystemPrompt } from "./system"
import { Instruction } from "./instruction"
import { Plugin } from "../plugin"
import { MAX_STEPS_PROMPT } from "@opencode-ai/core/session/runner/max-steps"
import { ToolRegistry } from "@/tool/registry"
import { MCP } from "../mcp"
import { LSP } from "@/lsp/lsp"
import { ulid } from "ulid"
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import * as Stream from "effect/Stream"
import { Command } from "../command"
import { pathToFileURL, fileURLToPath } from "url"
import { Config } from "@/config/config"
import { ConfigMarkdown } from "@/config/markdown"
import { SessionSummary } from "./summary"
import { NamedError } from "@opencode-ai/core/util/error"
import { SessionProcessor } from "./processor"
import { Tool } from "@/tool/tool"
import { Permission } from "@/permission"
import { SessionStatus } from "./status"
import { LLM } from "./llm"
import { Shell } from "@opencode-ai/core/shell"
import { ShellID } from "@/tool/shell/id"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Truncate } from "@/tool/truncate"
import { Image } from "@/image/image"
import { decodeDataUrl } from "@/util/data-url"
import { Cause, Effect, Exit, Latch, Layer, Option, Scope, Context, Schema, Types } from "effect"
import * as DateTime from "effect/DateTime"
import { SessionEvent } from "@opencode-ai/core/session/event"
import { SessionMessage } from "@opencode-ai/core/session/message"
import { InstanceState } from "@/effect/instance-state"
import { InstanceRef } from "@/effect/instance-ref"
import { Instance } from "@/foxcode/instance"
import { EffectBridge } from "@/effect/bridge"
import { TaskTool, type TaskPromptOps } from "@/tool/task"
import { assertExternalDirectoryEffect } from "@/tool/external-directory"
import { SessionRunState } from "./run-state"
import { SessionDrain } from "@/foxcode/session/drain"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { EventV2Bridge } from "@/event-v2-bridge"
import { Database } from "@opencode-ai/core/database/database"
import { ModelV2 } from "@opencode-ai/core/model"
import { ProviderV2 } from "@opencode-ai/core/provider"
import * as FoxConfiguredReference from "@/foxcode/reference"
import { eq } from "drizzle-orm"
import { SessionTable } from "@opencode-ai/core/session/sql"
import { SessionReminders } from "./reminders"
import { SessionTools } from "./tools"
import { LLMEvent } from "@opencode-ai/llm"
import { RepositoryCache } from "@opencode-ai/core/repository-cache"
import { FoxSessionContinuation } from "@/foxcode/session/continuation"
import { FoxSessionControl } from "@/foxcode/session/control"
import { Goal } from "@/foxcode/session/goal/runner"
import { GoalPolicy } from "@/foxcode/session/goal/policy"
import { GoalState } from "@/foxcode/session/goal/state"

const decodeMessageInfo = Schema.decodeUnknownExit(SessionV1.Info)
const decodeMessagePart = Schema.decodeUnknownExit(SessionV1.Part)
import {
  MAX_MCP_RESOURCE_BLOB_BYTES,
  REQUEST_PRUNE_BYTES,
  SUPPORTED_MCP_RESOURCE_ATTACHMENT_MIMES,
  formatMcpResourceBytes,
  mcpResourceBase64Size,
} from "./prompt/attachment"
import {
  STRUCTURED_OUTPUT_DESCRIPTION,
  STRUCTURED_OUTPUT_SYSTEM_PROMPT,
  createStructuredOutputTool,
} from "./prompt/structured"
import { isOrphanedInterruptedTool } from "./prompt/orphan"
import {
  CommandInput,
  bashRegex,
  interpolateCommandTemplate,
  parseCommandArgs,
} from "./prompt/command"
import {
  PromptInput,
  LoopInput,
  ShellInput,
  ModelRef,
} from "./prompt/schema"
import { makeShellRunner } from "./prompt/shell"
import { makeSubtaskHandler } from "./prompt/subtask"
import { makePartsResolver } from "./prompt/parts"
import { makeTitleGenerator } from "./prompt/title"
import { makeCommandRunner } from "./prompt/command-runner"
import { makePreparer } from "./prompt/prepare"
import { makePromptLoop } from "./prompt/loop"

export { createStructuredOutputTool }
export const shouldAskPlanFollowup = FoxSessionPrompt.shouldAskPlanFollowup

export interface Interface {
  readonly cancel: (sessionID: SessionID, scope?: FoxSessionControl.AbortScope) => Effect.Effect<void>
  readonly paused: (sessionID: SessionID) => Effect.Effect<boolean>
  readonly prompt: (input: PromptInput) => Effect.Effect<SessionV1.WithParts, Image.Error>
  readonly loop: (input: LoopInput) => Effect.Effect<SessionV1.WithParts>
  readonly shell: (input: ShellInput) => Effect.Effect<SessionV1.WithParts, Session.BusyError>
  readonly command: (input: CommandInput) => Effect.Effect<SessionV1.WithParts, Image.Error | Error>
  readonly resolvePromptParts: (template: string) => Effect.Effect<PromptInput["parts"]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SessionPrompt") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const status = yield* SessionStatus.Service
    const sessions = yield* Session.Service
    const agents = yield* Agent.Service
    const provider = yield* Provider.Service
    const processor = yield* SessionProcessor.Service
    const compaction = yield* SessionCompaction.Service
    const plugin = yield* Plugin.Service
    const commands = yield* Command.Service
    const config = yield* Config.Service
    const permission = yield* Permission.Service
    const question = yield* Question.Service
    const fsys = yield* FSUtil.Service
    const mcp = yield* MCP.Service
    const lsp = yield* LSP.Service
    const registry = yield* ToolRegistry.Service
    const truncate = yield* Truncate.Service
    const image = yield* Image.Service
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const scope = yield* Scope.Scope
    const instruction = yield* Instruction.Service
    const state = yield* SessionRunState.Service
    const drain = yield* SessionDrain.Service
    const revert = yield* SessionRevert.Service
    const summary = yield* SessionSummary.Service
    const sys = yield* SystemPrompt.Service
    const llm = yield* LLM.Service
    const events = yield* EventV2Bridge.Service
    const flags = yield* RuntimeFlags.Service
    const database = yield* Database.Service
    const cache = Option.getOrUndefined(yield* Effect.serviceOption(RepositoryCache.Service))
    const { db } = database
    const ops = Effect.fn("SessionPrompt.ops")(function* (sessionID: SessionID) {
      return {
        cancel: (sessionID: SessionID) => cancel(sessionID),
        resolvePromptParts: (template: string) => resolvePromptParts(template),
        prompt: GoalPolicy.bind(sessionID, (input) => prompt(input).pipe(Effect.catch(Effect.die))),
      } satisfies TaskPromptOps
    })
    const control = yield* FoxSessionControl.make
    const cancel: (
      sessionID: SessionID,
      scope?: FoxSessionControl.AbortScope,
      preserve?: boolean,
    ) => Effect.Effect<void> = Effect.fn("SessionPrompt.cancel")(function* (
      sessionID: SessionID,
      scope: FoxSessionControl.AbortScope = "tree",
      preserve = false,
    ) {
      yield* Effect.logInfo("cancel", { "session.id": sessionID })
      yield* FoxSessionPrompt.cancelTree({
        sessionID,
        sessions,
        scope,
        drain,
        events,
        cancel: state.cancel,
        stop: (id, work) => control.stop(id, goals.pause(id, preserve && id === sessionID).pipe(Effect.andThen(work))),
      })
    })
    const currentModel = Effect.fnUntraced(function* (sessionID: SessionID) {
      const current = yield* db
        .select({ model: SessionTable.model })
        .from(SessionTable)
        .where(eq(SessionTable.id, sessionID))
        .get()
        .pipe(Effect.orDie)
      if (current?.model) {
        return {
          providerID: ProviderV2.ID.make(current.model.providerID),
          modelID: ModelV2.ID.make(current.model.id),
          ...(current.model.variant && current.model.variant !== "default" ? { variant: current.model.variant } : {}),
        }
      }
      const match = yield* sessions
        .findMessage(sessionID, (m) => m.info.role === "user" && !!m.info.model)
        .pipe(Effect.orDie)
      if (Option.isSome(match) && match.value.info.role === "user") return match.value.info.model
      return yield* provider.defaultModel().pipe(Effect.orDie)
    })

    const { resolveReferenceParts, resolvePromptParts } = makePartsResolver({
      config,
      agents,
      fsys,
      cache,
    })

    const { prepare, createUserMessage } = makePreparer({
      sessions,
      agents,
      events,
      provider,
      instruction,
      config,
      plugin,
      fsys,
      flags,
      mcp,
      lsp,
      registry,
      image,
      database,
      permission,
      currentModel,
      resolveReferenceParts,
    })

    const goals = yield* Goal.make({
      control,
      cancel: (id, preserve) => cancel(id, "tree", preserve),
      create: (input) => prepare(input, true).pipe(Effect.scoped),
      prompt: (input, ticket) => prompt(input, ticket),
    })

    const { title } = makeTitleGenerator({
      agents,
      provider,
      llm,
      sessions,
    })

    const getModel = Effect.fn("SessionPrompt.getModel")(function* (
      providerID: ProviderV2.ID,
      modelID: ModelV2.ID,
      sessionID: SessionID,
    ) {
      const exit = yield* provider.getModel(providerID, modelID).pipe(Effect.exit)
      if (Exit.isSuccess(exit)) return exit.value
      if (isInterrupted(exit.cause)) return yield* Effect.interrupt
      const err = Cause.squash(exit.cause)
      if (Provider.ModelNotFoundError.isInstance(err)) {
        const hint = err.suggestions?.length ? ` Did you mean: ${err.suggestions.join(", ")}?` : ""
        const empty = err.modelsEmpty ? " No models are currently available." : ""
        yield* events.publish(Session.Event.Error, {
          sessionID,
          error: new NamedError.Unknown({
            message: `Model not found: ${err.providerID}/${err.modelID}.${hint}${empty}`,
          }).toObject(),
        })
      }
      return yield* Effect.die(err)
    })

    const { handleSubtask } = makeSubtaskHandler({
      sessions,
      agents,
      events,
      commands,
      plugin,
      permission,
      registry,
      ops,
      getModel,
    })

    const lastAssistant = Effect.fnUntraced(function* (sessionID: SessionID) {
      for (let attempt = 0; attempt < 10; attempt++) {
        const match = yield* sessions.findMessage(sessionID, (m) => m.info.role !== "user")
        if (Option.isSome(match)) return match.value
        const msgs = yield* sessions.messages({ sessionID, limit: 1 })
        if (msgs.length > 0) return msgs[0]
        yield* Effect.sleep("50 millis")
      }
      throw new Error("Impossible")
    })

    const { loop, runLoop, closeReasons } = makePromptLoop({
      sessions,
      status,
      agents,
      provider,
      processor,
      compaction,
      plugin,
      config,
      permission,
      question,
      fsys,
      mcp,
      registry,
      truncate,
      scope,
      instruction,
      state,
      summary,
      sys,
      events,
      flags,
      database,
      control,
      ops,
      getModel,
      handleSubtask,
      title,
      lastAssistant,
    })

    const prompt: (
      input: PromptInput,
      prior?: FoxSessionControl.Ticket,
    ) => Effect.Effect<SessionV1.WithParts, Image.Error> = Effect.fn("SessionPrompt.prompt")(
      function* (input: PromptInput, prior?: FoxSessionControl.Ticket) {
        const background = FoxSessionControl.background(input.parts)
        // for its turn but must not pause the goal; the goal loop resumes after it.
        const human = input.parts.some((part) => part.type !== "text" || !part.synthetic)
        const ticket = prior ?? (yield* control.begin(input.sessionID, input.noReply !== true && human))
        const session = yield* sessions.get(input.sessionID).pipe(Effect.orDie)
        yield* revert.cleanup(session)
        yield* FoxSessionPrompt.recoverDanglingAssistant({ sessionID: input.sessionID, status, sessions })
        yield* FoxSessionPrompt.recoverProviderFinishError({ sessionID: input.sessionID, status, sessions })
        yield* FoxSessionPrompt.recoverFailedAssistant({ sessionID: input.sessionID, status, sessions })
        const message = yield* background
          ? createUserMessage(input)
          : FoxSessionPrompt.intake(
              input.sessionID,
              Effect.suspend(() => (ticket.current() ? createUserMessage(input) : Effect.interrupt)),
            )
        yield* sessions.touch(input.sessionID)

        const permissions: PermissionV1.Rule[] = []
        for (const [t, enabled] of Object.entries(input.tools ?? {})) {
          permissions.push({ permission: t, action: enabled ? "allow" : "deny", pattern: "*" })
        }
        if (permissions.length > 0) {
          const merged = FoxSessionPrompt.mergeToolPermissions({
            existing: session.permission ?? [],
            toggles: permissions,
          })
          session.permission = merged
          yield* sessions.setPermission({ sessionID: session.id, permission: merged })
        }
        // Otherwise the old turn can resume from a dismissed question and start another
        // LLM step before hasFollowup observes the replacement prompt.
        if (!ticket.running()) return message
        const dismiss = Effect.gen(function* () {
          yield* Effect.promise(() => Suggestion.dismissAll(input.sessionID)).pipe(Effect.orDie)
          yield* question.dismissAll(input.sessionID)
        })
        if (input.noReply === true) {
          yield* dismiss
          return message
        }
        // Queue tails and runner fibers can resume outside the HTTP request's
        // ambient instance context; bridge both Effect refs and legacy ALS.
        const bridge = yield* EffectBridge.make()
        return yield* FoxSessionPromptQueue.enqueue(
          input.sessionID,
          message.info.id,
          bridge.run(
            loop({ sessionID: input.sessionID, snapshotInitialization: input.snapshotInitialization }, ticket).pipe(
              Effect.orDie,
            ),
          ),
          bridge.run(lastAssistant(input.sessionID)),
          dismiss,
        )
      },
      Effect.catchTag("NotFoundError", Effect.die),
      (work, input) => drain.track(input.sessionID, work),
    )
    const { shell } = makeShellRunner({
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
    })
    const { command } = makeCommandRunner({
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
    })

    return Service.of({
      cancel,
      paused: (id) => control.paused(id),
      prompt,
      loop: (input) => loop(input).pipe(Effect.orDie),
      shell,
      command,
      resolvePromptParts,
    })
  }),
)

export const defaultLayer: Layer.Layer<Service> = Layer.suspend(() => AppNodeBuilder.build(node))
export { PromptInput, LoopInput, ShellInput, CommandInput }

const repositoryCacheNode = RepositoryCache.node
export const node = LayerNode.make({
  service: Service,
  layer,
  deps: [
    SessionStatus.node,
    Session.node,
    Agent.node,
    Provider.node,
    SessionProcessor.node,
    SessionCompaction.node,
    Plugin.node,
    Command.node,
    Config.node,
    Permission.node,
    FSUtil.node,
    MCP.node,
    LSP.node,
    ToolRegistry.node,
    Truncate.node,
    Image.node,
    CrossSpawnSpawner.node,
    Instruction.node,
    SessionRunState.node,
    SessionDrain.node,
    SessionRevert.node,
    SessionSummary.node,
    SystemPrompt.node,
    LLM.node,
    EventV2Bridge.node,
    RuntimeFlags.node,
    Database.node,
    Question.node,
    repositoryCacheNode,
  ],
})

export * as SessionPrompt from "./prompt"
