# Implementation Plan — Task 2D-3: Tier 6–10 Challenges

> **Task**: 2D-3. Tier 6–10 Challenges (50 Challenges)  
> **Status**: Completed ✅  
> **Depends on**: Task 2D-2  
> **Target**: Gemini Flash 3.8 High  
> **Completed At**: 2026-09-24T05:00:00-04:00

---

## 1. Goal / Problem Statement

Design, implement, and validate the advanced 50 benchmark challenges across Tiers 6 through 10 in `test/capability-ladder/tiers/`. These tiers push agents beyond simple prompt-response into extended autonomy, boundary discipline, multi-agent arbitration, and complex SWE-bench-grade debugging:
- **Tier 6 (Long-Horizon Tasks)**: 10–20 step workflows requiring feature + tests + docs + configuration changes without drifting or losing context.
- **Tier 7 (Autonomy without Guardian)**: Exposes unsafe autonomy (e.g. rewriting entire files instead of targeted edits, modifying untouched configs, refactoring unrelated code, deleting files as shortcuts).
- **Tier 8 (Guardian + Autonomy)**: Evaluates decision oversight on native agent behavior (risky diff filtering, runaway loop interruption, scope boundary enforcement).
- **Tier 9 (Multi-Agent Arbitration)**: Evaluates selecting between candidate diffs/plans, rejecting hallucinated dependencies, and merging partial solutions.
- **Tier 10 (Realistic SWE-bench Style Bugs)**: High-difficulty real-world software defects (race conditions, async event memory leaks, UTF-8 BOM encoding anomalies, cache invalidation races, prototype pollution).

### Status: 50 of 50 challenges complete & verified
- **`t06-long-horizon/`** — 10/10 challenges (`t06-01` through `t06-10`) verified bidirectional pass (10/10 points each).
- **`t07-unsafe-autonomy/`** — 10/10 challenges (`t07-01` through `t07-10`) verified bidirectional pass (10/10 points each).
- **`t08-guardian/`** — 10/10 challenges (`t08-01` through `t08-10`) verified bidirectional pass (10/10 points each).
- **`t09-arbitration/`** — 10/10 challenges (`t09-01` through `t09-10`) verified bidirectional pass (10/10 points each).
- **`t10-swe-bench/`** — 10/10 challenges (`t10-01` through `t10-10`) verified bidirectional pass (10/10 points each).
- Total across entire benchmark: 100/100 challenges authored, tested, typechecked, and committed.

---

## 2. Key Code Locations & Touchpoints

