# Plan: Multi-Command Auto-Verification Pipeline

> **Task**: Phase 2A #1 from [`current-tasks.md`](../master-plan/current-tasks.md)
> **Goal**: Extend `verification.ts` to run typecheck → tests → lint as a configurable sequence instead of only the single best-priority command.

## Background

Today, [`verification.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/verification.ts) (346 lines) detects verification commands from `package.json` and runs **only the single highest-priority one** via `detectBestCommand()`. The integration in [`processor.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/processor.ts#L633-L667) calls `detectBestCommand()` → `executeVerification()` → appends feedback.

This means if a project has both `test` and `typecheck` scripts, only `test` runs. The LLM never sees typecheck failures, which are faster to detect and cheaper to fix.

## Proposed Changes

### 1. [MODIFY] [`packages/core/src/verification.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/verification.ts)

**Add `detectCommandPipeline()` function** (new, ~30 lines):

```typescript
export interface VerificationPipeline {
  readonly commands: VerificationCommand[]
  readonly strategy: "sequential" | "all"
}

/**
 * Detect all verification commands and return them as an ordered pipeline.
 * The pipeline runs commands in priority order (typecheck before tests before lint).
 * 
 * @param scripts - package.json scripts object
 * @param overrides - User-configured command overrides from fox.jsonc
 * @returns Pipeline of commands to execute in order
 */
export function detectCommandPipeline(
  scripts: Record<string, string> | undefined | null,
  overrides?: {
    test_command?: string | null
    typecheck_command?: string | null
    lint_command?: string | null
  },
): VerificationPipeline
```

Logic:
- If any overrides are set, use them (priority 0)
- Otherwise, scan `package.json` for `typecheck`, `test`, `lint` scripts
- Return all found commands sorted by priority (typecheck=3, test=1, lint=7 — reorder so typecheck first since it's fastest)
- `detectBestCommand()` remains for backward compatibility — calls `detectCommandPipeline().commands[0]`

**Add `executePipeline()` function** (new, ~40 lines):

```typescript
export interface PipelineResult {
  readonly results: VerificationResult[]
  readonly allPassed: boolean
  readonly firstFailure: VerificationResult | undefined
  readonly totalElapsedMs: number
}

/**
 * Execute a verification pipeline. Runs commands in order.
 * With "sequential" strategy, stops at first failure.
 * With "all" strategy, runs all commands regardless.
 */
export async function executePipeline(
  pipeline: VerificationPipeline,
  options: VerificationExecutionOptions,
): Promise<PipelineResult>
```

**Add `formatPipelineFeedback()` function** (new, ~20 lines):
- Formats all results into a single feedback block
- Shows pass/fail for each command
- Only includes compressed output for failed commands

### 2. [MODIFY] [`packages/core/src/v1/config/config.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/v1/config/config.ts)

Add to the `autonomous` schema (after line 365):

```typescript
typecheck_command: Schema.optional(Schema.NullOr(Schema.String)).annotate({
  description: "Override the auto-detected typecheck command. Defaults to null (auto-detect).",
}),
lint_command: Schema.optional(Schema.NullOr(Schema.String)).annotate({
  description: "Override the auto-detected lint command. Defaults to null (auto-detect).",
}),
verification_strategy: Schema.optional(Schema.Literal("sequential", "all")).annotate({
  description: "Pipeline strategy: 'sequential' stops at first failure, 'all' runs everything. Defaults to 'sequential'.",
}),
```

### 3. [MODIFY] [`src/session/processor.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/processor.ts#L633-L667)

Replace the `detectBestCommand` → `executeVerification` block (lines 633-667) with:

```typescript
// --- Multi-command verification pipeline ---
const pipeline = Verification.detectCommandPipeline(scripts, {
  test_command: autonomousCfg?.test_command,
  typecheck_command: autonomousCfg?.typecheck_command,
  lint_command: autonomousCfg?.lint_command,
})
if (pipeline.commands.length > 0) {
  const strategy = autonomousCfg?.verification_strategy ?? "sequential"
  const pipelineResult = yield* Effect.promise(() =>
    Verification.executePipeline(
      { ...pipeline, strategy },
      { cwd: projectDir, timeoutMs },
    ),
  )
  const feedback = Verification.formatPipelineFeedback(pipelineResult)
  outputText = `${outputText}\n\n${feedback}`
  // Update repair budget based on pipeline outcome
  // ...existing repair budget logic using pipelineResult.allPassed...
}
```

### 4. [MODIFY] [`test/verification.test.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/test/verification.test.ts)

Add new test category for pipeline (445 existing lines → ~550 after):

| Test | Scenario | Expected |
|------|----------|----------|
| `detectCommandPipeline returns all commands` | scripts has test + typecheck + lint | 3 commands in priority order |
| `detectCommandPipeline with overrides` | typecheck_command override set | Override at priority 0 |
| `detectCommandPipeline empty scripts` | no scripts | Empty pipeline |
| `executePipeline sequential stops on failure` | typecheck fails | Only 1 result, allPassed=false |
| `executePipeline all runs everything` | typecheck fails, test passes | 2 results |
| `formatPipelineFeedback multi-result` | 2 pass, 1 fail | Shows all statuses, only fail output |
| `backward compat: detectBestCommand unchanged` | existing tests | Still pass |

## Verification

```bash
# Run existing + new verification tests
CI=true timeout 30s bun test test/verification.test.ts --timeout 30000

# Typecheck
timeout 45s bun run typecheck

# Smoke
timeout 60s bun run test:smoke
```

## Architecture Notes

- `verification.ts` is in `packages/core/` — pure functions, no Effect dependencies
- `processor.ts` wraps calls in `Effect.promise()` — keep this pattern
- The `repair-budget.ts` integration uses `verifyResult.passed` — update to use `pipelineResult.allPassed`
- Priority ordering should be: typecheck (fastest) → lint → test (slowest) for "sequential" strategy
