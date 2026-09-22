# Autonomous SWE Agent — Reference Architecture

> **Purpose**: Define the _ideal_ autonomous software engineering agent loop
> as a target architecture. Fox doesn't need to implement every capability
> today — this spec charts the destination so we know where we're heading
> and can measure progress.
>
> **Influences**: This spec synthesizes the inner-loop mechanics (oscillation
> detection, confidence scoring, LLTC compression) with the outer-loop
> discipline of spec-driven, gated workflows (see
> [`2026-09-22T15-16_opinion-ideal-sw-agent-workflow.md`](./2026-09-22T15-16_opinion-ideal-sw-agent-workflow.md)
> for the research backing the spec-centric approach).

---

## Core Principles

- **Spec is king** — For non-trivial goals, the agent elaborates the goal
  into a structured specification with explicit acceptance criteria before
  touching code. The spec is the source of truth, not the code.
- **Small, verifiable units of work** — Complex goals are decomposed into
  tasks sized for 15–45 minutes of agent work, each independently testable.
- **Tight feedback loops** — Tests, type-checkers, linters, and acceptance
  criteria act as the primary oracle. Every mutation is verified before
  the agent moves on.
- **Human ownership of the outer loop** — Humans set intent, approve specs
  and plans, and gate high-risk transitions (review before ship). The agent
  owns the inner loop (implement → verify → self-correct).
- **Explicit boundaries** — Permission policies (always / ask-first / never)
  prevent the agent from wandering. Sandboxed execution limits blast radius.
- **Observability & auditability** — Every step produces structured artifacts:
  specs, plans, diffs, verification results, decision logs, snapshots.

---

## Overview

An autonomous SWE agent operates as a closed-loop controller that receives
a goal, iteratively mutates code, verifies the result, and self-corrects
until the goal is met or it determines it cannot proceed safely. The loop
has eleven phases, organized into three macro-stages:

```
┌─ ORIENT ──────────────────────────────────────────────┐
│  0. Session Initialization                            │
│  1. Goal Intake + Context Discovery                   │
│  1.5. Specification Elaboration (for non-trivial goals)│
│  2. Mutation Planning + Task Decomposition            │
├─ ACT ─────────────────────────────────────────────────┤
│  3. Mutation Application (atomic, validated)          │
│  4. Auto-Verification Pipeline                        │
├─ ASSESS ──────────────────────────────────────────────┤
│  5. Failure Analysis (oscillation, regression, budget) │
│  6. Routing Decision (model tier selection)           │
│  7. Context Management (supersession + compaction)    │
│  8. Success Path (verify → review gate → ship)        │
│  9. Failure Path (loop back to Phase 2)               │
└───────────────────────────────────────────────────────┘
```

---

## Phase 0 — Session Initialization

Set up the agent's operating environment before any goal is processed.

| Capability | Description |
|---|---|
| **System prefix loading** | Load a stable system prompt with tool definitions. The prefix must be byte-identical across turns so providers can cache the KV-cache prefix and avoid redundant prefill computation. |
| **Tool registry** | Register all available tools (file I/O, shell, search, patch, etc.) with their schemas. No repo maps or large context blobs in the system prompt. |
| **Snapshot baseline** | Initialize the workspace snapshot system. Record the clean state of the working tree so any mutation can be rolled back to this baseline. |
| **Repair budget + state** | Initialize per-session mutable state: repair budget counter (consecutive failures = 0), oscillation tracker (empty history), doom-loop detector (no recent calls). |
| **Permission policy** | Load permission rules (allow/deny lists, auto-approve mode if `--auto`). Determines which tools the agent can invoke without human confirmation. |
| **Execution sandbox** | Isolate the agent's execution environment: dedicated worktree, container, or sandbox. Prevents mutations from affecting the user's primary working tree until explicitly committed. Limits blast radius of runaway commands. |

---

## Phase 1 — Goal Intake + Context Discovery

The agent receives a goal and builds the minimal context window needed to
reason about it.

