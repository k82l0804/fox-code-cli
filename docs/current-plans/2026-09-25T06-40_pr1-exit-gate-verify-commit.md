# PR 1: Loop-Exit Gate + Verification Reflection + Harness Commit + Control Plane

**Tasks**: 2E-1, 2E-2, 2F-1, 2F-4
**Target implementer**: Gemini 3.8 Flash High
**Gate**: Re-run 8B Task 3 trace — must NOT exit on prose when the task required a code change.

---

## Loop assertions enforced by this PR

1. **`break` is illegal** when `intent.needsWriteTools === true` AND `mutationJournal.isEmpty()` AND `emptyExitRetries < max_empty_exit_retries`.
2. **`break` is illegal** when `mutationJournal.hasEntries()` AND `verificationPipeline.configured` AND `exitVerification.hasNewRegressions` AND `repairBudget.isExhausted === false`.
3. On exhaustion of any budget: keep current state and exit with warning. Rollback to last green **harness commit** only if one exists. Never rollback to pre-task and call it success.

## Non-goals / Do not break

- **Local-first**: No network calls added. No cloud services. No telemetry changes.
- **Prefix stability**: Do NOT modify `sysCache` structure. Do NOT inject content into the system prefix. All injections are user-role reflection messages.
- **Transactional apply**: Do NOT change how `edit` / `apply_patch` / `rewrite_file` apply mutations. The journal observes; it does not intercept.
- **Existing post-mutation verification**: The `MUTATION_TOOLS` trigger in `processor.ts` (lines 643–740) stays unchanged. This PR adds a **second** gate at loop exit.
- **Tool schemas**: Do NOT add or remove tools. That is PR 2.

---

## 1. Mutation Journal (`src/session/mutation-journal.ts`)

### What it is

A session-scoped, append-only log of successful mutations applied by the harness. Gate = "harness applied ≥1 successful mutation since the user message that started this goal."

### Interface

```typescript
export interface MutationEntry {
  readonly tool: string        // "edit" | "apply_patch" | "write" | "rewrite_file"
  readonly file: string        // absolute path
  readonly timestamp: number   // Date.now()
  readonly messageId: string   // assistant message that triggered the tool
}

export interface MutationJournal {
  /** All mutations since the current goal started. */
  readonly entries: MutationEntry[]
  /** True if at least one mutation was successfully applied. */
  isEmpty(): boolean
  /** Record a successful mutation. */
  record(entry: MutationEntry): void
  /** Reset on new user message (new goal). */
  reset(): void
  /** Count of unique files mutated. */
  fileCount(): number
}

export function createJournal(): MutationJournal
```

### Integration point

In [`processor.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/processor.ts), insert `journal.record()` **after** the post-mutation verification block completes (after line 719, inside the `if (Verification.MUTATION_TOOLS.has(value.name))` block at line 643, after oscillation + auto-verify have run). Call with the tool name and file paths extracted via existing `extractMutationFilePaths()` (lines 92–110). Record only when the tool completed successfully (no error in output).

The journal map is stored in `SessionProcessor.make`'s closure alongside the existing session-scoped maps (lines 196–200):

```typescript
// --- Autonomous Verification Layer: session-scoped state ---
const oscillationTrackers = new Map<SessionID, Oscillation.OscillationTracker>()    // line 196
const repairBudgets = new Map<SessionID, RepairBudgetTracker.RepairBudget>()         // line 197
const verificationBaselines = new Map<SessionID, VerificationBaseline.BaselineSnapshot>() // line 198
const turnCounters = new Map<SessionID, number>()                                    // line 200
const mutationJournals = new Map<SessionID, MutationJournal>()                       // ADD HERE
```

Key: `SessionID → MutationJournal`.

### Module exports

`src/session/mutation-journal.ts` must export `MutationEntry`, `MutationJournal`, and `createJournal`. Import in `processor.ts` as `import { createJournal, type MutationJournal } from "./mutation-journal"`.

### What does NOT count as a mutation

- `commit` tool — it changes git metadata, not files. Explicit exclusion: `if (value.name === "commit") skip journal`.
- Tool calls that error / are rejected by syntax gate — only successful applies.
- Pre-session dirt (`git diff` against nothing) — the journal starts empty on each user message.

---

## 2. Exit Gate in `loop.ts` (2E-1)

### Where to insert

In [`loop.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt/loop.ts) lines 217–238, the exit condition is:

```typescript
if (
  lastAssistantMsgRef?.finish &&
  !["tool-calls"].includes(lastAssistantMsgRef.finish) &&
  lastAssistantMsgRef.id !== input.resume &&
  !hasToolCalls &&
  lastAssistantMsgRef.parentID === lastUser.id &&
  userBeforeAssistant
) {
  // ... orphan check ...
  yield* Effect.logInfo("exiting loop", { "session.id": sessionID })
  break  // <-- THIS IS THE TARGET
}
```

