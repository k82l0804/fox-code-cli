# Task 12: Blast-Radius Regression Detection

> **Status**: Ready for implementation
> **Implementer**: Gemini Flash 3.8 High
> **Depends on**: Task 1 (Multi-Command Auto-Verification Pipeline)
> **Estimated scope**: Medium — new baseline tracking module + integration into existing verification flow

## Background

The auto-verification pipeline ([`packages/core/src/verification.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/verification.ts)) already runs tests after mutations and reports pass/fail. But it cannot distinguish:

- **"I broke this"** — a test that was passing before the edit, now fails
- **"This was already broken"** — a test that was failing before the edit, still fails

This distinction is critical for the Guardian (Phase 3), which needs to know whether to blame the agent's mutations or to accept pre-existing failures as baseline noise.

### Current State

1. **`MUTATION_TOOLS`** ([verification.ts:78](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/verification.ts#L78)): Defines `edit`, `apply_patch`, `write`, `commit` as mutation triggers.

2. **`executePipeline`** ([verification.ts:523-548](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/verification.ts#L523-L548)): Runs typecheck → tests → lint and returns `PipelineResult` with per-command pass/fail and compressed output.

3. **Processor integration** ([processor.ts:609-671](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/processor.ts#L609-L671)): After each mutation tool call, runs the verification pipeline and appends feedback to the tool output. Also tracks repair budget and oscillation.

4. **Repair budget** ([`packages/core/src/repair-budget.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/repair-budget.ts)): Tracks consecutive failures. Exhaustion warning after N failures. Does *not* differentiate "new regression" from "pre-existing".

### The Gap

There is **no baseline snapshot** of test results. Every verification run is treated as if the project was in a clean state before the agent started. If the project already had 3 failing tests, the agent sees `❌ FAILED` on every mutation even if it didn't break anything.

## Proposed Changes

### New Module: Baseline Tracker

#### [NEW] `packages/core/src/verification-baseline.ts`

```typescript
/**
 * Verification Baseline Tracker
 *
 * Captures a snapshot of test/typecheck/lint results at session start
 * (before any mutations) and compares subsequent verification runs
 * against this baseline to distinguish new regressions from
 * pre-existing failures.
 */

export interface BaselineSnapshot {
  /** When the baseline was captured */
  readonly capturedAt: number
  /** Per-command results at baseline time */
  readonly results: ReadonlyArray<BaselineCommandResult>
  /** Whether the project was fully clean at baseline */
  readonly allPassed: boolean
}

export interface BaselineCommandResult {
  /** The command that was executed (e.g., "npm run test") */
  readonly command: string
  /** Whether the command passed */
  readonly passed: boolean
  /** Exit code */
  readonly exitCode: number
  /** Compressed output fingerprint (hash of failure output for comparison) */
  readonly failureHash: string | undefined
}

export interface RegressionAnalysis {
  /** Commands that were passing at baseline but now fail (agent broke them) */
  readonly newRegressions: ReadonlyArray<RegressionDetail>
  /** Commands that were already failing at baseline and still fail (not agent's fault) */
  readonly preExisting: ReadonlyArray<PreExistingDetail>
  /** Commands that were failing at baseline but now pass (agent fixed them) */
  readonly newFixes: ReadonlyArray<string>
  /** Whether the agent caused any new regressions */
  readonly hasNewRegressions: boolean
  /** Human-readable summary */
  readonly summary: string
}

export interface RegressionDetail {
  /** The command that regressed */
  readonly command: string
  /** Exit code at baseline (0 = was passing) */
  readonly baselineExitCode: number
  /** Current exit code */
  readonly currentExitCode: number
}

export interface PreExistingDetail {
  /** The command that was already failing */
  readonly command: string
  /** Whether the failure output is identical to baseline */
  readonly sameFailure: boolean
}
```

**Core functions:**

```typescript
/**
 * Capture a baseline snapshot from a pipeline result.
 * Called once at session start, before any mutations.
 */
export function captureBaseline(pipelineResult: PipelineResult): BaselineSnapshot

/**
 * Compare a verification run against the baseline to classify regressions.
 */
export function analyzeRegressions(
  baseline: BaselineSnapshot,
  current: PipelineResult,
): RegressionAnalysis

/**
 * Format regression analysis as model-facing feedback.
 */
export function formatRegressionFeedback(analysis: RegressionAnalysis): string
```

**Failure fingerprinting**: Use a hash of the compressed failure output to determine whether two failures are the "same" failure. If the failure hash matches baseline, it's pre-existing. If it differs, the agent likely introduced a new failure mode even if the same command was failing before.

```typescript
import { createHash } from "crypto"

export function hashFailureOutput(output: string): string {
  return createHash("sha256").update(output).digest("hex").slice(0, 16)
}
```

### Integration: Baseline Capture at Session Start

#### [MODIFY] [`src/session/processor.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/processor.ts)

Add baseline capture logic at session initialization. The baseline should be captured **once** per session, **before** the first user message is processed, using the same `detectCommandPipeline` + `executePipeline` flow.

```typescript
// In processor initialization (before the main loop):
let verificationBaseline: BaselineSnapshot | undefined

// At session start, capture baseline if auto_verify is enabled:
if (autonomousCfg?.auto_verify !== false) {
  const pipeline = Verification.detectCommandPipeline(scripts, overrides)
  if (pipeline.commands.length > 0) {
    const baselineResult = await Verification.executePipeline(pipeline, { cwd: projectDir, timeoutMs })
    verificationBaseline = VerificationBaseline.captureBaseline(baselineResult)
  }
}
```