| Capability | Description |
|---|---|
| **Goal parsing** | Accept natural-language goals: "fix failing test X", "implement feature Y", "refactor module Z". Extract intent, scope, and success criteria. |
| **File discovery** | Use `grep`, `glob`, and `read` to find files relevant to the goal. Search for error messages, function names, import chains. |
| **AST / symbol index** | Query a language-aware symbol index (`lookup_symbols`, `find_references`, `go_to_definition`) to understand type hierarchies, call graphs, and dependency chains. This gives the agent structural understanding, not just text matches. |
| **Dependency graph** | Resolve which modules depend on the target files. Understand blast radius before planning mutations. |
| **Minimal context assembly** | Build a context window containing only the files and symbols needed for the current step. Avoid loading the entire repo. Prefer targeted reads over broad dumps. |

**Ordering**: Goal → File discovery → Symbol/AST queries → Dependency analysis → Minimal context window.

---

## Phase 1.5 — Specification Elaboration

For non-trivial goals, the agent co-creates a structured specification with
the human before planning code changes. Trivial goals (typo fixes, simple
bug fixes with clear reproduction) can skip this phase.

| Capability | Description |
|---|---|
| **Complexity assessment** | Evaluate whether the goal is trivial (skip to Phase 2) or non-trivial (requires a spec). Heuristics: number of files affected, cross-module changes, ambiguous requirements, new feature vs. bug fix. |
| **Spec generation** | Expand the goal into a structured specification covering: (1) clear objective, (2) behavioral description (inputs → outputs → side effects), (3) constraints & boundaries (off-limits files, required patterns), (4) integration points, (5) acceptance criteria. |
| **Acceptance criteria definition** | Define explicit, machine-checkable pass/fail conditions. These go beyond "tests pass" — they describe the observable behavior the goal demands. Examples: "endpoint returns 200 with body matching schema X", "no regressions in test suite Y", "type-check passes with zero errors". |
| **Human review gate** | Present the spec to the human for approval before proceeding. The spec is the contract — the agent should not start coding until the human agrees on what "done" looks like. In fully autonomous mode (`--auto` + `/goal`), this gate can be relaxed. |
| **Living spec updates** | When requirements change mid-session (user sends new context or corrections), update the spec rather than layering ad-hoc prompt adjustments. The spec remains the single source of truth. |

**Ordering**: Assess complexity → Generate spec → Define acceptance criteria → Human approval → Proceed.

> The spec prevents the "house of cards" failure mode where the agent
> builds layer upon layer of code before discovering the foundation
> was wrong. Validating the spec is cheaper than validating the code.

---

## Phase 2 — Mutation Planning + Task Decomposition

Before touching code, the agent produces a structured edit plan. For complex
goals, decompose into small, independently verifiable tasks.

| Capability | Description |
|---|---|
| **Structured edit plan** | The reasoning model generates a concrete plan: which files to modify, what changes to make, and why. Not free-form text — structured enough that the agent can evaluate it against the spec's acceptance criteria. |
| **Affected file identification** | Enumerate every file the plan will touch. Cross-reference against the dependency graph to predict transitive impact. |
| **Side-effect prediction** | Identify expected side effects: type errors in downstream files, test failures that need updating, import path changes. |
| **Verification impact prediction** | Predict which tests will be affected and whether the verification step will need additional setup (e.g., test fixtures, environment variables). |
| **Task decomposition** | For complex goals, decompose into ordered sub-tasks. Each task should be: (1) scoped to ~15–45 minutes of agent work, (2) independently verifiable against specific acceptance criteria, (3) ordered so dependencies are satisfied (foundation → core logic → interface → polish). Plan snapshot checkpoints between sub-tasks. |
| **Plan-spec consistency check** | Validate that the plan addresses all acceptance criteria from the spec. Reject plans that leave acceptance criteria unaddressed. |

**Ordering**: Plan → Predict side effects → Decompose into tasks → Validate against spec → Prepare verification.

---

## Phase 3 — Mutation Application (Atomic)

Apply the planned changes to the working tree with safety guarantees.

