import { Effect, Option, Scope } from "effect"
import {
  MessageV2,
} from "../message-v2"
import {
  SessionV1,
} from "@opencode-ai/core/v1/session"
import type { NotFoundError } from "@/storage/storage"
import {
  ProviderV2,
} from "@opencode-ai/core/provider"
import {
  ModelV2,
} from "@opencode-ai/core/model"
import {
  SessionID,
  MessageID,
  PartID,
} from "../schema"
import {
  PermissionV1,
} from "@opencode-ai/core/v1/permission"
import { Session } from "../session"
import { SessionStatus } from "../status"
import { Agent } from "../../agent/agent"
import { Provider } from "@/provider/provider"
import { SessionProcessor } from "../processor"
import { SessionCompaction } from "../compaction"
import { Plugin } from "../../plugin"
import { Config } from "@/config/config"
import { Permission } from "@/permission"
import { Question } from "@/question"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { MCP } from "../../mcp"
import { ToolRegistry } from "@/tool/registry"
import { Truncate } from "@/tool/truncate"
import { Instruction } from "../instruction"
import { SessionRunState } from "../run-state"
import { SessionSummary } from "../summary"
import { SystemPrompt } from "../system"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { Database } from "@opencode-ai/core/database/database"
import { NamedError } from "@opencode-ai/core/util/error"
import { InstanceState } from "@/effect/instance-state"
import { GoalState } from "@/foxcode/session/goal/state"
import { BoardContext } from "@/foxcode/board/context"
import { FoxSessionPrompt } from "@/foxcode/session/prompt"
import { FoxSessionPromptQueue } from "@/foxcode/session/prompt-queue"
import { FoxSessionMessageOrder } from "@/foxcode/session/message-order"
import { FoxSession } from "@/foxcode/session"
import { FoxSessionTitle } from "@/foxcode/session/title"
import { FoxSessionProcessor } from "@/foxcode/session/processor"
import { FoxSessionOverflow } from "@/foxcode/session/overflow"
import { FoxSessionContinuation } from "@/foxcode/session/continuation"
import { SessionReminders } from "../reminders"
import { SessionTools } from "../tools"
import { MAX_STEPS_PROMPT } from "@opencode-ai/core/session/runner/max-steps"
import { FoxSessionControl } from "@/foxcode/session/control"
import { LoopInput } from "./schema"
import type { TaskPromptOps } from "@/tool/task"
import type { HandleSubtaskInput } from "./subtask"
import type { EnsureTitleInput } from "./title"
import type { EventV2 } from "@opencode-ai/core/event"
import { isOrphanedInterruptedTool } from "./orphan"
import { createStructuredOutputTool, STRUCTURED_OUTPUT_SYSTEM_PROMPT } from "./structured"
import { REQUEST_PRUNE_BYTES } from "./attachment"
import { resolveProfile } from "./model-profile"
import {
  resolveTier,
  computeMaxSteps,
  shouldWarnCoding,
  shouldRefuseCoding,
  createReclassState,
  reclassifyOnSuccess,
  reclassifyOnFailure,
  type TierReclassState,
} from "@/foxcode/model-tier"
import {
  resolveExitCondition,
  isCodeChangeTask,
  formatWakeUpAudit,
  buildSuggestedPrompt,
  buildEmptyExitReflectionText,
} from "../control-plane"
import { classifyIntent } from "@/foxcode/intent"
import { Verification } from "@opencode-ai/core/verification"
import { VerificationBaseline } from "@opencode-ai/core/verification-baseline"
import { RepairBudgetTracker } from "@opencode-ai/core/repair-budget"
import { buildCodeContextBlock, type CodeContextBlock } from "../code-context"
import { getOrCreateIndexer } from "@/tool/lookup_symbols"

export const FENCE_INSTRUCTION_PROMPT = `When making code changes, write the complete updated file in a fenced code block with the file path on the opening line:

\`\`\`filepath.ts
// complete file content
\`\`\`

Do not describe changes. Write the full file content directly.`

export interface PromptLoopDeps {
  readonly sessions: Session.Interface
  readonly status: typeof SessionStatus.Service.Service
  readonly agents: Agent.Interface
  readonly provider: Provider.Interface
  readonly processor: typeof SessionProcessor.Service.Service
  readonly compaction: typeof SessionCompaction.Service.Service
  readonly plugin: Plugin.Interface
  readonly config: Config.Interface
  readonly permission: Permission.Interface
  readonly question: Question.Interface
  readonly fsys: FSUtil.Interface
  readonly mcp: typeof MCP.Service.Service
  readonly registry: ToolRegistry.Interface
  readonly truncate: typeof Truncate.Service.Service
  readonly scope: Scope.Scope
  readonly instruction: typeof Instruction.Service.Service
  readonly state: typeof SessionRunState.Service.Service
  readonly summary: typeof SessionSummary.Service.Service
  readonly sys: typeof SystemPrompt.Service.Service
  readonly events: EventV2.Interface
  readonly flags: typeof RuntimeFlags.Service.Service
  readonly database: Database.Interface
  readonly control: Effect.Success<typeof FoxSessionControl.make>
  readonly ops: (sessionID: SessionID) => Effect.Effect<TaskPromptOps>
  readonly getModel: (
    providerID: ProviderV2.ID,
    modelID: ModelV2.ID,
    sessionID: SessionID,
  ) => Effect.Effect<Provider.Model>
  readonly handleSubtask: (input: HandleSubtaskInput) => Effect.Effect<void, any>
  readonly title: (input: EnsureTitleInput) => Effect.Effect<void, any>
  readonly lastAssistant: (sessionID: SessionID) => Effect.Effect<SessionV1.WithParts, any>
}

