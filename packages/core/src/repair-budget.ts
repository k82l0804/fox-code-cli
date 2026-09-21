/**
 * Repair Budget Tracker — session-scoped consecutive-failure counter
 * for the Autonomous Verification Layer.
 *
 * Tracks how many consecutive verification cycles have failed within a
 * session. When the budget is exhausted, emits a model-facing warning
 * instructing the agent to stop the current approach and either ask the
 * user for help or try a fundamentally different strategy.
 *
 * The budget resets on:
 * - A passing verification cycle
 * - A new user message (signaling fresh intent)
 *
 * This module is pure / stateless at the function level — the mutable
 * state lives in the `RepairBudget` object created per session.
 */
export * as RepairBudgetTracker from "./repair-budget"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Mutable repair budget state, one per session processor Handle. */
export interface RepairBudget {
  /** Maximum consecutive failed verification turns before warning. */
  readonly maxTurns: number
  /** Current count of consecutive failed verification cycles. */
  consecutiveFailures: number
  /** Total repair turns across the entire session (never resets). */
  totalRepairTurns: number
}

/** Result of recording a verification outcome. */
export interface BudgetResult {
  /** Whether the repair budget is exhausted. */
  readonly exhausted: boolean
  /** Current consecutive failure count. */
  readonly consecutiveFailures: number
  /** Total repair turns in this session. */
  readonly totalRepairTurns: number
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new repair budget with the given maximum turns.
 * @param maxTurns Maximum consecutive failures before exhaustion (default: 3).
 */
export function createBudget(maxTurns = 3): RepairBudget {
  return {
    maxTurns,
    consecutiveFailures: 0,
    totalRepairTurns: 0,
  }
}

// ---------------------------------------------------------------------------
// State Transitions
// ---------------------------------------------------------------------------

/**
 * Record a failed verification cycle.
 * Increments consecutive failures and total repair turns.
 *
 * @returns BudgetResult indicating whether the budget is now exhausted.
 */
export function recordFailure(budget: RepairBudget): BudgetResult {
  budget.consecutiveFailures++
  budget.totalRepairTurns++
  return {
    exhausted: budget.consecutiveFailures >= budget.maxTurns,
    consecutiveFailures: budget.consecutiveFailures,
    totalRepairTurns: budget.totalRepairTurns,
  }
}

/**
 * Record a successful verification cycle.
 * Resets consecutive failures but preserves total repair turns.
 *
 * @returns BudgetResult (never exhausted after success).
 */
export function recordSuccess(budget: RepairBudget): BudgetResult {
  budget.consecutiveFailures = 0
  return {
    exhausted: false,
    consecutiveFailures: 0,
    totalRepairTurns: budget.totalRepairTurns,
  }
}

/**
 * Full reset — clears both consecutive failures and total repair turns.
 * Called when a new user message arrives (signaling fresh intent).
 */
export function reset(budget: RepairBudget): void {
  budget.consecutiveFailures = 0
  budget.totalRepairTurns = 0
}

/**
 * Check if the budget is currently exhausted without modifying state.
 */
export function isExhausted(budget: RepairBudget): boolean {
  return budget.consecutiveFailures >= budget.maxTurns
}

// ---------------------------------------------------------------------------
// Warning Formatting
// ---------------------------------------------------------------------------

export namespace RepairBudgetWarning {
  /**
   * Format a model-facing warning when the repair budget is exhausted.
   * Returns undefined if the budget is not exhausted.
   */
  export function format(budget: RepairBudget): string | undefined {
    if (!isExhausted(budget)) return undefined

    return [
      `⚠️ REPAIR BUDGET EXHAUSTED — ${budget.consecutiveFailures} consecutive failed verification cycles`,
      ``,
      `You have attempted ${budget.consecutiveFailures} self-healing repair turns without passing verification.`,
      `Total repair turns this session: ${budget.totalRepairTurns}`,
      ``,
      `STOP your current approach. You must:`,
      `1. Re-read the failing test output carefully — you may be misunderstanding the error`,
      `2. Consider whether your overall strategy is wrong, not just the implementation details`,
      `3. If in autonomous mode: report a blocker and let the user decide next steps`,
      `4. If not: explain what you've tried and ask the user for guidance`,
      ``,
      `Do NOT make another edit using the same strategy that has already failed ${budget.consecutiveFailures} times.`,
    ].join("\n")
  }
}
