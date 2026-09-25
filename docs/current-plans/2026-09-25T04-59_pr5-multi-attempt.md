# PR 5: Multi-Attempt Architecture (v1 Sequential)

**Task**: 2E-7
**Target implementer**: Gemini 3.8 Flash High
**Gate**: `fox run --attempts 3` produces 3 isolated attempts, selector picks the one with fewest regressions, result is a clean diff on original HEAD.
**Depends on**: PR 1 (exit + verify trusted), PR 2 (ACI), PR 4 (C/D fence-parse)

---

## Loop assertion enforced by this PR

1. Each attempt runs in its own git worktree. Mutations in attempt A are invisible to attempt B.
2. Each attempt uses the full PR 1 exit gate + verify cycle independently.
3. The selector runs AFTER all attempts complete. It does NOT choose mid-stream.
4. Empty-diff attempts (no mutations applied) are **discarded** before selection.
5. The winner's diff is cherry-picked (or applied as patch) onto the original HEAD. No merge commits.
6. Per-attempt timeout kills stuck attempts; remaining attempts continue.

## Non-goals / Do not break

- **Local-first, prefix stability, transactional apply**.
- No `--repro-first` in v1 (deferred to 2G-5).
- No parallel execution in v1 (sequential only, one attempt at a time).
- No LLM-based selection. Deterministic ranking only.
- Multi-attempt multiplies a broken loop — this PR is last because it relies on PR 1–4 producing useful single attempts.

---

## 1. CLI Entry — `fox run --attempts N`

### Modify [`src/foxcode/cli/run-drain.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/cli/run-drain.ts)

Add `--attempts` flag (default 1). When N > 1:
1. Record the original HEAD (`git rev-parse HEAD`).
2. Create N worktrees (`git worktree add`).
3. Run each attempt sequentially in its worktree.
4. Collect results.
5. Run selector.
6. Apply winner onto original HEAD.
7. Cleanup worktrees.

### Worktree creation

```typescript
async function createAttemptWorktree(projectDir: string, attemptIndex: number): Promise<string> {
  const worktreePath = path.join(os.tmpdir(), `fox-attempt-${process.pid}-${Date.now()}-${attemptIndex}`)
  await execGit(["worktree", "add", "--detach", worktreePath, "HEAD"], projectDir)
  return worktreePath
}
```

> **Note**: PID is included in the directory name to prevent collisions when multiple concurrent `fox run --attempts` invocations run on the same machine.

### Worktree cleanup safety

Register a `process.on('exit')` handler (and `SIGINT`/`SIGTERM`) that calls `git worktree prune` for any dangling worktrees:

```typescript
const pendingWorktrees: string[] = []
const cleanup = () => {
  for (const wt of pendingWorktrees) {
    try { fs.rmSync(wt, { recursive: true, force: true }) } catch {}
  }
  try { execSync(`git worktree prune`, { cwd: projectDir }) } catch {}
}
process.on('exit', cleanup)
process.on('SIGINT', () => { cleanup(); process.exit(1) })
process.on('SIGTERM', () => { cleanup(); process.exit(1) })
```

### Per-attempt timeout

Default: 5 minutes per attempt. Configurable via `--attempt-timeout`. Kill the attempt's session if it exceeds the timeout.

---

## 2. Attempt Executor — `src/session/attempt.ts` (new file)

### Per-attempt isolation