| Capability | Description |
|---|---|
| **Patch generation** | Generate the edit as a unified diff or structured patch. The patch format must be unambiguous — no reliance on fuzzy matching when exact matching is possible. |
| **Syntactic confidence scoring** | Before applying, dry-run the patch and score each hunk's match quality (exact, trailing-whitespace-normalized, fully-normalized). Assign an aggregate confidence score to the entire transaction. |
| **Confidence gating** | If confidence is below threshold (e.g., < 70%), reject the patch and feed the low-confidence hunks back to the model for correction. Don't apply uncertain edits. |
| **Atomic application** | Apply the patch all-or-nothing. If any hunk fails to apply, roll back the entire transaction. No partial edits. |
| **Snapshot checkpoint** | After successful application, create a snapshot checkpoint so this exact state can be restored later. Every mutation produces a checkpoint. |

**Ordering**: Generate → Dry-run + Score → Gate → Apply atomically → Snapshot.

> If the agent applies patches _before_ confidence scoring or _without_
> creating a snapshot, that's a bug.

---

## Phase 4 — Auto-Verification Pipeline

Immediately after mutation, run automated verification to check correctness.

| Capability | Description |
|---|---|
| **Test command detection** | Auto-detect the project's test command from `package.json` scripts, `Makefile`, `Cargo.toml`, etc. Priority order: `test` > `test:check` > `typecheck` > `check` > `lint`. Allow user override via config. |
| **Execution with timeout** | Execute the test command as a child process with a hard timeout (default: 30s, configurable). Capture stdout + stderr. Kill the process on timeout. |
| **Output compression** | Compress raw test output through a pipeline before feeding it to the model: strip passing test lines, collapse consecutive pass runs, relativize absolute paths, deduplicate repeated log lines, keep only failure lines + stack traces. |
| **Structured result** | Produce a structured `VerificationResult`: passed/failed, exit code, compressed output, whether output was truncated, elapsed time. |
| **Typecheck integration** | Run type-checker (e.g., `tsc --noEmit`) alongside or instead of tests when appropriate. Type errors caught early avoid wasted test runs. |
| **Lint integration** | Run linter after mutation to catch style/correctness issues the agent introduced. Feed violations back as structured feedback. |
| **Multi-command verification** | For projects with multiple verification steps (typecheck + test + lint), run them in priority order. Short-circuit on first failure to save time, or run all for a complete picture. |
| **Acceptance criteria check** | Beyond "tests pass," verify the mutation against the spec's acceptance criteria. Check that the observable behavior matches what was specified. For machine-checkable criteria (endpoint returns 200, output matches schema), run the checks automatically. For human-judgment criteria, flag for review. |

**Ordering**: Detect command → Execute with timeout → Compress output → Structure result → Check acceptance criteria.

> If the agent feeds raw, uncompressed test output to the model, it
> wastes context window tokens on noise (passing tests, absolute paths,
> ANSI codes). Always compress first.

---

## Phase 5 — Failure Analysis

When verification fails, analyze the failure before attempting a fix.

| Capability | Description |
|---|---|
| **Oscillation detection** | Track SHA-256 content hashes per file across a sliding window of turns. Detect A→B→A toggle patterns where the agent repeatedly flips code between alternating states. When detected, emit a `⚠️ OSCILLATION DETECTED` warning and force the agent to try a fundamentally different approach. |
| **Doom-loop detection** | Detect when the agent makes N identical consecutive tool calls with the exact same inputs (distinct from oscillation, which tracks file content outcomes). Block the call and require a different approach. |
| **Regression detection** | Compare current test results against the baseline. Identify tests that _were_ passing before the agent's changes and now fail. Distinguish regressions (agent broke something) from pre-existing failures (already broken). |
| **Repair budget tracking** | Count consecutive failed verification cycles. When the budget is exhausted (default: 3 consecutive failures), emit a `⚠️ REPAIR BUDGET EXHAUSTED` warning and instruct the agent to stop its current approach. The budget resets on success or new user message. |
| **Failure classification** | Categorize the failure: syntax error, type error, test assertion failure, timeout, runtime exception, environment issue. Different categories warrant different repair strategies. |

**Ordering**: Oscillation check → Doom-loop check → Regression analysis → Budget check → Classify failure.

> The analysis phase must run _before_ routing decisions. The agent
> needs to understand the failure type before deciding which model or
> strategy to use for repair.

---

## Phase 6 — Routing Decision

Select the appropriate model tier and strategy based on failure analysis.

