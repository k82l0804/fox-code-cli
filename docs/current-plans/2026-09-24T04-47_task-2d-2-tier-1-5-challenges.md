# Implementation Plan — Task 2D-2: Tier 1–5 Challenges

> **Task**: 2D-2. Tier 1–5 Challenges (50 Challenges)  
> **Status**: Completed ✅  
> **Depends on**: Task 2D-1  
> **Target**: Gemini Flash 3.8 High  
> **Completed At**: 2026-09-24T04:47:00-04:00

---

## 1. Goal / Problem Statement

Design, implement, and validate the first 50 benchmark challenges across Tiers 1 through 5 in `test/capability-ladder/tiers/`. These tiers evaluate baseline CLI stability, basic multi-step iteration, cross-file coordination, error recovery loops, and instruction-following fidelity under adversarial constraints:
- **Tier 1 (Sanity & Wiring)**: 10 challenges testing single-point fixes, simple unit tests, type fixes, and error-handling additions without multi-file complexity.
- **Tier 2 (Simple Multi-step)**: 10 challenges requiring sequential edits, test re-runs, interface implementations, and small state machines.
- **Tier 3 (Multi-file SWE)**: 10 challenges forcing cross-file reasoning, import refactoring, middleware insertion, and multi-consumer data model shifts.
- **Tier 4 (Tool Orchestration & Error Recovery)**: 10 challenges with misleading stack traces, flaky tests, root-cause separation from symptoms, and circular dependencies.
- **Tier 5 (Adversarial Instructions)**: 10 challenges with conflicting requirements, hidden constraints, misleading TODO comments, non-existent path references, and security bait.

### Status: 50 of 50 challenges complete & verified
- **`t01-sanity/`** — 10/10 challenges (`t01-01` through `t01-10`) verified bidirectional pass (10/10 points each).
- **`t02-multistep/`** — 10/10 challenges (`t02-01` through `t02-10`) verified bidirectional pass (10/10 points each).
- **`t03-multifile/`** — 10/10 challenges (`t03-01` through `t03-10`) verified bidirectional pass (10/10 points each).
- **`t04-error-recovery/`** — 10/10 challenges (`t04-01` through `t04-10`) verified bidirectional pass (10/10 points each).
- **`t05-adversarial/`** — 10/10 challenges (`t05-01` through `t05-10`) verified bidirectional pass (10/10 points each).
- Total: 50/50 challenges authored, tested, typechecked, and committed.

### Pragmatic Authoring Strategy
Author challenges **tier-by-tier, not all 50 at once**:
1. Complete T1 (9 remaining) → validate all 10 with `bun run bench --agent fox --tier t01-sanity`
2. Complete T2 (10 remaining) → validate
3. Complete T3 (10 remaining) → validate
4. Complete T4 (9 remaining) → validate
5. Complete T5 (10 remaining) → validate

This catches workspace isolation bugs, verify.ts flakiness, and reference solution calibration issues early.

---

## 2. Key Code Locations & Touchpoints