Each attempt gets:
- Its own worktree (filesystem isolation).
- Its own session (fresh conversation, fresh mutation journal, fresh repair budget).
- Same system prompt, same model, same tools.
- Its own harness commits (in the worktree's detached HEAD).
- The task (user message) is passed via environment: `FOX_WORKTREE_PATH` points to the attempt's worktree directory. The session reads `FOX_WORKTREE_PATH` (or falls back to `process.cwd()`) as its project root.

### Attempt result

```typescript
export interface AttemptResult {
  index: number
  worktreePath: string
  /** git diff from original HEAD to final state */
  diff: string
  /** Whether the attempt produced any mutations */
  hasMutations: boolean
  /** Verification pipeline result (if run) */
  verification?: PipelineResult
  /** Regression analysis against baseline */
  regressionAnalysis?: RegressionAnalysis
  /** Number of new regressions introduced */
  newRegressionCount: number
  /** Harness commits in this attempt */
  commits: string[]
  /** Total tokens consumed */
  totalTokens: number
  /** Elapsed time in ms */
  elapsedMs: number
  /** Exit reason from control plane */
  exitReason: string
}
```

### Sequential execution

```typescript
for (let i = 0; i < attempts; i++) {
  const worktree = await createAttemptWorktree(projectDir, i)
  try {
    const result = await runAttempt(worktree, i, task, model, timeout)
    results.push(result)
  } catch (e) {
    results.push(failedAttempt(i, e))
  } finally {
    await cleanupWorktree(worktree)  // deferred cleanup to after selection
  }
}
```

---

## 3. Deterministic Selector — `src/session/attempt-selector.ts` (new file)

### Selection algorithm (for N=3)

**Filter → Rank**:

1. **Filter out empty**: `hasMutations === false` → discard.
2. **Filter out worse-than-baseline**: `newRegressionCount > 0` AND no green commits → discard.
3. **Rank remaining** by:
   a. `newRegressionCount` ascending (fewer regressions = better).
   b. Verification `allPassed` boolean (green > red, among equal regression count).
   c. `totalTokens` ascending (cheaper = tiebreaker).

If all attempts are discarded (all empty or all worse): report failure with summary of what each attempt did. Do NOT apply any diff. Emit user-facing message:

```
All 3 attempts failed — no changes applied.
  Attempt 1: Empty (exit: empty exit retries exhausted)
  Attempt 2: 2 new regressions (exit: repair budget exhausted)
  Attempt 3: Empty (exit: max steps reached)
```

### Selection for N≥5 (deferred to v2)

Placeholder: cluster attempts by diff similarity (edit distance on unified diff). Pick the cluster with the most members, then rank within that cluster. Not implemented in v1 — falls back to the N=3 algorithm.

---

## 4. Winner Application

```typescript
async function applyWinner(projectDir: string, winner: AttemptResult): Promise<void> {
  // Apply the winner's diff as a patch onto the original HEAD
  const diffContent = winner.diff
  if (!diffContent.trim()) {
    throw new Error("Winner has empty diff — should have been filtered")
  }

  // Apply via git apply (preserves file modes, handles renames)
  await execGit(["apply", "--3way", "-"], projectDir, { stdin: diffContent })

  // Stage all changes
  await execGit(["add", "-A"], projectDir)
}
```

No merge commits. No cherry-pick (diffs may not have clean commits). Apply as patch directly.

---

## 5. Reporting

After selection, emit a summary:

```
─── Multi-Attempt Summary (3 attempts) ───
  Attempt 1: ❌ Empty (no mutations applied, exit: empty exit retries exhausted)
  Attempt 2: ✅ Winner (0 regressions, verification: all passed, 2 files changed)
  Attempt 3: ⚠️ 1 new regression (verification: failed, 1 file changed)

Winner: Attempt 2 — applied as patch onto HEAD.
─── End Multi-Attempt Summary ───
```

---

## Files Summary

| Action | File | Description |
|--------|------|-------------|
| **Create** | `src/session/attempt.ts` | Per-attempt execution with worktree isolation |
| **Create** | `src/session/attempt-selector.ts` | Deterministic filter+rank selection |
| **Modify** | `src/foxcode/cli/run-drain.ts` | `--attempts N` flag + `--attempt-timeout` flag, orchestration. Update `--help` output to document both flags. |
| **Modify** | `src/session/prompt/loop.ts` | Accept worktree path override via `FOX_WORKTREE_PATH` env var |

## Tests

1. `createAttemptWorktree` → creates detached worktree at HEAD, returns path.
2. `cleanupWorktree` → removes worktree and prunes `git worktree`.
3. Selector: 3 attempts (empty, green, 1-regression) → picks green.
4. Selector: 3 attempts all empty → returns failure, no diff applied.
5. Selector: 3 attempts all have regressions → picks fewest regressions.
6. Selector: tie-break on token count (cheaper wins).
7. Winner application: diff applied cleanly onto HEAD.
8. Winner application: empty diff → error, not applied.
9. Per-attempt timeout: stuck attempt killed, remaining continue.
10. Empty-diff filtering: attempt with zero mutations → discarded before selection.
11. `timeout 45s bun run typecheck` passes.
12. Integration: `fox run --attempts 3` on fixture → produces result, cleans up worktrees.
