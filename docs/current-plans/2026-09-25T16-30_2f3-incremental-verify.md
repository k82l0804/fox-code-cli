# 2F-3: Cheap-First Verify + Incremental Touch-Set

> **Loop assertion**: After a successful apply, the harness runs the cheapest verification stage that covers the change. Full suite runs once at loop exit, not after every edit.

---

## Goal

Make verification feedback proportional to what changed. Currently, the full verification pipeline runs after every mutation tool. This wastes 10–30s per edit on a full `bun run test` when a 200ms tree-sitter parse would have caught the error. Stage the pipeline: syntax → touched-file lint/tsc → full suite at exit.

## Key Code Locations

| File | Role |
|------|------|
| [`packages/core/src/verification.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/verification.ts) | `detectCommandPipeline()`, `executePipeline()`, `readPackageScripts()` |
| [`src/session/processor.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/processor.ts) | Post-mutation verification hook (line ~790), touch-set tracking |
| [`src/tool/syntax-gate.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/syntax-gate.ts) | Tree-sitter syntax check (2E-4) |
| [`src/session/prompt/loop.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt/loop.ts) | Exit-time verification (line ~429) |
| [`packages/core/src/repair-budget.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/repair-budget.ts) | Repair budget tracking |

## Proposed Changes

### 1. Touch-Set Tracker (`src/session/touch-set.ts` — new)

```typescript
export interface TouchSet {
  add(file: string): void
  files(): string[]
  clear(): void
  lastVerifyHead?: string  // commit hash of last full verify
}
```

Session-scoped. Updated by `processor.ts` after each successful mutation (same point where `journal.record()` is called).

### 2. 3-Stage Pipeline in `processor.ts`

**Stage 1 (on apply)**: Already done — `syntaxCheck()` in `syntax-gate.ts` runs inside `edit.ts` and `rewrite_file.ts`. No change needed.

**Stage 2 (on apply, after stage 1 passes)**: Run lint/tsc on **touched files only**:
- `tsc --noEmit <touched-files>` (TypeScript projects)
- `eslint <touched-files>` (if lint detected)
- Skip if no typecheck/lint commands detected by `detectCommandPipeline()`
- Format output as tool feedback (same as current)

**Stage 3 (at exit)**: Full verification pipeline. **Skip if**:
- `touchSet.lastVerifyHead` matches current `HEAD` (no new mutations since last full verify)
- Use `git rev-parse HEAD` to compare

### 3. Flake Retry

Before consuming a repair budget slot, retry a failed verification command once. If the retry passes, do NOT consume a budget slot. Track `lastFlakeRetried` to prevent infinite retries.

### 4. Wire into `resolveExitCondition()`

Add `freshVerify: boolean` to `ExitConditionState`. When true, skip exit-time verification entirely.

## Edge Cases

- File deleted by edit → remove from touch set
- Non-TS project with no lint/tsc → stage 2 is a no-op, stage 3 runs normally
- Multiple edits in one turn → touch set accumulates, stage 2 runs once per edit
- Flaky test passes on retry → budget not consumed, but log the flake

## Verification Plan

- Unit: touch-set add/clear/files
- Integration: edit one file → stage 2 runs tsc on that file only, not full project
- Integration: stage 3 skipped when last verify is fresh
- Integration: flake retry — first fail + second pass → no budget consumed
- Smoke: `bun run test:smoke` passes

## Non-Goals / Do Not Break

- Local-first: no network calls
- Prefix stability: no changes to system prompt or `sysCache` key
- Transactional apply: syntax gate stays per-tool, not per-pipeline
