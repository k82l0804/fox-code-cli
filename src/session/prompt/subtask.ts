import { Cause, Effect } from "effect"
import { MessageID, PartID, SessionID } from "../schema"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { NamedError } from "@opencode-ai/core/util/error"
import { InstanceState } from "@/effect/instance-state"
import { ulid } from "ulid"
import { TaskTool, type TaskPromptOps } from "@/tool/task"
import { FoxCostPropagation } from "@/foxcode/session/cost-propagation"
import { FoxSessionPrompt } from "@/foxcode/session/prompt"
import { Session } from "../session"
import type { Agent } from "../../agent/agent"
import type { EventV2 } from "@opencode-ai/core/event"
import type { Command } from "../../command"
import type { Plugin } from "../../plugin"
import type { Permission } from "@/permission"
import type { ToolRegistry } from "@/tool/registry"
import type { Provider } from "@/provider/provider"
import type { ProviderV2 } from "@opencode-ai/core/provider"
import type { ModelV2 } from "@opencode-ai/core/model"

export interface SubtaskContext {
  sessions: Session.Interface
  agents: Agent.Interface
  events: EventV2.Interface
  commands: Command.Interface
  plugin: Plugin.Interface
  permission: Permission.Interface
  registry: ToolRegistry.Interface
  ops: (sessionID: SessionID) => Effect.Effect<TaskPromptOps>
  getModel: (providerID: ProviderV2.ID, modelID: ModelV2.ID, sessionID: SessionID) => Effect.Effect<Provider.Model>
}

export interface HandleSubtaskInput {
  task: SessionV1.SubtaskPart
  model: Provider.Model
  lastUser: SessionV1.User
  sessionID: SessionID
  session: Session.Info
  msgs: SessionV1.WithParts[]
}

