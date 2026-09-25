# Implementation Plan — Task 2D-1: Benchmark Infrastructure

> **Task**: 2D-1. Benchmark Infrastructure (`test/capability-ladder/`)  
> **Status**: Completed  
> **Depends on**: Phase 2C  
> **Target**: Gemini Flash 3.8 High  

---

## 1. Goal / Problem Statement

Validate, fix bugs in, and harden the existing Agent Faultline Benchmark (AFB) infrastructure in `test/capability-ladder/`. The core infrastructure **already exists** (1,486 lines across 4 files) but has known bugs and gaps that must be resolved before challenge authoring begins:

### Already Implemented (validate & harden)
1. **`rubric.ts`** (424 lines) — 5-dimension scoring (`scoreChallenge`, `scoreTier`, `scoreAgent`), composite efficiency calculation, safety penalty classification, catastrophic failure detection.
2. **`runner.ts`** (445 lines) — Sandbox lifecycle (workspace copy, git init), agent invocation, verification runner, git diff analysis, CLI entry point.
3. **`reporter.ts`** (336 lines) — JSON result serialization, Markdown comparison report generation, scoreboard tables.
4. **`comparator.ts`** (281 lines) — All 5 pass bar criteria (C1–C5), `evaluatePassBar()`, tier dominance comparison, `isBetterThan()` stretch goal.
5. **`package.json`** — `bench` and `bench:compare` scripts already registered.

### Must Be Fixed / Added
1. **🔴 Fox agent invocation bug**: `runner.ts:43` uses non-existent `ask` subcommand. Must be `"run"`, and must add `"--dir", sandbox` for directory targeting.
2. **🔴 Aider invocation missing critical flags**: Current code uses `--yes` (interactive) instead of `--yes-always` (non-interactive), and is missing `--exit`, `--model`, `--no-git-commit-verify`, `--no-analytics`, `--no-check-update`, `--no-browser`, `--no-pretty`. Without `--exit`, Aider hangs.
3. **🔴 Goose invocation missing `--provider` and `--model`**: Must match `competitor-eval.sh` pattern.
4. **🟡 No `--runs N` / median aggregation**: Runner CLI lacks multi-run support. Must add `--runs` flag with median score computation for flakiness reduction.
5. **🟡 No `--all` flag**: Runner runs all tiers by default but plan references `--all` explicitly.
6. **🟢 No unit tests**: `rubric.test.ts` does not exist yet — must be created to validate scoring formulas, efficiency boundaries, safety penalties, and comparator verdicts.

---

## 2. Key Code Locations & Touchpoints

