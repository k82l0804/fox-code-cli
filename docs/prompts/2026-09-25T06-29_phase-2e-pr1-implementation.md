# Fox Code CLI — Phase 2E Implementation: PR 1 (Exit Gate + Verify + Commit + Control Plane)

You are implementing Phase 2E of the Fox Code CLI. 
Read and strictly adhere to the workspace instructions in `/home/k82l0804/workarea/fox/AGENTS.md` before taking any action.

---

### Core Guiding Principle (Rule 9 in AGENTS.md)
> **"The harness owns 'done', context, and the edit contract. The model is a text generator inside a deterministic loop."**
> - The model does NOT decide when to exit — `resolveExitCondition()` in `src/session/control-plane.ts` does.
> - The model does NOT decide what context it needs — the harness pre-localizes files and injects them.
> - The model does NOT decide the edit format — the harness selects tool-call (S/A/B) or fence-parse (C/D) based on tier.
> - The model does NOT commit — the harness commits after green verification.
> - **If a plan does not change `loop.ts`'s exit condition, it is not this project.**
> - Test against the 8B empty-exit trace, not SWE-bench with Opus.

---

### Immediate Scope: PR 1 Only
Do **NOT** skip ahead to PR 2–5 or jump into indexing / multi-attempt. Phase 2E is gated in strict dependency order:
```
PR 1 (Exit Gate + Verify + Commit + Control Plane) 
  └─► PR 2 (ACI Matrix + Grep Shape)
        └─► PR 3 (Code Context Block)
              └─► PR 4 (Weak-Model Fast Path)
                    └─► PR 5 (Multi-Attempt)
```

Read the full PR 1 plan first:
`fox-code-cli/docs/current-plans/2026-09-25T04-55_pr1-exit-gate-verify-commit.md`

---

### Critical Operational Rules (from AGENTS.md)
1. **Working Directory**: All commands run inside `/home/k82l0804/workarea/fox/fox-code-cli`.
2. **Never Trigger Prompts**: Always prefix git commands with `GIT_TERMINAL_PROMPT=0`.
3. **Non-Interactive Tests**: Always run test runners non-interactively with `CI=true`.
4. **Enforce Timeouts**: 
   - `timeout 45s bun run typecheck`
   - `timeout 60s bun run test:smoke`
   - `timeout 30s bun test <path>`
5. **No Unconstrained Traversal**: Never run bare `find .`, unconstrained `grep -r`, or un-timeouted commands from workspace roots.

---

### PR 1 Implementation Checklist

#### 1. Mutation Journal (`src/session/mutation-journal.ts`)
- [ ] Create `src/session/mutation-journal.ts` exporting `MutationEntry`, `MutationJournal`, and `createJournal()`.
- [ ] Append-only, session-scoped log of successful mutations (`edit`, `apply_patch`, `write`, `rewrite_file`).
- [ ] Explicit exclusions: `commit` tool does NOT count; tool errors / syntax rejections do NOT count; starts fresh per user message.
- [ ] Write unit tests in `test/mutation-journal.test.ts`.

#### 2. Unified Control Plane (`src/session/control-plane.ts`)
- [ ] Create `src/session/control-plane.ts` exporting `resolveExitCondition()` and `isCodeChangeTask()`.
- [ ] Pure decision function mapping `ExitConditionState` to `ExitDecision` (`continue` | `break` | `rollback`).
- [ ] Enforce the 5 priority rules:
  1. `isMaxSteps` → `break` (reason: "max steps reached")
  2. Not a code-change task (`!isCodeChangeTask`) → `break` (reason: "non-code task, exit normally")
  3. **Parse-fail circuit breaker** (`parseFailStreak >= maxParseFailStreak`, default 3):
     - Prevents Goose-style truncate → retry → 1000-turn livelock.
     - Returns `action: hasGreenCommit ? "rollback" : "break"`.
  4. Empty journal on code-change task (`journalEmpty`):
     - If `emptyExitRetries < maxEmptyExitRetries` (default 2) → `action: "continue"` with synthetic user-role reflection (`incrementEmptyExit: true`).
     - If retries exhausted → `action: "break"` with warning.
  5. Regression detected (`hasNewRegressions`):
     - If `repairBudgetExhausted` (default 3 cycles) → `action: hasGreenCommit ? "rollback" : "break"`.
     - Else → `action: "continue"` with regression feedback reflection.
  6. Mutations applied + verification passed/not-configured → `action: "break"`.
- [ ] Fail-open code-change heuristic (`CODE_CHANGE_OVERRIDE_WORDS`).
- [ ] Write unit tests in `test/control-plane.test.ts` covering all individual conditions and combination states.

#### 3. Core Export (`packages/core/src/verification.ts`)
- [ ] Export `executeVerification` (currently internal) so it can be called cleanly during exit verification.

#### 4. Processor Wiring (`src/session/processor.ts`)
- [ ] Add `mutationJournals = new Map<SessionID, MutationJournal>()` to the session-scoped maps in `SessionProcessor.make` (lines 196–200).
- [ ] Record mutations in `processor.ts` after line 719 (post-mutation verification block) using `extractMutationFilePaths()`.
- [ ] Implement `harnessCommit(projectDir, files, toolName)`: stages specific files (`git add`), checks for changes (`git diff --cached --quiet`), and commits (`git commit -m "fox: <toolName> <files>" --no-verify`) returning the short hash.
- [ ] Track harness commits per session (`Map<SessionID, ...>`) and tag them `green: true` when verification passes.

#### 5. Loop Exit Gate (`src/session/prompt/loop.ts`)
- [ ] Locate lines 217–238 in `src/session/prompt/loop.ts` where assistant finish without tool calls breaks out of the loop.
- [ ] Insert `resolveExitCondition()` before the `break`.
- [ ] If action is `"continue"`: inject synthetic user-role reflection (`sessions.updateMessage()`), increment counters, and `continue`.
- [ ] If action is `"rollback"`: reset workspace to last green harness commit.
- [ ] If action is `"break"`: execute existing exit logic.

#### 6. Integration & Smoke Tests
- [ ] Create `test/exit-gate.test.ts` and `test/exit-gate-smoke.test.ts`.
- [ ] Assert:
  - Code-change task + empty journal → reflection injected, loop continues.
  - Non-code task → clean exit.
  - Regressions detected → reflection injected with details.
  - Parse-fail streak = 3 → circuit breaker trips.
  - Harness commit created after successful mutation.
- [ ] Validate monorepo:
  ```bash
  timeout 45s bun run typecheck
  timeout 60s bun run test:smoke
  CI=true bun test test/mutation-journal.test.ts test/control-plane.test.ts test/exit-gate.test.ts
  ```

---

### Non-Goals for PR 1 (Do NOT Break)
- **Local-first**: No external network requests or telemetry.
- **Prefix stability**: Do NOT touch `sysCache` or modify system prompt structure. All harness feedback must be user-role reflection messages.
- **Transactional apply**: Do NOT alter how `edit` or `apply_patch` apply diffs.
- **Tool schemas**: Do NOT change tool definitions or schemas (that belongs in PR 2).