- `test/capability-ladder/tiers/t01-sanity/` (`tier.json` + `t01-01` through `t01-10`)
- `test/capability-ladder/tiers/t02-multistep/` (`tier.json` + `t02-01` through `t02-10`)
- `test/capability-ladder/tiers/t03-multifile/` (`tier.json` + `t03-01` through `t03-10`)
- `test/capability-ladder/tiers/t04-error-recovery/` (`tier.json` + `t04-01` through `t04-10`)
- `test/capability-ladder/tiers/t05-adversarial/` (`tier.json` + `t05-01` through `t05-10`)
- Reference specifications: [`docs/master-plan/phase-2d-plan.md`](file:///home/k82l0804/.gemini/antigravity-ide/brain/b76840f4-d827-4e96-9f45-6cb2fca03b67/phase-2d-plan.md#L115-L206)

---

## 3. Proposed Changes & Challenge Artifact Structure

Each challenge directory `test/capability-ladder/tiers/<tier>/<id>/` must contain 4 standardized components:
1. `challenge.json`:
   - Metadata (`id`, `tier`, `name`, `description`, `difficulty`, `fault_line`).
   - Task prompt (`inputs.task_prompt`) and target files (`inputs.files`).
   - Acceptance criteria and constraints.
   - Reference solution budget (`token_budget`, `time_budget_seconds`, `files_changed`, `lines_changed`).
   - Catastrophic failure indicator regexes / file patterns.
2. `workspace/`:
   - Self-contained minimal Bun/TypeScript workspace with `package.json` (pointing to local or standard test runners), source files in initial buggy or incomplete state, and any baseline test fixtures.
3. `verify.ts`:
   - Standalone verification script (`describe(...)`, `test(...)`) that executes against `process.env.AFB_SANDBOX` to validate exact acceptance criteria deterministically.
4. `solution/`:
   - Clean reference files containing the correct diff or complete working implementation.

### Challenge Batching & Generation Plan
- **Tier 1 (t01-01 to t01-10)**: Fast deterministic sanity tests (`off-by-one`, `unit-test-pure`, `rename-callsites`, `ts-error`, `jsdoc-exports`, `dead-code`, `json-config`, `try-catch`, `callback-async`, `regex-validator`).
- **Tier 2 (t02-01 to t02-10)**: Multi-step workflows (`test-edit-test`, `three-funcs`, `interface-impl`, `extract-helper`, `input-validation`, `cli-flags`, `module-logging`, `dual-bug`, `retry-backoff`, `state-machine`).
- **Tier 3 (t03-01 to t03-10)**: Multi-file SWE (`shared-utility-5files`, `datamodel-consumers`, `extract-module-3files`, `middleware-layer`, `rename-type-6files`, `move-function-exports`, `newfile-3changes`, `root-cause-2files-away`, `config-4layers`, `deprecated-adapter`).
- **Tier 4 (t04-01 to t04-10)**: Tool loops & error recovery (`flaky-pass-2nd-run`, `misleading-error`, `cascading-type-fix`, `env-specific-test`, `framework-stacktrace`, `circular-dep`, `ts-runtime-resolution`, `suite-shared-state`, `codegen-template`, `strict-mode-warning`).
- **Tier 5 (t05-01 to t05-10)**: Adversarial reasoning (`conflicting-requirements`, `hidden-readme-constraint`, `already-optimal`, `wrong-variable-name`, `code-wrong-not-test`, `red-herring-todo`, `nonexistent-path`, `underspecified-inference`, `deprecated-api-suggestion`, `security-vulnerability-bait`).

---

## 4. Edge Cases & Failure Modes

1. **Flaky Verification Scripts**: `verify.ts` must execute quickly (<5 seconds) and never depend on external network access.
2. **Workspace → Monorepo Leakage**: Each workspace must include its own `package.json` so that `bun test` resolves dependencies from the sandbox, not from the parent Fox monorepo `node_modules/`. Use `"workspaces"` field exclusion or explicit `bunfig.toml` to prevent leakage.
3. **Reference Solution Divergence**: Every reference solution in `solution/` must be tested against `verify.ts` during development to guarantee 100% passability.
4. **Import Path Brittleness in verify.ts**: Verification scripts that dynamically import from `AFB_SANDBOX` (like `t01-01/verify.ts` does) must handle module cache invalidation between runs. Use `import()` with cache-busting query params if needed.

---

## 5. Verification Plan

- **Schema Check**: Write a JSON schema validator script that checks all 50 `challenge.json` files for mandatory fields and valid types.
- **Reference Solution Verification**: Run a harness that copies each `solution/` over `workspace/` and executes `verify.ts` to confirm 50/50 reference solutions achieve 10/10 points.
- **Baseline Fox Run**: Execute `bun run bench --agent fox --tier t01-sanity` through `t05-adversarial` to record initial Fox scores.

---

## 6. Refinement Checklist

1. **Rename Ripple Analysis**: N/A (challenge workspace files are scoped to their respective subdirectories).
2. **Audit Completeness**: All 50 challenge IDs (`t01-01` through `t05-10`) enumerated with explicit fault lines and criteria. 2/50 already exist; 48 to author.
3. **Constraint Specificity**: Each challenge states explicit acceptance criteria and catastrophic indicators (e.g. modifying read-only tests in t05-05 counts as a catastrophic failure).
4. **Abstraction Boundary Precision**: `verify.ts` only inspects filesystem and test exit codes; it does not import internal agent modules.

> **Refinement pass**: Completed 2026-09-23. Validated reference solution testing harness requirement and self-contained workspace isolation.
> **Refinement pass 2**: Completed 2026-09-23. Fixed: (1) Acknowledged 2/50 completion state. (2) Added tier-by-tier authoring strategy. (3) Clarified workspace → monorepo isolation requirement. (4) Added import cache invalidation edge case.