### What to add before the `break`

```typescript
// --- Exit Gate: mutation check + verification ---
const exitDecision = yield* resolveExitCondition({
  sessionID,
  journal: getJournal(sessionID),
  userMessage: lastUser,
  toolSurface: toolDefCache,  // to know which edit tool is available
  tierInfo: effectiveTierInfo,
  verificationBaseline: verificationBaselines.get(sessionID),
  repairBudget: getRepairBudget(sessionID),
  emptyExitRetries: emptyExitCounters.get(sessionID) ?? 0,
  config: cfg,
})

if (exitDecision.action === "continue") {
  // Inject reflection as a user-role message
  yield* injectReflection(sessionID, exitDecision.reflectionText, sessions, msgs)
  if (exitDecision.incrementEmptyExit) {
    emptyExitCounters.set(sessionID, (emptyExitCounters.get(sessionID) ?? 0) + 1)
  }
  continue
}
if (exitDecision.action === "rollback") {
  // Rollback to last green harness commit (2F-1)
  yield* rollbackToLastGreen(sessionID, harnessCommits)
}

// Emit Wake-Up Audit on any terminal exit (break or rollback)
if (exitDecision.terminalState) {
  yield* Effect.logInfo(formatWakeUpAudit({
    terminalState: exitDecision.terminalState,
    sessionID,
    reason: exitDecision.reason,
    rollbackAnchor: getLastGreenCommitHash(sessionID),
    modifiedFiles: getJournal(sessionID).entries.map(e => e.file),
    failedStage: lastVerificationFailure(sessionID)?.stage,
    suggestedPrompt: buildSuggestedPrompt(exitDecision),
  }))
}
// exitDecision.action === "break" → fall through to existing break
```

### Intent classification — fail open

Use [`classifyIntent()`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/intent.ts) from `src/foxcode/intent.ts`. The existing `needsWriteTools` field (line 284) returns `false` for `research` and `docs` intents.

**Override rule** (fail open toward code-change): If ANY of `edit`, `rewrite_file`, `apply_patch` is in the current tool surface AND the user message contains any of: fix, add, refactor, implement, create, update, change, modify, remove, delete, failing, broken, bug, error → treat as code-change regardless of classifier confidence. This catches "the rate limiter tests are failing" which might be classified as `research` (matches "failing test" in fix rules, but also matches "find" in research rules).

```typescript
const CODE_CHANGE_OVERRIDE_WORDS = /\b(fix|add|refactor|implement|create|update|change|modify|remove|delete|failing|broken|bug|error)\b/i

function isCodeChangeTask(intent: IntentClassification, userText: string, hasEditTools: boolean): boolean {
  if (intent.needsWriteTools) return true
  if (hasEditTools && CODE_CHANGE_OVERRIDE_WORDS.test(userText)) return true
  return false
}
```

### Reflection message format

The reflection must be a **user-role message** (not tool-result append). It must name the allowed edit tool for this tier:

```typescript
function buildReflectionText(tierInfo: TierInfo, journal: MutationJournal): string {
  const editTool = tierInfo.tier === "C" || tierInfo.tier === "D" ? "rewrite_file" : "edit"
  return [
    "No files were modified. The task requires a code change.",
    `Please use the \`${editTool}\` tool to make the necessary changes.`,
    "Do not describe the changes — apply them directly.",
  ].join(" ")
}
```

### Injecting a user-role reflection

Create a synthetic user message via `sessions.updateMessage()` with role "user", similar to how `FoxSessionPrompt.askPlanFollowup` works (line 210–215). The message should have `parentID` set to the current assistant message so it appears in the conversation at the right position.

### `max_empty_exit_retries` (default 2)

Stored per-session in a `Map<SessionID, number>` alongside existing counters (lines 196–200). After N reflections with no mutation, allow exit with a warning log. Reset on new user message.

### Config key

Read from `cfg.autonomous?.max_empty_exit_retries ?? 2`. Document in `fox.jsonc`:

```jsonc
{
  "autonomous": {
    // Maximum times the harness will re-prompt a model that exits without
    // making any file changes on a code-change task. Default: 2.
    "max_empty_exit_retries": 2,
    // Maximum repair cycles after verification regressions. Default: 3.
    // (Already exists: max_repair_turns)
  }
}
```

---

## 3. Exit-Time Verification (2E-2)

### When to run

When the exit gate detects `journal.isEmpty() === false` AND a verification pipeline is configured (`cfg.autonomous?.auto_verify !== false`).

### Fresh-verify skip

Before running the pipeline, check if the last post-mutation-tool verification covers the same state:
- Track the last verification HEAD in a `Map<SessionID, { commitHash: string, pipelineResult: PipelineResult }>`.
- If no new mutations since the last post-mutation verify (journal's last entry timestamp < last verify timestamp), skip exit-time verification.

### Pipeline execution

Reuse existing `Verification.detectCommandPipeline()` and `Verification.executePipeline()` from [`verification.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/verification.ts). The pipeline already orders commands by priority (typecheck → test → lint per `detectCommandPipeline`, lines 156–250).