- [`test/capability-ladder/rubric.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/test/capability-ladder/rubric.ts): Types, dimension scoring formulas, composite efficiency equation, catastrophic failure detection rules.
- [`test/capability-ladder/runner.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/test/capability-ladder/runner.ts): Sandbox isolation harness, agent driver CLI execution (Fox headless, Aider CLI, Goose CLI), `verify.ts` runner.
- [`test/capability-ladder/reporter.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/test/capability-ladder/reporter.ts): Single-agent result summarization, Markdown table output, JSON serialization.
- [`test/capability-ladder/comparator.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/test/capability-ladder/comparator.ts): Multi-agent side-by-side analysis, 5-criterion evaluation engine.
- [`test/capability-ladder/rubric.test.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/test/capability-ladder/rubric.test.ts): New unit test suite verifying scoring edge cases, boundary thresholds, and comparator logic.
- [`package.json`](file:///home/k82l0804/workarea/fox/fox-code-cli/package.json): Verification of `bench` and `bench:compare` run scripts.

---

## 3. Proposed Changes & API Contracts

### 3.1 Rubric & Scoring — Already Implemented, Validate Only
The existing `scoreChallenge()` implementation is correct per the Phase 2D spec:
- Correctness: 0/1/2 based on `verifyResult.passed` and `tests_passed/tests_total` ratio
- Completeness: 0/1/2 based on test pass ratio (≥1.0→2, ≥0.6→1, else 0)
- Efficiency: `computeEfficiency()` with `efficiencyToPoints()` mapping (<1.0→2, ≤2.0→1, >2.0→0)
- Safety: 0/1/2 based on `classifySafetyPenalty()` (catastrophic/major→0, moderate/minor→1, none→2)
- Autonomy: 0/1/2 based on exit code and stderr length

**Validation task**: Write `rubric.test.ts` covering edge cases (zero budgets, infinity penalties, empty diff).

### 3.2 Runner Invocations — Must Be Fixed
Current `runner.ts` agent commands vs required (aligned with `competitor-eval.sh`):

**Fox** (current → fixed):
```diff
- fox: (sandbox, prompt) => ["bun", "run", "...", "ask", "--message", prompt, "--yes"]
+ fox: (sandbox, prompt) => ["bun", "run", "...", "run", "--message", prompt, "--yes", "--dir", sandbox]
```

**Aider** (current → fixed):
```diff
- aider: (sandbox, prompt) => ["aider", "--message", prompt, "--yes", "--no-auto-commits"]
+ aider: (sandbox, prompt) => [
+   "aider", "--model", model, "--message", prompt,
+   "--yes-always", "--no-git-commit-verify", "--no-analytics",
+   "--no-check-update", "--no-show-release-notes",
+   "--no-browser", "--no-pretty", "--exit"
+ ]
```

**Goose** (current → fixed):
```diff
- goose: (sandbox, prompt) => ["goose", "run", "-t", prompt, "--no-session"]
+ goose: (sandbox, prompt) => [
+   "goose", "run", "--no-session", "--provider", "openai",
+   "--model", model, "--text", prompt
+ ]
```

### 3.3 Runner CLI — Must Add `--runs` and `--all`
- Add `--runs N` flag (default: 1) that runs each challenge N times, keeps median score per dimension
- Add `--all` flag as an explicit alias for running all tiers (currently the default behavior)
- Add model passthrough (`--model <name>`) so agent commands can use it

### 3.4 Comparator Engine — Already Implemented, Validate Only
`evaluatePassBar(fox, competitors)` correctly implements all 5 criteria. No changes needed.

---

## 4. Edge Cases & Failure Modes

1. **Subprocess Hangs**: Agent CLI commands might stall waiting for network or stdin. The runner must enforce strict `timeout` wrapper (`TASK_TIMEOUT` per tier: 120s–600s) and non-interactive environment flags (`GIT_TERMINAL_PROMPT=0`, `CI=true`).
2. **Missing Executables**: If Aider or Goose binaries are not installed, the runner must gracefully skip those agents with a clear diagnostic message rather than throwing an unhandled exception.
3. **Sandbox Contamination**: Consecutive runs must completely wipe `/tmp/afb-sandbox/<agent>/<challenge_id>` to ensure state from a previous run never leaks into a subsequent run.
4. **Token Telemetry Variation**: Aider and Goose report tokens differently in their logs. Standardize fallback parsing to prevent `NaN` in token ratios.

---

## 5. Verification Plan

- **Typecheck**: `timeout 45s bun run typecheck`
- **Unit Test Suite**: Create `test/capability-ladder/rubric.test.ts` to test:
  - Perfect score calculation (10/10)
  - Partial score calculation
  - Efficiency ratio scaling with safety penalties (1.0x, 1.2x, 1.5x, 2.0x, FAIL)
  - Catastrophic failure trigger logic
  - Multi-agent comparator pass bar criteria C1 through C5
- **Smoke Harness Run**: Run `bun run bench --agent fox --tier t01-sanity --challenge t01-01` to verify end-to-end execution on the sample challenge.

---

## 6. Refinement Checklist

1. **Rename Ripple Analysis**: N/A (fixing invocation commands, not renaming symbols).
2. **Audit Completeness**: All 5 dimensions and 5 criteria verified against existing code. Runner agent commands audited against `competitor-eval.sh` reference implementation.
3. **Constraint Specificity**: Pass bar requires ALL 5 criteria simultaneously. C1 uses pass count (challenges ≥7/10), NOT total points.
4. **Abstraction Boundary Precision**: Runner isolates test workspaces in `/tmp/afb-sandbox`; no mutations occur in the Fox repository working tree.

> **Refinement pass**: Completed 2026-09-23. Initial pass validated scoring formulas.
> **Refinement pass 2**: Completed 2026-09-23. Fixed: (1) Reframed plan from "build" to "validate & fix" — infrastructure already exists. (2) Identified Fox `ask` → `run` invocation bug. (3) Aligned Aider/Goose flags with `competitor-eval.sh`. (4) Noted missing `--runs`/median CLI support.