export function makeSubtaskHandler(ctx: SubtaskContext) {
  const { sessions, agents, events, commands, plugin, permission, registry, ops, getModel } = ctx

  const handleSubtask = Effect.fn("SessionPrompt.handleSubtask")(function* (input: HandleSubtaskInput) {
    const { task, model, lastUser, sessionID, session, msgs } = input
    const instanceCtx = yield* InstanceState.context
    const promptOps = yield* ops(sessionID)
    const { task: taskTool } = yield* registry.named()
    const taskModel = task.model ? yield* getModel(task.model.providerID, task.model.modelID, sessionID) : model
    const taskVariant = task.variant ?? lastUser.model.variant
    const assistantMessage: SessionV1.Assistant = yield* sessions.updateMessage({
      id: MessageID.ascending(),
      role: "assistant",
      parentID: lastUser.id,
      sessionID,
      mode: task.agent,
      agent: task.agent,
      variant: taskVariant,
      path: { cwd: instanceCtx.directory, root: instanceCtx.worktree },
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      modelID: taskModel.id,
      providerID: taskModel.providerID,
      time: { created: Date.now() },
    })
    let part: SessionV1.ToolPart = yield* sessions.updatePart({
      id: PartID.ascending(),
      messageID: assistantMessage.id,
      sessionID: assistantMessage.sessionID,
      type: "tool",
      callID: ulid(),
      tool: TaskTool.id,
      state: {
        status: "running",
        input: {
          prompt: task.prompt,
          description: task.description,
          subagent_type: task.agent,
          command: task.command,
        },
        time: { start: Date.now() },
      },
    })
    const taskArgs = {
      prompt: task.prompt,
      description: task.description,
      subagent_type: task.agent,
      command: task.command,
    }
    yield* plugin.trigger(
      "tool.execute.before",
      { tool: TaskTool.id, sessionID, callID: part.id },
      { args: taskArgs },
    )

    const taskAgent = yield* agents.get(task.agent)
    if (!taskAgent) {
      const available = (yield* agents.list()).filter((a) => !a.hidden).map((a) => a.name)
      const hint = available.length ? ` Available agents: ${available.join(", ")}` : ""
      const error = new NamedError.Unknown({ message: `Agent not found: "${task.agent}".${hint}` })
      yield* events.publish(Session.Event.Error, { sessionID, error: error.toObject() })
      throw error
    }
    const workflow = yield* Effect.gen(function* () {
      if (!task.command) return undefined
      const command = yield* commands.get(task.command)
      if (!command) return undefined
      if (!command.model && !command.variant && !(command.agent && taskAgent.model)) return undefined
      return {
        model: task.model ?? { providerID: taskModel.providerID, modelID: taskModel.id },
        variant: task.variant,
      }
    })
    let error: Error | undefined
    const taskAbort = new AbortController()
    const childID = () => {
      const meta = part.state.status !== "pending" ? part.state.metadata : undefined
      return (meta as { sessionId?: string } | undefined)?.sessionId
    }
    const result = yield* taskTool
      .execute(taskArgs, {
        agent: task.agent,
        messageID: assistantMessage.id,
        sessionID,
        abort: taskAbort.signal,
        callID: part.callID,
        extra: {
          bypassAgentCheck: true,
          promptOps,
          workflow,
        },
        messages: msgs,
        metadata: (val: { title?: string; metadata?: Record<string, any> }) =>
          Effect.gen(function* () {
            part = yield* sessions.updatePart({
              ...part,
              type: "tool",
              state: { ...part.state, ...val },
            } satisfies SessionV1.ToolPart)
          }),
        ask: (req: any) =>
          FoxSessionPrompt.askPermission({
            permission,
            agents,
            sessions,
            agent: taskAgent,
            session,
            request: {
              ...req,
              sessionID,
            },
          }).pipe(Effect.orDie),
      })
      .pipe(
        Effect.catchCause((cause) => {
          const defect = Cause.squash(cause)
          error = defect instanceof Error ? defect : new Error(String(defect))
          return Effect.logError("subtask execution failed", {
            error,
            agent: task.agent,
            description: task.description,
          })
        }),
        Effect.onInterrupt(() =>
          Effect.gen(function* () {
            taskAbort.abort()
            assistantMessage.finish = "tool-calls"
            assistantMessage.time.completed = Date.now()
            const cid = childID()
            if (cid) {
              assistantMessage.cost = yield* FoxCostPropagation.childCost(sessions, SessionID.make(cid))
            }
            yield* sessions.updateMessage(assistantMessage)
            if (part.state.status === "running") {
              yield* sessions.updatePart({
                ...part,
                state: {
                  status: "error",
                  error: "Cancelled",
                  time: { start: part.state.time.start, end: Date.now() },
                  metadata: part.state.metadata,
                  input: part.state.input,
                },
              } satisfies SessionV1.ToolPart)
            }
          }),
        ),
      )

    const attachments = result?.attachments?.map((attachment) => ({
      ...attachment,
      id: PartID.ascending(),
      sessionID,
      messageID: assistantMessage.id,
    }))

    yield* plugin.trigger(
      "tool.execute.after",
      { tool: TaskTool.id, sessionID, callID: part.id, args: taskArgs },
      result,
    )

    assistantMessage.finish = "tool-calls"
    assistantMessage.time.completed = Date.now()
    const cid = result?.metadata?.sessionId ?? childID()
    if (cid) {
      assistantMessage.cost = yield* FoxCostPropagation.childCost(sessions, SessionID.make(cid))
    }
    yield* sessions.updateMessage(assistantMessage)

    if (result && part.state.status === "running") {
      yield* sessions.updatePart({
        ...part,
        state: {
          status: "completed",
          input: part.state.input,
          title: result.title,
          metadata: result.metadata,
          output: result.output,
          attachments,
          time: { ...part.state.time, end: Date.now() },
        },
      } satisfies SessionV1.ToolPart)
    }

    if (!result) {
      yield* sessions.updatePart({
        ...part,
        state: {
          status: "error",
          error: error ? `Tool execution failed: ${error.message}` : "Tool execution failed",
          time: {
            start: part.state.status === "running" ? part.state.time.start : Date.now(),
            end: Date.now(),
          },
          metadata: part.state.status === "pending" ? undefined : part.state.metadata,
          input: part.state.input,
        },
      } satisfies SessionV1.ToolPart)
    }

    if (!task.command) return

    const summaryUserMsg: SessionV1.User = {
      id: MessageID.ascending(),
      sessionID,
      role: "user",
      time: { created: Date.now() },
      agent: lastUser.agent,
      model: lastUser.model,
      editorContext: lastUser.editorContext,
    }
    yield* sessions.updateMessage(summaryUserMsg)
    yield* sessions.updatePart({
      id: PartID.ascending(),
      messageID: summaryUserMsg.id,
      sessionID,
      type: "text",
      text: "Summarize the task tool output above and continue with your task.",
      synthetic: true,
    } satisfies SessionV1.TextPart)
  })

  return { handleSubtask }
}