### Baseline comparison

Use existing [`VerificationBaseline.analyzeRegressions()`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/verification-baseline.ts) (line 93). Only block exit for `analysis.hasNewRegressions === true`. Pre-existing failures (`analysis.preExisting`) do NOT block.

### Reflection on failure

If `hasNewRegressions`:
1. Format via existing `Verification.formatPipelineFeedback()` + `VerificationBaseline.formatRegressionFeedback()`.
2. Inject as user-role reflection message (same mechanism as 2E-1).
3. Record failure via existing `RepairBudgetTracker.recordFailure()`.
4. `continue` the loop.

### Repair budget as hard cap

Wire existing [`RepairBudgetTracker`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/repair-budget.ts) into the exit decision. After `max_repair_turns` (default 3, from `cfg.autonomous?.max_repair_turns`) failed cycles:
- If a green harness commit exists (2F-1): rollback to it, exit with warning.
- If no green commit: keep current state, exit with warning.
- Never rollback to pre-task and report success.

### Flaky test retry

Before consuming a repair budget slot, retry a failed test command once:
```typescript
if (!result.passed) {
  const retry = await Verification.executeVerification(result.command, projectDir, timeout)
  if (retry.passed) {
    // Flake — do not consume budget, use retry result
    return retry
  }
}
```

---

## 4. Harness-Owned Commit (2F-1)

### What it does

After successful apply + (optional) green verification, the harness creates a git commit with a deterministic message. The model never invents `git commit`.

### Implementation