export function makePromptLoop(deps: PromptLoopDeps) {
  const {
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
  } = deps

  const closeReasons = new Map<string, FoxSession.CloseReason>()
  const emptyExitCounters = new Map<SessionID, number>()
  const lastUserMessageIDs = new Map<SessionID, MessageID>()
  const lastVerificationStates = new Map<
    SessionID,
    { timestamp: number; hasNewRegressions: boolean; feedback: string }
  >()

  const runLoop = Effect.fn("SessionPrompt.run")(function* (input: LoopInput) {
    const sessionID = input.sessionID
    const envCache: FoxSessionPrompt.EnvCache = {}
    const memoryCache = FoxSessionPrompt.memoryCache()
    const board = BoardContext.cache()
    closeReasons.delete(sessionID)
    let compactionAttempts = 0
    const ctx = yield* InstanceState.context
    let structured: unknown
    let step = 0
    const session = yield* sessions.get(sessionID).pipe(Effect.orDie)
    // Cache stable system prompt components across loop steps.
    // Skills listing, custom instructions (AGENTS.md), and MCP instructions
    // only change when the agent switches, which is rare mid-loop.
    const sysCache: {
      agentName?: string
      skills?: string | undefined
      instructions?: string[]
      mcpInstructions?: string | undefined
      codeContextHash?: string
      codeContextBlock?: string
    } = {}
    let codeContextDirty = true
    let codeContextCache: CodeContextBlock | undefined
    let lastMutationCount = 0
    // Cache static tool definitions across loop steps (Blueprint 11.1).
    // Invalidated when agent, model, or provider changes.
    let toolDefCache: SessionTools.ToolDefinitionCache | undefined
    let reclassState: TierReclassState | undefined

    while (true) {
      yield* status.set(sessionID, { type: "busy" })
      yield* Effect.logInfo("loop", { "session.id": sessionID, step })
      let msgs = yield* MessageV2.filterCompactedEffect(sessionID).pipe(
        Effect.provideService(Database.Service, database),
      )
      msgs = FoxSessionPromptQueue.scope(sessionID, msgs)
      msgs = FoxSessionPrompt.trimBeforeLastSummary(msgs)
      const latest = FoxSessionMessageOrder.latest(msgs)
      const { user: lastUser, assistant: lastAssistantMsgRef, finished: lastFinished, tasks } = latest
      if (input.resume && step === 0 && FoxSessionContinuation.target(msgs) !== input.resume) break
      if (!lastUser) throw new Error("No user message found in stream. This should never happen.")

      // Reset empty exit counter and journal on new user message (new goal)
      if (lastUserMessageIDs.get(sessionID) !== lastUser.id) {
        lastUserMessageIDs.set(sessionID, lastUser.id)
        emptyExitCounters.set(sessionID, 0)
        processor.getJournal(sessionID).reset()
        processor.resetParseFailStreak(sessionID)
        lastVerificationStates.delete(sessionID)
        codeContextDirty = true
        lastMutationCount = 0
      }

      // Check if harness recorded new mutations since last turn to invalidate code-context cache
      const currentJournal = processor.getJournal(sessionID)
      if (currentJournal.entries.length !== lastMutationCount) {
        codeContextDirty = true
        lastMutationCount = currentJournal.entries.length
      }

      const lastAssistantMsg = msgs.findLast(
        (msg) => msg.info.role === "assistant" && msg.info.id === lastAssistantMsgRef?.id,
      )
      const userBeforeAssistant =
        latest.userMessage &&
        latest.assistantMessage &&
        FoxSessionMessageOrder.compare(latest.userMessage, latest.assistantMessage) < 0
      const telemetry =
        FoxSessionProcessor.extractReviewTelemetry(
          msgs.findLast((m) => m.info.role === "user" && m.info.id === lastUser.id)?.parts ?? [],
        ) ?? FoxSessionProcessor.extractSuggestionReviewTelemetry(lastAssistantMsg?.parts ?? [])
      // Some providers return "stop" even when the assistant message contains
      // tool calls. Keep the loop running so tool results can be sent back to
      // the model, but ignore cleanup-marked interrupted orphans.
      const hasToolCalls =
        lastAssistantMsg?.parts.some(
          (part) => part.type === "tool" && !part.metadata?.providerExecuted && !isOrphanedInterruptedTool(part),
        ) ?? false
      if (
        lastAssistantMsgRef?.finish &&
        hasToolCalls &&
        lastAssistantMsgRef.parentID === lastUser.id &&
        userBeforeAssistant &&
        FoxSessionPrompt.shouldAskPlanFollowup({ messages: msgs, abort: AbortSignal.any([]) })
      ) {
        const action = yield* Effect.promise((signal) =>
          FoxSessionPrompt.askPlanFollowup({ sessionID, messages: msgs, abort: signal, question }),
        )
        if (action === "continue") continue
        yield* Effect.logInfo("exiting loop", { "session.id": sessionID })
        break
      }
      if (
        lastAssistantMsgRef?.finish &&
        !["tool-calls"].includes(lastAssistantMsgRef.finish) &&
        lastAssistantMsgRef.id !== input.resume &&
        !hasToolCalls &&
        lastAssistantMsgRef.parentID === lastUser.id &&
        userBeforeAssistant
      ) {
        const orphan = lastAssistantMsg?.parts.find(
          (part): part is MessageV2.ToolPart => part.type === "tool" && isOrphanedInterruptedTool(part),
        )
        if (orphan) {
          yield* Effect.logWarning("loop exit with orphaned interrupted tool", {
            "session.id": sessionID,
            messageID: lastAssistantMsgRef.id,
            tool: orphan.tool,
            callID: orphan.callID,
          })
        }

        // --- Phase 2E-1 & 2E-2 & 2F-4: Loop Exit Gate & Control Plane ---
        const cfg = yield* config.get()
        const userMsg = msgs.findLast((m) => m.info.role === "user" && m.info.id === lastUser.id)
        const userText =
          userMsg?.parts
            .filter((p): p is MessageV2.TextPart => p.type === "text")
            .map((p) => p.text)
            .join("\n") ?? ""

        const intent = classifyIntent({ message: userText })
        const hasEditTools = toolDefCache
          ? toolDefCache.builtins.some((b) =>
              ["edit", "rewrite_file", "apply_patch"].includes(b.id),
            )
          : true
        const isCodeChange = isCodeChangeTask(intent, userText, hasEditTools)

        const journal = processor.getJournal(sessionID)
        const journalEmpty = journal.isEmpty()
        const emptyExitRetries = emptyExitCounters.get(sessionID) ?? 0
        const maxEmptyExitRetries = cfg.autonomous?.max_empty_exit_retries ?? 2

        // Resolve agent, model and tier for exit check
        const agent = yield* agents.get(lastUser.agent)
        const model = yield* getModel(lastUser.model.providerID, lastUser.model.modelID, sessionID)
        const profile = resolveProfile({
          modelId: model.api.id,
          providerId: model.providerID,
          overrideProfile: cfg.model_profile,
        })
        const tierInfo = resolveTier({
          modelId: model.api.id,
          providerId: model.providerID,
          profileTier: profile.tier,
          profileParamHint: profile.parameterHint,
          overrideTier: cfg.model_tier,
        })
        if (!reclassState || reclassState.original.tier !== tierInfo.tier) {
          reclassState = createReclassState(tierInfo)
        }
        const effectiveTier =
          cfg.dynamic_tier_reclassification !== false && reclassState ? reclassState.current : tierInfo
        const maxSteps = computeMaxSteps(agent.steps, effectiveTier)
        const isMaxSteps = step >= maxSteps

        // Exit-time verification if mutations exist and auto-verify is enabled
        let hasNewRegressions = false
        let repairBudgetExhausted = false
        let regressionReflectionText: string | undefined

        const autoVerifyEnabled = cfg.autonomous?.auto_verify !== false
        if (!journalEmpty && autoVerifyEnabled) {
          const lastEntry = journal.lastEntry()
          const lastVerify = lastVerificationStates.get(sessionID)
          // Fresh-verify skip: if no new mutations since last verify
          if (lastVerify && lastEntry && lastEntry.timestamp <= lastVerify.timestamp) {
            hasNewRegressions = lastVerify.hasNewRegressions
            regressionReflectionText = lastVerify.feedback
          } else {
            const dirs = yield* config.directories()
            const projectDir: string = dirs[0] ?? globalThis.process.cwd()
            const scripts = yield* Effect.promise(() => Verification.readPackageScripts(projectDir))
            const pipeline = Verification.detectCommandPipeline(scripts, {
              test_command: cfg.autonomous?.test_command,
              typecheck_command: cfg.autonomous?.typecheck_command,
              lint_command: cfg.autonomous?.lint_command,
              verification_strategy: cfg.autonomous?.verification_strategy,
            })

            if (pipeline.commands.length > 0) {
              const timeoutMs = cfg.autonomous?.test_timeout ?? Verification.DEFAULT_VERIFICATION_TIMEOUT_MS
              let pipelineResult: Verification.PipelineResult = yield* Effect.promise(() =>
                Verification.executePipeline(pipeline, {
                  cwd: projectDir,
                  timeoutMs,
                }),
              )

              // Flaky test retry: retry failed command once before consuming budget
              if (!pipelineResult.allPassed && pipelineResult.firstFailure) {
                const retryResult = yield* Effect.promise(() =>
                  Verification.executeVerification(pipelineResult.firstFailure!.command, {
                    cwd: projectDir,
                    timeoutMs,
                  }),
                )
                if (retryResult.passed) {
                  const updatedResults = pipelineResult.results.map((r) =>
                    r.command === pipelineResult.firstFailure!.command ? retryResult : r,
                  )
                  const allPassed = updatedResults.every((r) => r.passed)
                  pipelineResult = {
                    results: updatedResults,
                    allPassed,
                    firstFailure: updatedResults.find((r) => !r.passed),
                    totalElapsedMs: pipelineResult.totalElapsedMs + retryResult.elapsedMs,
                  }
                }
              }

              const baseline = processor.getVerificationBaseline(sessionID)
              let regressionFeedback = ""
              if (baseline) {
                const analysis = VerificationBaseline.analyzeRegressions(baseline, pipelineResult)
                hasNewRegressions = analysis.hasNewRegressions
                regressionFeedback = VerificationBaseline.formatRegressionFeedback(analysis)
              } else {
                hasNewRegressions = !pipelineResult.allPassed
              }

              const feedback = Verification.formatPipelineFeedback(pipelineResult)
              regressionReflectionText = [feedback, regressionFeedback].filter(Boolean).join("\n\n")

              lastVerificationStates.set(sessionID, {
                timestamp: Date.now(),
                hasNewRegressions,
                feedback: regressionReflectionText,
              })

              const maxRepairTurns = cfg.autonomous?.max_repair_turns ?? 3
              const budget = processor.getRepairBudget(sessionID, maxRepairTurns)
              if (hasNewRegressions) {
                const budgetResult = RepairBudgetTracker.recordFailure(budget)
                repairBudgetExhausted = budgetResult.exhausted
              } else if (pipelineResult.allPassed) {
                RepairBudgetTracker.recordSuccess(budget)
                const lastHarnessCommit =
                  processor.getLastGreenCommit(sessionID) ??
                  processor.getHarnessCommits(sessionID).slice(-1)[0]
                if (lastHarnessCommit) {
                  processor.tagCommitGreen(sessionID, lastHarnessCommit.hash)
                }
              }
            }
          }
        }

        const parseFailStreak = processor.getParseFailStreak(sessionID)
        const greenCommit = processor.getLastGreenCommit(sessionID)

        const exitDecision = resolveExitCondition({
          isCodeChangeTask: isCodeChange,
          journalEmpty,
          emptyExitRetries,
          maxEmptyExitRetries,
          hasNewRegressions,
          repairBudgetExhausted,
          maxRepairTurns: cfg.autonomous?.max_repair_turns ?? 3,
          hasGreenCommit: !!greenCommit,
          isMaxSteps,
          parseFailStreak,
          maxParseFailStreak: 3,
          tier: effectiveTier.tier,
          regressionReflectionText,
        })

        if (exitDecision.action === "continue") {
          if (exitDecision.incrementEmptyExit) {
            emptyExitCounters.set(sessionID, emptyExitRetries + 1)
          }
          const reflectionText =
            exitDecision.reflectionText ?? buildEmptyExitReflectionText(effectiveTier.tier)
          const reflectionMsg: SessionV1.User = {
            id: MessageID.ascending(),
            sessionID,
            role: "user",
            time: { created: Date.now() },
            agent: lastUser.agent,
            model: lastUser.model,
            editorContext: lastUser.editorContext,
          }
          yield* sessions.updateMessage(reflectionMsg)
          yield* sessions.updatePart({
            id: PartID.ascending(),
            messageID: reflectionMsg.id,
            sessionID,
            type: "text",
            text: reflectionText,
            synthetic: true,
          } satisfies SessionV1.TextPart)
          FoxSessionPromptQueue.retarget(sessionID, reflectionMsg.id)
          yield* Effect.logInfo("exit gate injected reflection, continuing loop", {
            "session.id": sessionID,
            reason: exitDecision.reason,
          })
          continue
        }

        if (exitDecision.action === "rollback") {
          yield* processor.rollbackToLastGreen(sessionID)
        }

        if (exitDecision.terminalState) {
          const audit = formatWakeUpAudit({
            terminalState: exitDecision.terminalState,
            sessionID,
            reason: exitDecision.reason,
            rollbackAnchor: processor.getLastGreenCommit(sessionID)?.hash,
            modifiedFiles: [...new Set(journal.entries.map((e) => e.file))],
            suggestedPrompt: buildSuggestedPrompt(exitDecision),
          })
          yield* Effect.logInfo(audit)
        }

        yield* Effect.logInfo("exiting loop", { "session.id": sessionID, action: exitDecision.action })
        break
      }

      step++

      const model = yield* getModel(lastUser.model.providerID, lastUser.model.modelID, sessionID)
      const task = tasks.pop()

      if (task?.type === "subtask") {
        yield* handleSubtask({ task, model, lastUser, sessionID, session, msgs })
        continue
      }

      if (task?.type === "compaction") {
        const result = yield* compaction.process({
          messages: msgs,
          parentID: task.messageID,
          sessionID,
          auto: task.auto,
          overflow: task.overflow,
        })
        // setting ContextOverflowError on the summary message; surface as turn error
        if (result === "stop") {
          closeReasons.set(sessionID, "error")
          break
        }
        continue
      }

      if (
        lastFinished &&
        lastFinished.summary !== true &&
        (yield* compaction.isOverflow({ tokens: lastFinished.tokens, model }))
      ) {
        const guard = FoxSessionPrompt.guardCompactionAttempt({
          sessionID,
          attempts: compactionAttempts,
          closeReasons,
          message: lastFinished,
        })
        if (guard.exhausted) {
          // lastFinished is a prior turn's assistant — record exhaustion on the
          // message whose size tipped us past the compaction cap.
          yield* sessions.updateMessage(lastFinished)
          yield* events.publish(Session.Event.Error, { sessionID, error: guard.error })
          break
        }
        compactionAttempts++
        yield* compaction.create({
          sessionID,
          agent: lastUser.agent,
          model: lastUser.model,
          auto: true,
          overflow: false,
        })
        continue
      }

      const agent = yield* agents.get(lastUser.agent)
      if (!agent) {
        const available = (yield* agents.list()).filter((a) => !a.hidden).map((a) => a.name)
        const hint = available.length ? ` Available agents: ${available.join(", ")}` : ""
        const error = new NamedError.Unknown({ message: `Agent not found: "${lastUser.agent}".${hint}` })
        yield* events.publish(Session.Event.Error, { sessionID, error: error.toObject() })
        throw error
      }
      const cfg = yield* config.get()
      const profile = resolveProfile({
        modelId: model.api.id,
        providerId: model.providerID,
        overrideProfile: cfg.model_profile,
      })
      const tierInfo = resolveTier({
        modelId: model.api.id,
        providerId: model.providerID,
        profileTier: profile.tier,
        profileParamHint: profile.parameterHint,
        overrideTier: cfg.model_tier,
      })

      if (!reclassState || reclassState.original.tier !== tierInfo.tier) {
        reclassState = createReclassState(tierInfo)
      }
      const effectiveTierInfo =
        cfg.dynamic_tier_reclassification !== false && reclassState ? reclassState.current : tierInfo

      if (
        shouldRefuseCoding({
          tierInfo,
          agentName: agent.name,
          refuseSmallModelCoding: cfg.refuse_small_model_coding,
        })
      ) {
        const error = new NamedError.Unknown({
          message:
            `Refusing to run coding agent "${agent.name}" with Tier ${tierInfo.tier} model "${model.name}". ` +
            `Small models (<13B) lack the capability for reliable multi-turn code generation and editing. ` +
            `Please select a Tier A or Tier S model (30B+) for coding tasks.`,
        })
        yield* events.publish(Session.Event.Error, { sessionID, error: error.toObject() })
        throw error
      }

      const maxSteps = computeMaxSteps(agent.steps, effectiveTierInfo)
      const isLastStep = step >= maxSteps

      if (shouldWarnCoding(tierInfo, agent.name)) {
        yield* Effect.logWarning("model-tier-warning", {
          tier: tierInfo.tier,
          modelID: model.id,
          providerID: model.providerID,
          message:
            `Model "${model.name}" is classified as Tier ${tierInfo.tier} (${tierInfo.source}). ` +
            `Multi-turn coding may produce unreliable results. Steps capped at ${effectiveTierInfo.maxSteps}.`,
        })
      }
      msgs = yield* SessionReminders.apply({ messages: msgs, agent, session }).pipe(
        Effect.provideService(RuntimeFlags.Service, flags),
        Effect.provideService(FSUtil.Service, fsys),
        Effect.provideService(Session.Service, sessions),
      )

      const msg: MessageV2.Assistant = {
        id: MessageID.ascending(),
        parentID: lastUser.id,
        role: "assistant",
        mode: agent.name,
        agent: agent.name,
        variant: lastUser.model.variant,
        path: { cwd: ctx.directory, root: ctx.worktree },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        modelID: model.id,
        providerID: model.providerID,
        time: { created: Date.now() },
        sessionID,
      }
      yield* sessions.updateMessage(msg)
      const finalize = Effect.gen(function* () {
        if (msg.time.completed) return
        msg.error ??= MessageV2.fromError(new DOMException("Aborted", "AbortError"), {
          providerID: msg.providerID,
          aborted: true,
        })
        msg.time.completed = Date.now()
        yield* sessions.updateMessage(msg)
      })
      const handle = yield* processor
        .create({
          assistantMessage: msg,
          sessionID,
          model,
          telemetry,
          snapshotInitialization: input.snapshotInitialization,
        })
        .pipe(Effect.onInterrupt(() => finalize))

      const outcome: "break" | "continue" = yield* Effect.gen(function* () {
        const lastUserMsg = msgs.findLast((m) => m.info.role === "user")
        const bypassAgentCheck = lastUserMsg?.parts.some((p) => p.type === "agent") ?? false
        const promptOps = yield* ops(sessionID)
        const notify = BoardContext.allowed({ session, agent, user: lastUser })
          ? yield* BoardContext.notifier({ cache: board, session, agent, user: lastUser }).pipe(
              Effect.provideService(Config.Service, config),
              Effect.provideService(Database.Service, database),
              Effect.provideService(Agent.Service, agents),
              Effect.provideService(Session.Service, sessions),
              Effect.provideService(RuntimeFlags.Service, flags),
            )
          : undefined
        // --- Tool Definition Cache (Blueprint 11.1) ---
        // Phase 1: Resolve static definitions (cached across loop steps)
        const toolCacheKey = `${agent.name}:${model.id}:${model.providerID}:${effectiveTierInfo.tier}`
        if (!toolDefCache || toolDefCache.key !== toolCacheKey) {
          toolDefCache = yield* SessionTools.resolveDefinitions({
            agent,
            session,
            model,
            bypassAgentCheck,
            tierInfo: effectiveTierInfo,
            toolsFilterByTier: cfg.tools_filter_by_tier,
          }).pipe(
            Effect.provideService(ToolRegistry.Service, registry),
            Effect.provideService(MCP.Service, mcp),
            Effect.provideService(Config.Service, config),
            Effect.provideService(Database.Service, database),
            Effect.provideService(RuntimeFlags.Service, flags),
            Effect.withSpan("SessionPrompt.resolveDefinitions", { attributes: { step, agent: agent.name } }),
          )
        } // cache hit — reuse existing definitions
        // Phase 2: Bind per-step execution context (cheap, every step)
        const tools = yield* SessionTools.bindExecutionContext(toolDefCache, {
          agent,
          session,
          model,
          processor: handle,
          bypassAgentCheck,
          messages: msgs,
          promptOps,
          memoryCache,
          notify,
        }).pipe(
          Effect.provideService(Plugin.Service, plugin),
          Effect.provideService(Permission.Service, permission),
          Effect.provideService(Agent.Service, agents),
          Effect.provideService(Session.Service, sessions),
          Effect.provideService(MCP.Service, mcp),
          Effect.provideService(Truncate.Service, truncate),
          Effect.provideService(Config.Service, config),
          Effect.provideService(Provider.Service, provider),
          Effect.provideService(Database.Service, database),
          Effect.provideService(RuntimeFlags.Service, flags),
          Effect.withSpan("SessionPrompt.bindExecutionContext", { attributes: { step, agent: agent.name } }),
        )

        if (lastUser.format?.type === "json_schema") {
          tools["StructuredOutput"] = createStructuredOutputTool({
            schema: lastUser.format.schema,
            onSuccess(output) {
              structured = output
            },
          })
        }

        if (step === 1)
          yield* summary.summarize({ sessionID, messageID: lastUser.id }).pipe(Effect.ignore, Effect.forkIn(scope))

        yield* plugin.trigger("experimental.chat.messages.transform", {}, { messages: msgs })
        // media strip (keeps outgoing body under the gateway body-size limit
        // even when filterCompacted couldn't trim the pre-summary history).
        FoxSessionPrompt.injectEditorContext({ msgs, session, sessionID, cache: envCache })
        msgs = FoxSessionPrompt.maybeStripHistoricalMedia(msgs)
        // Recompute cached system prompt components only when agent changes.
        if (sysCache.agentName !== agent.name) {
          const [s, i, m] = yield* Effect.all([
            sys.skills(agent),
            instruction.system().pipe(Effect.orDie),
            sys.mcp(agent, session.permission),
          ]).pipe(Effect.withSpan("SessionPrompt.cacheSystemPrompts", { attributes: { agent: agent.name } }))
          sysCache.agentName = agent.name
          sysCache.skills = s
          sysCache.instructions = i
          sysCache.mcpInstructions = m
        }
        const skills = sysCache.skills
        const instructions = sysCache.instructions!
        const mcpInstructions = sysCache.mcpInstructions
        // Environment and memory are step-specific — always recompute.
        const [env, mem] = yield* Effect.all([
          sys.environment(model, lastUser.editorContext),
          FoxSessionPrompt.memoryInject({ ctx, sessionID, record: step === 1, cache: memoryCache }),
        ]).pipe(Effect.withSpan("SessionPrompt.assemblePrompt", { attributes: { step } }))
        let modelMsgs = yield* MessageV2.toModelMessagesEffect(msgs, model).pipe(
          Effect.provideService(Database.Service, database),
        )
        const size = Buffer.byteLength(JSON.stringify(modelMsgs))
        if (size > REQUEST_PRUNE_BYTES) {
          yield* compaction.prune({ sessionID, reason: "payload-limit" })
          msgs = yield* MessageV2.filterCompactedEffect(sessionID).pipe(
            Effect.provideService(Database.Service, database),
          )
          msgs = FoxSessionPromptQueue.scope(sessionID, msgs)
          msgs = FoxSessionPrompt.trimBeforeLastSummary(msgs)
          yield* plugin.trigger("experimental.chat.messages.transform", {}, { messages: msgs })
          FoxSessionPrompt.injectEditorContext({ msgs, session, sessionID, cache: envCache })
          msgs = FoxSessionPrompt.maybeStripHistoricalMedia(msgs)
          modelMsgs = yield* MessageV2.toModelMessagesEffect(msgs, model).pipe(
            Effect.provideService(Database.Service, database),
          )
          const nextSize = Buffer.byteLength(JSON.stringify(modelMsgs))
          if (nextSize > REQUEST_PRUNE_BYTES)
            yield* Effect.logWarning("payload still large after pruning", { "session.id": sessionID, size: nextSize })
        }
        // Phase 2E PR 3: Code Context Block injection (Tasks 2E-3 & 2E-5)
        if (codeContextDirty || !codeContextCache) {
          const indexer = getOrCreateIndexer(ctx.directory)
          const taskText = lastUserMsg?.parts.find((p) => p.type === "text")?.text ?? ""
          codeContextCache = buildCodeContextBlock({
            task: taskText,
            tier: effectiveTierInfo.tier,
            indexer,
            workingSet: [],
            mutatedFiles: [...new Set(currentJournal.entries.map((e) => e.file))],
            projectDir: ctx.directory,
          })
          codeContextDirty = false
        }
        sysCache.codeContextHash = codeContextCache.contentHash
        sysCache.codeContextBlock = codeContextCache.content

        // Phase 2E PR 4: C/D whole-file generation format instruction
        const fenceInstruction = effectiveTierInfo.useFenceParse ? FENCE_INSTRUCTION_PROMPT : undefined

        const system = [
          ...env,
          ...mem,
          ...(tools.board_read && notify ? [BoardContext.instructions] : []),
          ...(fenceInstruction ? [fenceInstruction] : instructions),
          ...(mcpInstructions ? [mcpInstructions] : []),
          ...(skills ? [skills] : []),
          ...(sysCache.codeContextBlock ? [sysCache.codeContextBlock] : []),
        ]
        const format = lastUser.format ?? { type: "text" as const }
        if (format.type === "json_schema") system.push(STRUCTURED_OUTPUT_SYSTEM_PROMPT)
        const result = yield* handle.process({
          user: lastUser,
          agent,
          permission: FoxSessionPrompt.guardPermissions({ agent, session }),
          sessionID,
          parentSessionID: session.parentID,
          system,
          messages: [
            ...modelMsgs,
            ...FoxSessionContinuation.context(!!input.resume && step === 1),
            ...(isLastStep ? [{ role: "user" as const, content: MAX_STEPS_PROMPT }] : []),
          ],
          tools,
          model,
          toolChoice: format.type === "json_schema" ? "required" : undefined,
          reportedContextTokens:
            lastFinished && lastFinished.summary !== true
              ? FoxSessionOverflow.count(lastFinished.tokens)
              : undefined,
        }).pipe(Effect.withSpan("SessionPrompt.llmProcess", { attributes: { step, model: model.id } }))
        const marker = FoxSessionPrompt.memoryPart({ sessionID, message: handle.message, cache: memoryCache })
        if (marker) yield* sessions.updatePart(marker)
        if (structured !== undefined) {
          handle.message.structured = structured
          handle.message.finish = handle.message.finish ?? "stop"
          yield* sessions.updateMessage(handle.message)
          return "break" as const
        }

        const finished = handle.message.finish && !["tool-calls", "unknown"].includes(handle.message.finish)
        if (finished && !handle.message.error) {
          if (handle.message.finish === "content-filter") {
            handle.message.error = new SessionV1.ContentFilterError({
              message: "The response was blocked by the provider's content filter",
            }).toObject()
            yield* sessions.updateMessage(handle.message)
            yield* events.publish(Session.Event.Error, { sessionID, error: handle.message.error })
            closeReasons.set(sessionID, "error")
            return "break" as const
          }
          if (format.type === "json_schema") {
            handle.message.error = new MessageV2.StructuredOutputError({
              message: "Model did not produce structured output",
              retries: 0,
            }).toObject()
            yield* sessions.updateMessage(handle.message)
            return "break" as const
          }
          if (handle.message.finish === "error") {
            FoxSessionProcessor.providerFinishError(handle.message)
            yield* sessions.updateMessage(handle.message)
            closeReasons.set(sessionID, "error")
            return "break" as const
          }
        }
        if (result === "stop") {
          if (handle.message.error) closeReasons.set(sessionID, "error")
          return "break" as const
        }

        const parts = yield* MessageV2.parts(handle.message.id).pipe(
          Effect.provideService(Database.Service, database),
        )
        const toolParts = parts.filter(
          (part): part is MessageV2.ToolPart => part.type === "tool" && !isOrphanedInterruptedTool(part),
        )
        if (toolParts.length > 0 && cfg.dynamic_tier_reclassification !== false && reclassState) {
          const oldTier = reclassState.current.tier
          const toolCallFailed = toolParts.some((p) => p.state.status === "error")
          reclassState = toolCallFailed
            ? reclassifyOnFailure(reclassState)
            : reclassifyOnSuccess(reclassState)
          if (reclassState.current.tier !== oldTier) {
            toolDefCache = undefined
          }
        }

        if (result === "compact") {
          const tools = parts.some(
            (part) => part.type === "tool" && !part.metadata?.providerExecuted && !isOrphanedInterruptedTool(part),
          )
          if (!handle.message.finish || ["tool-calls", "unknown"].includes(handle.message.finish) || tools) {
            const guard = FoxSessionPrompt.guardCompactionAttempt({
              sessionID,
              attempts: compactionAttempts,
              closeReasons,
              message: handle.message,
            })
            if (guard.exhausted) {
              yield* sessions.updateMessage(handle.message)
              yield* events.publish(Session.Event.Error, { sessionID, error: guard.error })
              return "break" as const
            }
            compactionAttempts++
            yield* compaction.create({
              sessionID,
              agent: lastUser.agent,
              model: lastUser.model,
              auto: true,
              overflow: handle.message.finish ? undefined : handle.compactError?.() !== undefined,
            })
          }
        }
        if (FoxSessionPromptQueue.hasFollowup(sessionID)) {
          closeReasons.set(sessionID, "superseded")
          const handoff = FoxSessionPromptQueue.active(sessionID)
          if (handoff && GoalState.active(sessionID)) FoxSessionPromptQueue.markSuperseded(sessionID, handoff)
          return "break" as const
        }
        if (result !== "compact" && !handle.message.finish) {
          handle.message.finish = "unknown"
          yield* sessions.updateMessage(handle.message)
        }
        return "continue" as const
      }).pipe(
        Effect.ensuring(instruction.clear(handle.message.id)),
        Effect.onInterrupt(() => finalize),
      )
      if (outcome === "break") break
      continue
    }

    yield* compaction.prune({ sessionID, reason: "normal" }).pipe(Effect.ignore, Effect.forkIn(scope))
    yield* FoxSessionTitle.deferred({ sessionID, scope, sessions, database, generate: title }).pipe(Effect.ignore)
    return yield* lastAssistant(sessionID)
  })

  const loop = Effect.fn("SessionPrompt.loop")(function* (
    input: LoopInput,
    prior?: FoxSessionControl.Ticket,
  ) {
    const ticket = prior ?? (yield* control.begin(input.sessionID, true))
    if (!ticket.running()) return yield* lastAssistant(input.sessionID)
    const session = yield* sessions.get(input.sessionID)
    if (!input.resume) {
      yield* FoxSessionPrompt.recoverDanglingAssistant({ sessionID: input.sessionID, status, sessions })
      yield* FoxSessionPrompt.recoverProviderFinishError({ sessionID: input.sessionID, status, sessions })
      yield* FoxSessionPrompt.recoverFailedAssistant({ sessionID: input.sessionID, status, sessions })
    }
    if (!ticket.running()) return yield* lastAssistant(input.sessionID)
    yield* FoxSession.publishTurnOpen({ sessionID: input.sessionID })
    return yield* Effect.onExit(
      state.ensureRunning(
        input.sessionID,
        lastAssistant(input.sessionID).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              if (!closeReasons.has(input.sessionID)) closeReasons.set(input.sessionID, "interrupted")
            }),
          ),
          Effect.orDie,
        ),
        runLoop(input).pipe(Effect.orDie),
        ticket.running,
      ),
      Effect.fnUntraced(function* (exit) {
        yield* FoxSession.publishTurnClose({
          sessionID: input.sessionID,
          parentID: session.parentID,
          reason: FoxSessionPrompt.resolveCloseReason({
            sessionID: input.sessionID,
            closeReasons,
            exit,
          }),
        })
      }),
    )
  })

  return { loop, runLoop, closeReasons }
}
