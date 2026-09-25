/**
 * Unified Control Plane (2F-4) — Owns all loop exit decisions for unattended execution.
 *
 * Implements the Phase 2E Harness-Owns-Done law:
 * "The harness owns 'done', context, and the edit contract. The model is a text
 * generator inside a deterministic loop. The model does NOT decide when to exit."
 */

import { classifyIntent, type IntentClassification } from "@/foxcode/intent"

export type ExitAction = "continue" | "break" | "rollback"

/**
 * The 4 universal terminal states for unattended execution (from Guardian v5.0):
 * - "done": Plan/task satisfied, mutations applied, verification passed/approved
 * - "blocked": Human decision required (ambiguous spec, policy violation, design fork)
 *              NOTE: Reserved for Phase 3A (Plan Contract gate) — not assignable by resolveExitCondition() in PR 1.
 * - "failed-safe": Circuit breaker / repair budget tripped; rolled back to green anchor
 * - "needs-review": Budget exhausted without a green commit; halted with wake-up audit
 */
export type TerminalState = "done" | "blocked" | "failed-safe" | "needs-review"

export interface ExitConditionState {
  isCodeChangeTask: boolean
  journalEmpty: boolean
  emptyExitRetries: number
  maxEmptyExitRetries?: number // default 2
  hasNewRegressions: boolean
  repairBudgetExhausted: boolean
  maxRepairTurns?: number // default 3
  hasGreenCommit: boolean
  isMaxSteps: boolean
  parseFailStreak?: number // consecutive identical tool-output parse failures (default 0)
  maxParseFailStreak?: number // default 3 — circuit breaker
  emptyExitReflectionText?: string
  regressionReflectionText?: string
  tier?: string
}

export interface ExitDecision {
  action: ExitAction
  terminalState?: TerminalState
  reflectionText?: string
  incrementEmptyExit?: boolean
  reason: string
}

export const CODE_CHANGE_OVERRIDE_WORDS =
  /\b(fix|add|refactor|implement|create|update|change|modify|remove|delete|failing|broken|bug|error)\b/i

/**
 * Determine whether a task requires a code change.
 * Fails open toward code-change when edit tools are available and override words match.
 */
export function isCodeChangeTask(
  intentOrText: IntentClassification | { needsWriteTools?: boolean } | string,
  userTextOrHasEditTools?: string | boolean,
  hasEditTools?: boolean,
): boolean {
  if (typeof intentOrText === "string") {
    const text = intentOrText
    const tools = typeof userTextOrHasEditTools === "boolean" ? userTextOrHasEditTools : true
    const intent = classifyIntent({ message: text })
    if (intent.needsWriteTools) return true
    if (tools && CODE_CHANGE_OVERRIDE_WORDS.test(text)) return true
    return false
  }
  const intent = intentOrText
  const userText = typeof userTextOrHasEditTools === "string" ? userTextOrHasEditTools : ""
  const tools =
    typeof hasEditTools === "boolean"
      ? hasEditTools
      : typeof userTextOrHasEditTools === "boolean"
        ? userTextOrHasEditTools
        : false
  if (intent?.needsWriteTools) return true
  if (tools && CODE_CHANGE_OVERRIDE_WORDS.test(userText)) return true
  return false
}

/**
 * Build synthetic user-role reflection text when the model exits with an empty journal on a code-change task.
 */
export function buildEmptyExitReflectionText(tier?: string): string {
  if (tier === "C" || tier === "D") {
    return [
      "No files were modified. The task requires a code change.",
      "Please write the complete file in a fenced block with the file path on the opening line.",
      "Do not describe the changes — write the full file content directly.",
    ].join(" ")
  }
  return [
    "No files were modified. The task requires a code change.",
    "Please use the `edit` tool to make the necessary changes.",
    "Do not describe the changes — apply them directly.",
  ].join(" ")
}

/**
 * Unified exit condition resolver. Pure function evaluating the 4 universal terminal states
 * in strict priority order.
 */