| Capability | Description |
|---|---|
| **Failure-based routing** | Simple failures (typos, syntax errors, missing imports) → fast/cheap model. Architectural failures (wrong approach, design mismatch) → reasoning model. Persistent failures (oscillation, budget warnings) → escalate to highest-tier model. |
| **Model tier escalation** | If the current model has failed to fix the issue across multiple attempts, automatically escalate to a more capable (and more expensive) model. Track escalation history to avoid infinite escalation. |
| **Strategy switching** | When oscillation is detected, don't just retry — switch to a qualitatively different approach. Read the failing file fresh, re-analyze the error, consider alternative solutions. |
| **Human escalation** | When the repair budget is exhausted and model escalation hasn't helped, stop and present the situation to the user: what was attempted, why it failed, what the agent recommends. |
| **Cost-aware routing** | Factor in token cost when routing. Don't use an expensive reasoning model for a simple typo fix. Track cumulative cost across the session. |

**Ordering**: Analyze failure → Select model tier → Select strategy → Execute (or escalate to human).

---

## Phase 7 — Context Management

Keep the context window lean and relevant across multiple loop iterations.

| Capability | Description |
|---|---|
| **Tool output supersession** | When a file is modified (via edit/write/patch), supersede all earlier `read` outputs for that same file. The model doesn't need to see stale file contents — replace them with a compact marker: `[File content superseded — path was modified by edit]`. |
| **Git status supersession** | Supersede git status/diff/branch outputs when the working tree changes. Stale git state is misleading. |
| **History pruning** | Remove stale context from the conversation: old tool outputs beyond the last few turns, obsolete reasoning, superseded reads. Keep only: current goal, last verification output, relevant file contents. |
| **LLM-based compaction** | When the context window approaches the model's limit, trigger a compaction: summarize the conversation history into a condensed form using an LLM, then replace the full history with the summary + recent turns. Preserve the tail (most recent turns) in full fidelity. |
| **Overflow detection** | Monitor token usage against the model's context limit. Trigger compaction proactively (before hitting the limit), not reactively (after an API error). |

**Ordering**: Supersede stale outputs → Prune old turns → Compact if approaching limit → Continue.

> An agent that keeps _all_ history across many iterations will hit
> context limits and degrade in quality. Aggressive, intelligent pruning
> is essential for long-running autonomous sessions.

---

## Phase 8 — Success Path

When verification passes, finalize and present the result. Includes a
review gate before shipping.

| Capability | Description |
|---|---|
| **Verification confirmation** | Confirm that all verification checks passed (tests, typecheck, lint) and all acceptance criteria are met. |
| **Solution presentation** | Present the verified changes to the user: summary of what changed, which files were modified, what tests pass, which acceptance criteria are satisfied. |
| **Review gate** | Before committing, present the diff for human review (or a specialized review agent). The review covers: correctness, security implications, style consistency, and whether the changes match the spec. In fully autonomous mode, the review gate can be relaxed to a post-commit review or automated review agent. |
| **Commit offering** | After review approval, offer to commit the changes to the user's branch with a generated commit message. Update the spec if the implementation revealed necessary spec changes. Don't commit without permission (unless `--auto`). |
| **Goal completion** | If operating under a goal (`/goal` mode), report the goal as complete with a concrete reason. |
| **Snapshot preservation** | Keep the final snapshot so the user can revert if desired. |

**Ordering**: Verify → Present → Review gate → Commit → Report goal complete → End loop.

---

## Phase 9 — Failure Path

When verification fails and the agent is authorized to continue, loop back.

| Capability | Description |
|---|---|
| **Compressed trace injection** | Feed the compressed failure output + any warnings (oscillation, budget) into the next turn's context. |
| **Strategy adjustment** | Based on the failure analysis from Phase 5, adjust the approach before looping back to Phase 2. |
| **Budget decrement** | Update the repair budget. If exhausted, stop the loop and escalate. |
| **Loop back** | Return to Phase 2 (Mutation Planning) with the new context. |

**Ordering**: Inject failure context → Adjust strategy → Check budget → Loop to Phase 2.

---

## The Complete Loop (Condensed)