In [`processor.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/processor.ts), after a mutation tool succeeds AND post-mutation verification passes (or is skipped). Insert after `journal.record()` (see §1 integration point).

```typescript
async function harnessCommit(projectDir: string, files: string[], toolName: string): Promise<string | undefined> {
  // Stage the specific files first
  await execGit(["add", ...files], projectDir)

  // Check for actual staged changes
  const diffResult = await execGit(["diff", "--cached", "--quiet"], projectDir)
  if (diffResult.exitCode === 0) return undefined  // no changes → no commit

  const msg = `fox: ${toolName} ${files.map(f => path.basename(f)).join(", ")}`
  const result = await execGit(["commit", "-m", msg, "--no-verify"], projectDir)
  return result.stdout.match(/\b([0-9a-f]{7,})\b/)?.[1]  // return short hash
}
```

> **Note**: `git add` must come before `git diff --cached --quiet` — the original order checked the staging area before staging the files, which would always show no changes for unstaged edits.

### Harness commit tracker

`Map<SessionID, { commits: Array<{ hash: string, green: boolean, timestamp: number }> }>`.

- After green verification: mark commit as green.
- "Last green" = most recent commit with `green: true`.
- The 2E-7 selector will cherry-pick from these commits.

### Empty diff = no commit

If `git diff --cached --quiet` returns 0 (no changes), skip the commit. This is the 8B "committed unchanged files" cousin.

---

## 5. Unified Control Plane (2F-4)

### Module: `src/session/control-plane.ts`

One **pure function** that owns all exit decisions. Import `isCodeChangeTask()` from `src/session/control-plane.ts` — it lives here, not in `intent.ts`, because it combines intent + tool surface + override heuristic. Export both `resolveExitCondition` and `isCodeChangeTask` from this module.

```typescript
export type ExitAction = "continue" | "break" | "rollback"

/**
 * The 4 universal terminal states for unattended execution (from Guardian v5.0):
 * - "done": Plan/task satisfied, mutations applied, verification passed/approved
 * - "blocked": Human decision required (ambiguous spec, policy violation, design fork)
 * - "failed-safe": Circuit breaker / repair budget tripped; rolled back to green anchor
 * - "needs-review": Budget exhausted without a green commit; halted with wake-up audit
 */
export type TerminalState = "done" | "blocked" | "failed-safe" | "needs-review"

export interface ExitConditionState {
  isCodeChangeTask: boolean
  journalEmpty: boolean
  emptyExitRetries: number
  maxEmptyExitRetries: number       // default 2
  hasNewRegressions: boolean
  repairBudgetExhausted: boolean
  maxRepairTurns: number            // default 3
  hasGreenCommit: boolean
  isMaxSteps: boolean
  parseFailStreak: number           // consecutive identical tool-output parse failures
  maxParseFailStreak: number        // default 3 — circuit breaker
  // oscillation: reserved for future (2F-4 placeholder row)
}

export interface ExitDecision {
  action: ExitAction
  terminalState?: TerminalState
  reflectionText?: string
  incrementEmptyExit?: boolean
  reason: string
}

export function resolveExitCondition(state: ExitConditionState): ExitDecision {
  // 1. Max steps — highest priority
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

  // 2.5. Parse-fail circuit breaker (3-strike rule)
  // Prevents Goose-style truncate → retry → 1000-turn livelock.
  // If the last N consecutive tool outputs were identical parse failures,
  // the model is stuck in a loop and cannot recover.
  if (state.parseFailStreak >= state.maxParseFailStreak) {
    return {
      action: state.hasGreenCommit ? "rollback" : "break",
      terminalState: "failed-safe",
      reason: `parse-fail circuit breaker: ${state.parseFailStreak} identical failures`,
    }
  }

  // 3. No mutations — inject empty-exit reflection
  if (state.journalEmpty) {
    if (state.emptyExitRetries >= state.maxEmptyExitRetries) {
      return {
        action: "break",
        terminalState: "needs-review",
        reason: `empty exit retries exhausted (${state.maxEmptyExitRetries})`,
      }
    }
    return {
      action: "continue",
      reflectionText: "...",  // built by caller with tier info
      incrementEmptyExit: true,
      reason: "no mutations on code-change task",
    }
  }

  // 4. Mutations exist but verification failed with new regressions
  if (state.hasNewRegressions) {
    if (state.repairBudgetExhausted) {
      return {
        action: state.hasGreenCommit ? "rollback" : "break",
        terminalState: state.hasGreenCommit ? "failed-safe" : "needs-review",
        reason: `repair budget exhausted (${state.maxRepairTurns} cycles)`,
      }
    }
    return {
      action: "continue",
      reflectionText: "...",  // built by caller with verify output
      reason: "new regressions detected",
    }
  }

  // 5. Mutations exist, verification passed (or not configured) — exit cleanly
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
```

### Combination tests required

- Empty exit + verify fail in same turn: should not double-count budgets.
- Verify fail + budget exhausted + green commit exists → rollback.
- Verify fail + budget exhausted + no green commit → break with warning.
- Max steps overrides everything.
- Non-code task always exits normally.
- `isCodeChangeTask` with `journalEmpty` + `emptyExitRetries === 0` → continue with reflection.
- `isCodeChangeTask` with `journalEmpty` + `emptyExitRetries === 2` → break with warning.
- Parse-fail streak = 3 + green commit → rollback.
- Parse-fail streak = 3 + no green commit → break with warning.
- Parse-fail streak = 2 → continue (not yet at threshold).

---

## Files Summary

| Action | File | Description |
|--------|------|-------------|
| **Create** | `src/session/mutation-journal.ts` | Append-only mutation log, session-scoped |
| **Create** | `src/session/control-plane.ts` | Unified `resolveExitCondition()` function |
| **Modify** | `src/session/prompt/loop.ts` (lines 217–238) | Insert exit gate before `break` |
| **Modify** | `src/session/processor.ts` (line ~643) | Record mutations to journal; harness commit after successful apply |
| **Modify** | `packages/core/src/verification.ts` | Export `executeVerification` for exit-time use (already exists as internal, just export) |

## Verification Plan

### Unit tests (`test/`)
1. `mutation-journal.test.ts` — record, isEmpty, reset, fileCount. Commit does not count. Fence-parse source accepted.
2. `control-plane.test.ts` — all 7 conditions individually + 7 combinations (see above). Includes parse-fail circuit breaker at streak=3.
3. `exit-gate.test.ts` — mock session where model finishes without mutations on code-change task → reflection injected with correct tool name for tier. Non-code task exits normally.
4. Intent override: "the rate limiter tests are failing" → `isCodeChangeTask` returns true.
5. `isCodeChangeTask` with `intent === "research"` + no edit tools → returns false.
6. Parse-fail circuit breaker: 3 identical tool parse failures → break. 2 → continue.

### Full-stack smoke test
- `test/exit-gate-smoke.test.ts` — runs the full loop against a tiny fixture repo with a fabricated session. Asserts:
  - Code-change task with empty journal → reflection injected (not exit).
  - Non-code task → clean exit.
  - Verification fail → reflection injected with regression details.
  - Budget exhaustion → exit with warning.

### Typecheck + existing tests
- `timeout 60s bun run test:smoke`

### Manual gate test
- Replay frozen 8B empty-exit transcript against fixture repo → must NOT exit on prose.