**Performance concern**: Running tests at session start adds latency. Mitigate with:
1. **Config flag** `autonomous.capture_baseline` (default: `true` when `auto_verify` is enabled)
2. **Lazy capture**: If session start is too slow, capture the baseline on the *first* mutation tool call instead (the result of the first verification becomes the "pre-edit" baseline for subsequent calls). This is less pure but avoids startup latency.
3. **Cache**: Store the baseline in session state so it persists across compactions

### Integration: Regression Analysis in Verification Feedback

#### [MODIFY] [`src/session/processor.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/processor.ts#L633-L671)

In the auto-verification section (line 633+), after `executePipeline`, if a baseline exists, run `analyzeRegressions` and include the regression analysis in the feedback:

```typescript
if (verificationBaseline) {
  const analysis = VerificationBaseline.analyzeRegressions(verificationBaseline, pipelineResult)
  const regressionFeedback = VerificationBaseline.formatRegressionFeedback(analysis)
  if (regressionFeedback) {
    outputText = `${outputText}\n\n${regressionFeedback}`
  }
  // Only count new regressions against repair budget (not pre-existing)
  if (analysis.hasNewRegressions) {
    RepairBudgetTracker.recordFailure(budget)
  } else if (!pipelineResult.allPassed) {
    // Tests failed but all failures are pre-existing — don't penalize
    // Still report the failures but don't burn repair budget
  }
}
```

### Formatted Feedback

The regression feedback should look like:

```
─── Regression Analysis ───
🆕 NEW REGRESSIONS (agent-introduced):
  [❌ NEW] npm run typecheck (was ✅ passing, now exit 1)

📋 PRE-EXISTING (not caused by this edit):
  [⚠️ PRE] npm run test (was ❌ failing, still ❌ failing, same output)

✅ FIXED BY THIS EDIT:
  [🔧 FIX] npm run lint (was ❌ failing, now ✅ passing)

Summary: 1 new regression, 1 pre-existing failure, 1 fix
─── End Regression Analysis ───
```

### Config

#### [MODIFY] [`packages/core/src/v1/config/config.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/v1/config/config.ts#L375-L411)

Add to the `autonomous` section:

```typescript
capture_baseline: Schema.optional(Schema.Boolean).annotate({
  description:
    "Capture a verification baseline at session start to distinguish new regressions from pre-existing failures. Defaults to true when auto_verify is enabled.",
}),
```

### Tests

#### [NEW] `test/verification-baseline.test.ts`

1. **Baseline capture**: Given a PipelineResult with 2 passing + 1 failing command, produces correct BaselineSnapshot
2. **All-passing baseline**: Clean project produces `allPassed: true`
3. **New regression detection**: Baseline=passing, current=failing → `hasNewRegressions: true`, listed in `newRegressions`
4. **Pre-existing classification**: Baseline=failing, current=failing, same hash → listed in `preExisting` with `sameFailure: true`
5. **Pre-existing with different output**: Baseline=failing, current=failing, different hash → `preExisting` with `sameFailure: false`
6. **Fix detection**: Baseline=failing, current=passing → listed in `newFixes`
7. **Mixed scenario**: 1 new regression + 1 pre-existing + 1 fix → correct counts in summary
8. **No baseline**: When baseline is `undefined`, regression analysis is skipped (graceful degradation)
9. **Failure hash stability**: Same failure output → same hash; different output → different hash
10. **Feedback formatting**: Correct emoji, sections, and summary line in formatted output

### Edge Cases

1. **Flaky tests**: A test that passes at baseline but fails intermittently will be classified as a "new regression" even if the agent didn't cause it. This is acceptable for v1 — the Guardian (Phase 3) can add flaky-test detection later.

2. **Baseline capture timeout**: If the baseline run times out, capture what completed. Mark timed-out commands as `exitCode: 124` in the baseline.

3. **Project with no tests**: If `detectCommandPipeline` returns no commands, skip baseline capture entirely. `verificationBaseline` stays `undefined`.

4. **Session compaction**: The baseline must survive LLM context compaction. Store it as session-level state outside the message history.

5. **Repair budget interaction**: Only new regressions should burn repair budget. Pre-existing failures that the agent didn't cause should not count against the budget. This prevents the agent from being penalized for a project that was already broken.

## Verification Plan

### Automated Tests
```bash
timeout 30s CI=true bun test test/verification-baseline.test.ts
timeout 60s bun run test:smoke
timeout 45s bun run typecheck
```

### Manual Verification
- Run fox on a project with intentionally failing tests. Verify baseline captures the failures.
- Make an edit that breaks a previously-passing test. Verify the regression analysis correctly identifies it as "new."
- Make an edit that doesn't affect tests. Verify pre-existing failures are labeled correctly and don't burn repair budget.

> **Refinement pass**: Completed 2026-09-23. Constraint: "only new regressions burn repair budget" verified against RepairBudgetTracker.recordFailure/recordSuccess API — correct integration. Audit: MUTATION_TOOLS (edit, apply_patch, write, commit) fully listed. Baseline capture timing clarified (lazy-on-first-mutation option documented). Failure hash fingerprinting algorithm explicit (SHA-256, 16-char prefix). No renames. No issues found.