```
AUTONOMOUS SWE LOOP — REFERENCE ARCHITECTURE

 0. Initialize (prefix, tools, snapshots, budgets, permissions, sandbox)
 1. Receive goal → discover context → AST/symbol queries → minimal window
 1.5. Elaborate spec (for non-trivial goals) → acceptance criteria → human approval
 2. Plan mutation (structured plan, side-effect prediction, task decomposition)
 3. Apply mutation (generate → confidence-score → gate → apply → snapshot)
 4. Auto-verify (detect command → execute w/ timeout → compress → check acceptance criteria)
 5. Failure analysis (oscillation → doom-loop → regression → budget → classify)
 6. Routing decision (fast model / reasoning / escalate / human)
 7. Context management (supersede → prune → compact if needed)
 8. If success → present → review gate → commit → report goal
 9. If failure → inject compressed trace → adjust strategy → loop to 2
```

---

## Fox Parity Matrix

How Fox currently stands against each capability in the reference architecture.

### Legend

| Status | Meaning |
|---|---|
| ✅ | Implemented and tested |
| 🔧 | Partially implemented or limited |
| ❌ | Not yet implemented |

---

### Phase 0 — Session Initialization

| Capability | Status | Fox Implementation | Notes |
|---|---|---|---|
| System prefix loading | ✅ | `prompt.ts` | Stable system prompt built per session. KV-cache prefix freezing is experimental (`FOX_EXPERIMENTAL_COMPRESS`). |
| Tool registry | ✅ | `tool.ts`, `tools.ts` | `Tool.make()` + `Tools.Service` with Location-scoped overrides. |
| Snapshot baseline | ✅ | `snapshot/index.ts` | Git-based hidden worktree (`.git/opencode`). `Snapshot.track()` / `Snapshot.restore()`. 7-day retention, 2MB limit. |
| Repair budget + state | ✅ | `repair-budget.ts`, `oscillation.ts` | Per-session trackers initialized in `processor.ts`. |
| Permission policy | ✅ | `permission/index.ts` | `--auto` / `--yolo` flags for auto-approve. Granular allow/deny per tool + pattern. |
| Execution sandbox | 🔧 | `snapshot/index.ts` | Snapshot system provides rollback, but no true container/sandbox isolation. Mutations happen in the user's working tree. |

---

### Phase 1 — Goal Intake + Context Discovery

| Capability | Status | Fox Implementation | Notes |
|---|---|---|---|
| Goal parsing | ✅ | `goal/` | `/goal` command with `goal_report` tool. Active/paused/complete/blocked states. |
| File discovery | ✅ | `grep.ts`, `glob.ts`, `read.ts` | Standard file discovery tools. |
| AST / symbol index | ❌ | — | No `lookup_symbols`, `find_references`, or `go_to_definition`. Context discovery is text-only (grep/glob/read). |
| Dependency graph | ❌ | — | No import/dependency graph resolution. Can't predict blast radius from structure. |
| Minimal context assembly | 🔧 | Agent-driven | LLM decides what to read. No automated "minimal context" assembly — depends on model's judgment. |

---

### Phase 1.5 — Specification Elaboration

| Capability | Status | Fox Implementation | Notes |
|---|---|---|---|
| Complexity assessment | ❌ | — | No automated complexity assessment to decide whether a spec is needed. |
| Spec generation | 🔧 | Agent-driven | Models can generate specs in their reasoning, but no platform-level spec schema or enforcement. |
| Acceptance criteria definition | ❌ | — | No structured acceptance criteria format. Goal completion is agent-reported via `goal_report`, not criteria-checked. |
| Human review gate | 🔧 | Permission system | Permission prompts gate tool calls, but no spec-level review gate. `/goal` mode skips review. |
| Living spec updates | ❌ | — | No spec-as-artifact that persists across turns and gets updated when requirements change. |

---

### Phase 2 — Mutation Planning + Task Decomposition

| Capability | Status | Fox Implementation | Notes |
|---|---|---|---|
| Structured edit plan | 🔧 | Agent-driven | Model generates plans in its reasoning, but no structured plan schema enforced at platform level. |
| Affected file identification | 🔧 | Agent-driven | Model identifies files. No platform-level static analysis. |
| Side-effect prediction | ❌ | — | No automated side-effect prediction. |
| Verification impact prediction | ❌ | — | No prediction of which tests will be affected. |
| Task decomposition | 🔧 | `todo.ts` | `todowrite` tool lets the agent create checklists, but no sizing guidance or independent verifiability enforcement. |
| Plan-spec consistency check | ❌ | — | No automated validation of plan against acceptance criteria. |