export function resolveExitCondition(state: ExitConditionState): ExitDecision {
  // 1. Max steps reached — highest priority
  if (state.isMaxSteps) {
    return {
      action: "break",
      terminalState: "needs-review",
      reason: "max steps reached",
    }
  }

  // 2. Not a code-change task — exit normally
  if (!state.isCodeChangeTask) {
    return {
      action: "break",
      terminalState: "done",
      reason: "non-code task, exit normally",
    }
  }

  // 3. Parse-fail circuit breaker (3-strike rule)
  // Prevents Goose-style truncate → retry → 1000-turn livelock.
  // If consecutive tool parse failures reach the threshold, trip the circuit breaker.
  const parseFailStreak = state.parseFailStreak ?? 0
  const maxParseFailStreak = state.maxParseFailStreak ?? 3
  if (parseFailStreak >= maxParseFailStreak) {
    return {
      action: state.hasGreenCommit ? "rollback" : "break",
      terminalState: "failed-safe",
      reason: `parse-fail circuit breaker: ${parseFailStreak} identical failures`,
    }
  }

  // 4. Empty journal on code-change task
  if (state.journalEmpty) {
    const maxEmptyExitRetries = state.maxEmptyExitRetries ?? 2
    if (state.emptyExitRetries >= maxEmptyExitRetries) {
      return {
        action: "break",
        terminalState: "needs-review",
        reason: `empty exit retries exhausted (${maxEmptyExitRetries})`,
      }
    }
    return {
      action: "continue",
      reflectionText: state.emptyExitReflectionText ?? buildEmptyExitReflectionText(state.tier),
      incrementEmptyExit: true,
      reason: "no mutations on code-change task",
    }
  }

  // 5. Verification failed with regressions
  if (state.hasNewRegressions) {
    const maxRepairTurns = state.maxRepairTurns ?? 3
    if (state.repairBudgetExhausted) {
      return {
        action: state.hasGreenCommit ? "rollback" : "break",
        terminalState: state.hasGreenCommit ? "failed-safe" : "needs-review",
        reason: `repair budget exhausted (${maxRepairTurns} cycles)`,
      }
    }
    return {
      action: "continue",
      reflectionText:
        state.regressionReflectionText ??
        "Verification failed with regressions. Please fix the failing checks before finishing.",
      reason: "new regressions detected",
    }
  }

  // 6. Mutations applied + verification passed/not-configured — exit cleanly
  return {
    action: "break",
    terminalState: "done",
    reason: "mutations applied, verification passed",
  }
}

export interface WakeUpAuditParams {
  terminalState: TerminalState
  sessionID: string
  reason: string
  rollbackAnchor?: string
  modifiedFiles: string[]
  failedStage?: string
  suggestedPrompt?: string
}

export function formatWakeUpAudit(params: WakeUpAuditParams): string {
  const lines = [
    `=== [Fox Wake-up Audit] ===`,
    `Terminal State : ${params.terminalState}`,
    `Session ID     : ${params.sessionID}`,
    `Reason         : ${params.reason}`,
  ]
  if (params.rollbackAnchor) lines.push(`Rollback Anchor: ${params.rollbackAnchor}`)
  lines.push(`Modified Files : [${params.modifiedFiles.join(", ")}]`)
  if (params.failedStage) lines.push(`Failing Stage  : ${params.failedStage}`)
  if (params.suggestedPrompt) lines.push(`Suggested Next : "${params.suggestedPrompt}"`)
  lines.push(`=============================`)
  return lines.join("\n")
}

export function buildSuggestedPrompt(exitDecision: ExitDecision): string {
  switch (exitDecision.terminalState) {
    case "done":
      return "Review the changes and run tests manually to confirm."
    case "failed-safe":
      return `Rolled back to green commit. Focus on fixing: ${exitDecision.reason}`
    case "needs-review":
      return `Budget exhausted. Review the current state: ${exitDecision.reason}`
    case "blocked":
      return "Human decision required before proceeding."
    default:
      return "Check session state and decide next steps."
  }
}