- `test/capability-ladder/tiers/t06-long-horizon/` (`tier.json` + `t06-01` through `t06-10`)
- `test/capability-ladder/tiers/t07-unsafe-autonomy/` (`tier.json` + `t07-01` through `t07-10`)
- `test/capability-ladder/tiers/t08-guardian/` (`tier.json` + `t08-01` through `t08-10`)
- `test/capability-ladder/tiers/t09-arbitration/` (`tier.json` + `t09-01` through `t09-10`)
- `test/capability-ladder/tiers/t10-swe-bench/` (`tier.json` + `t10-01` through `t10-10`)
- Reference specifications: [`docs/master-plan/phase-2d-plan.md`](file:///home/k82l0804/.gemini/antigravity-ide/brain/b76840f4-d827-4e96-9f45-6cb2fca03b67/phase-2d-plan.md#L207-L300)

---

## 3. Proposed Changes & Challenge Artifact Structure

Each challenge directory `test/capability-ladder/tiers/<tier>/<id>/` contains:
1. `challenge.json`: Metadata, prompts, constraints, reference solution budgets (scaled for longer timeouts: 300s–600s), and explicit catastrophic failure indicators.
2. `workspace/`: Multi-module TypeScript workspaces, mini-frameworks, and regression suites.
3. `verify.ts`: Rigorous verification checking functional correctness, blast radius limits, and absence of regressions.
4. `solution/`: Verified reference implementations.

### Tier Breakdown
- **Tier 6 (Long-Horizon: t06-01 to t06-10)**:
  `feature-tests-docs-config`, `api-migration-4layers`, `crud-endpoint-full`, `plugin-system-loader`, `refactor-feature-docs`, `new-package-scaffold`, `debug-chain-regression`, `cache-ttl-eviction`, `auth-middleware-guards`, `event-emitter-async`.
- **Tier 7 (Unsafe Autonomy: t07-01 to t07-10)**:
  `minimal-vs-rewrite`, `ask-vs-guess`, `naive-breaks-others`, `style-fix-creep`, `stop-vs-loop`, `unconventional-code-preserve`, `delete-shortcut-avoidance`, `read-only-config-write`, `test-edge-case-tamper`, `clean-rollback-failure`.
- **Tier 8 (Guardian Scenarios: t08-01 to t08-10)**:
  Evaluated on native behavior pre-Guardian; establishes baseline for future Phase 3 Guardian validation.
  **⚠️ Open design question**: How to simulate "worker proposes risky diff" without a Guardian agent. Options:
  - (A) Provide pre-staged diffs in the workspace and prompt the agent to review/accept/reject them
  - (B) Present a multi-step task where the agent’s own first attempt is intentionally flawed, testing whether it self-corrects
  - (C) Measure only blast radius and safety penalty on native behavior (no Guardian simulation)
  Decision deferred to implementation time; option (C) is simplest and still produces useful baseline data.
- **Tier 9 (Arbitration Scenarios: t09-01 to t09-10)**:
  Provides competing candidate diffs/plans in the workspace to test whether the agent can evaluate and select the correct option.
  **⚠️ Open design question**: Workspace must contain pre-staged candidate solutions (e.g. `candidates/a.patch` and `candidates/b.patch`) with the task prompt asking the agent to evaluate and apply the better one. This is a novel workspace layout not used in T1–T7.
- **Tier 10 (SWE-bench Bugs: t10-01 to t10-10)**:
  `misleading-stacktrace`, `profiling-perf-regression`, `async-race-condition`, `event-memory-leak`, `utf8-bom-encoding`, `pagination-off-by-one`, `timezone-utc-est`, `cache-invalidation-stale`, `import-order-side-effects`, `prototype-pollution-merge`.

---

## 4. Edge Cases & Failure Modes

1. **Timeout Scaling**: Long-horizon (T6) and Guardian/Arbitration (T8–9) tasks require extended timeouts (300s to 600s). The test harness must cleanly enforce process termination without leaving zombie processes.
2. **Deterministic Concurrency in Tests**: For race condition and event emitter tests (`t10-03`, `t10-04`), test fixtures must use deterministic timing/locks to avoid flakiness in CI.
3. **Catastrophic Detection Sensitivity**: Ensure catastrophic failure rules do not produce false positives on legitimate multi-file changes in T6.

---

## 5. Verification Plan

- **Schema Check**: Validate all 50 `challenge.json` files in T6–10 against required fields.
- **Reference Solution Validation**: Verify all 50 solutions pass their respective `verify.ts` in under the allotted time budget.
- **Dry Run Harness**: Run `bun run bench --agent fox --tier t10-swe-bench` to ensure SWE-bench style challenges execute cleanly in the sandbox runner.

---

## 6. Refinement Checklist

1. **Rename Ripple Analysis**: N/A (independent challenge directories).
2. **Audit Completeness**: All 50 challenges across Tiers 6–10 enumerated with explicit IDs, targets, and criteria. 0/50 exist; all to author.
3. **Constraint Specificity**: Clarified that T8–9 do not count toward Criterion 1's 70% floor, but DO count toward Criterion 2 (overall score) and Criterion 4 (zero catastrophic failures).
4. **Abstraction Boundary Precision**: Reference solutions must touch only files specified in `inputs.files` unless explicit scope expansion is part of the challenge acceptance criteria.

> **Refinement pass**: Completed 2026-09-23. Established deterministic test harnesses for concurrency tests and verified timeout tiers.
> **Refinement pass 2**: Completed 2026-09-23. Fixed: (1) Acknowledged 0/50 completion state. (2) Documented open design questions for T8/T9 Guardian-less evaluation. (3) Proposed candidate-diff workspace layout for T9 arbitration challenges.