---

### Phase 3 — Mutation Application

| Capability | Status | Fox Implementation | Notes |
|---|---|---|---|
| Patch generation | ✅ | `apply-patch.ts` | Unified diff format with multi-pass matching (exact → rstrip → trim → normalized). |
| Syntactic confidence scoring | ✅ | `transaction-confidence.ts` | Per-hunk scoring with match tier + context line bonus. Aggregate: apply ≥ 0.9, review ≥ 0.7, reject < 0.7. |
| Confidence gating | ✅ | `apply-patch.ts` | Rejects low-confidence patches and reports which hunks failed. |
| Atomic application | ✅ | `apply-patch.ts` | All-or-nothing: if any hunk fails, entire patch rolls back. |
| Snapshot checkpoint | ✅ | `processor.ts` | `snapshot.track()` on every completed assistant turn. |

---

### Phase 4 — Auto-Verification

| Capability | Status | Fox Implementation | Notes |
|---|---|---|---|
| Test command detection | ✅ | `verification.ts` | Scans `package.json` scripts. Priority: test > test:check > typecheck > check > lint. User override via `autonomous.test_command`. |
| Execution with timeout | ✅ | `verification.ts` | Default 30s, configurable via `autonomous.test_timeout`. |
| Output compression | ✅ | `compress.ts` | 7-transform pipeline: paths, git status, diff trim, test filter, tabular, log dedup, JSON keys. Workflow-aware policies. |
| Structured result | ✅ | `verification.ts` | `VerificationResult` with passed, exitCode, compressedOutput, truncated, elapsedMs. |
| Typecheck integration | 🔧 | Via test detection | Picks up `typecheck` script but doesn't run it separately from primary test command. |
| Lint integration | 🔧 | Via test detection | Picks up `lint` at lowest priority. Not run alongside tests. |
| Multi-command verification | ❌ | — | Runs only the single best-priority command. No multi-step pipeline. |
| Acceptance criteria check | ❌ | — | No automated acceptance criteria verification beyond test pass/fail. |

---

### Phase 5 — Failure Analysis

| Capability | Status | Fox Implementation | Notes |
|---|---|---|---|
| Oscillation detection | ✅ | `oscillation.ts` | SHA-256 hashing, sliding window (default 4), A→B→A pattern detection. Configurable. |
| Doom-loop detection | ✅ | `processor.ts` | `isDoomLoop()` — N identical consecutive tool calls (threshold: 3). Blocks the call. |
| Regression detection | ❌ | — | No baseline test tracking. Can't distinguish regressions from pre-existing failures. |
| Repair budget tracking | ✅ | `repair-budget.ts` | Consecutive failure counter, exhaustion warnings, resets on success. Default max: 3. |
| Failure classification | ❌ | — | No automated classification (syntax vs type vs assertion vs runtime). Model interprets raw output. |

---

### Phase 6 — Routing Decision

| Capability | Status | Fox Implementation | Notes |
|---|---|---|---|
| Failure-based routing | ❌ | — | No failure-type-driven model selection. |
| Model tier escalation | ❌ | — | `FoxRoutedModel` reads provider routing metadata but doesn't escalate based on failures. |
| Strategy switching | 🔧 | Via warnings | Oscillation/budget warnings instruct model to switch. No platform-enforced rotation. |
| Human escalation | ✅ | `goal/` | `goal_report(status: blocked)` + budget warnings stop loop and present to user. |
| Cost-aware routing | ❌ | — | No cost tracking influencing routing decisions. |

---

### Phase 7 — Context Management

| Capability | Status | Fox Implementation | Notes |
|---|---|---|---|
| Tool output supersession | ✅ | `supersede.ts` | Non-destructive, render-time replacement of stale reads. |
| Git status supersession | ✅ | `supersede.ts` | Supersedes stale git status, diff, and branch outputs. |
| History pruning | ✅ | `compaction.ts` | Prune threshold at 20K tokens. Tool output truncation at 2K chars. |
| LLM-based compaction | ✅ | `compaction.ts` | Full LLM-driven summarization. 706 lines of compaction logic. |
| Overflow detection | ✅ | `overflow.ts` | Proactive detection against model context limits. |

---

### Phase 8 — Success Path

| Capability | Status | Fox Implementation | Notes |
|---|---|---|---|
| Verification confirmation | ✅ | `verification.ts` | `Auto-Verification ✅ PASSED` block appended to tool output. |
| Solution presentation | ✅ | Agent-driven | Model presents summary. |
| Review gate | ❌ | — | No review step before commit. No specialized review agent or human sign-off flow. |
| Commit offering | 🔧 | Agent-driven | Model can run `git commit` via bash, but no dedicated commit flow or spec-update step. |
| Goal completion | ✅ | `goal/tool.ts` | `goal_report(status: complete)` with concrete reason. |
| Snapshot preservation | ✅ | `snapshot/index.ts` | 7-day retention with `revert.ts` for undo/redo. |

---

### Phase 9 — Failure Path

| Capability | Status | Fox Implementation | Notes |
|---|---|---|---|
| Compressed trace injection | ✅ | `processor.ts` | Verification feedback appended to mutation tool output. |
| Strategy adjustment | 🔧 | Via model instructions | Budget/oscillation warnings instruct change. No platform-enforced rotation. |
| Budget decrement | ✅ | `processor.ts` | Automatic on failure, reset on success. |
| Loop back | ✅ | Session loop | LLM issues next tool call after reading feedback. |

---

## Summary Scorecard

| Phase | ✅ | 🔧 | ❌ | Coverage |
|---|---|---|---|---|
| 0 — Session Init | 5 | 1 | 0 | **92%** |
| 1 — Goal + Context | 2 | 1 | 2 | **50%** |
| 1.5 — Spec Elaboration | 0 | 2 | 3 | **20%** |
| 2 — Mutation Planning | 0 | 3 | 3 | **25%** |
| 3 — Mutation Application | 5 | 0 | 0 | **100%** |
| 4 — Auto-Verification | 4 | 2 | 2 | **63%** |
| 5 — Failure Analysis | 3 | 0 | 2 | **60%** |
| 6 — Routing Decision | 0 | 1 | 4 | **10%** |
| 7 — Context Management | 5 | 0 | 0 | **100%** |
| 8 — Success Path | 3 | 1 | 1 | **70%** |
| 9 — Failure Path | 3 | 1 | 0 | **88%** |
| **TOTAL** | **30** | **12** | **17** | **61%** |

---

## Key Gaps (Priority Order)

1. **Phase 6 — Routing Decision** (10% coverage): Fox has no autonomous model escalation, failure-based routing, or cost-aware model selection. Model selection is entirely user-driven today. This is the biggest architectural gap.

2. **Phase 1.5 — Specification Elaboration** (20% coverage): Fox has no spec-as-artifact concept. Goals go directly from natural-language intent to code changes without a structured specification pass. For complex features, this means the agent often discovers the requirements are wrong after building significant code — the "house of cards" failure mode.

3. **Phase 2 — Mutation Planning** (25% coverage): Planning is entirely model-driven with no platform-level structure. No side-effect prediction, no verification impact analysis, no plan-spec consistency checking. The agent is only as good as the model's reasoning, with no safety net.

4. **Phase 1 — AST/Symbol Index** (missing): Text-based search (grep/glob) works for simple cases but fails at understanding type hierarchies, refactoring scope, and cross-module dependencies. A language-aware symbol index would significantly improve context discovery quality.

5. **Phase 8 — Review Gate** (missing): Fox goes directly from "tests pass" to "offer commit" with no review step. A review gate — human or automated — before shipping would catch issues that tests alone miss: security problems, style violations, spec drift.

6. **Phase 5 — Regression Detection** (missing): Without baseline test tracking, the agent can't distinguish "I broke this" from "this was already broken." This leads to wasted repair cycles on pre-existing failures.

7. **Phase 4 — Multi-Command Verification + Acceptance Criteria** (missing): Running only one verification command and having no acceptance criteria checking means the agent's definition of "done" is limited to a single test pass. A richer verification pipeline would catch more issues per cycle and ensure the changes actually meet the stated goal.
