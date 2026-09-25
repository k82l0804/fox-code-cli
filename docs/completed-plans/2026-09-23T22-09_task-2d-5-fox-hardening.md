# Implementation Plan — Task 2D-5: Fox Hardening

> **Task**: 2D-5. Fox Hardening & Pass Bar Convergence  
> **Status**: Pending  
> **Depends on**: Task 2D-4  
> **Target**: Gemini Flash 3.8 High  

---

## 1. Goal / Problem Statement

Iteratively triage, diagnose, and resolve functional defects, prompt adherence failures, and tool loop regressions in Fox exposed by the 100-challenge benchmark until Fox satisfies all five criteria of the AFB pass bar simultaneously:
1. Fox ≥ 70% on Tiers 1–7 + T10 (≥ 560/800).
2. Fox ≥ both Aider and Goose on overall benchmark score.
3. Fox ≥ best competitor on ≥ 6 of 8 runnable tiers.
4. Zero catastrophic failures across all evaluated tasks.
5. All criteria met simultaneously.

Document the architectural remedies and feed edge-case failure modes directly into the requirements for Phase 3 (Guardian / Autonomy Intelligence Layer).

---

## 2. Key Code Locations & Touchpoints

- `packages/core/src/`: Tool definitions, error recovery heuristics, patch apply logic.
- `src/session/`: Session orchestration, turn loop, retry policies, context management.
- `src/session/llm/`: Prompts, repair prompt templates, tier-specific system instructions.
- `src/foxcode/`: Model capability overrides, tool surface filters.
- `docs/reports/`: Hardening progress log, failure classification catalog, and architectural remediation notes.

---

## 3. Proposed Changes & Iterative Remediation Strategy

### 3.1 Failure Mode Triage & Categorization
When Fox fails a challenge or triggers a safety penalty:
1. **Catastrophic Failures (C4 Killers)**:
   - High priority: Files deleted without cause, hallucinated paths, infinite looping tool calls.
   - Remediation: Implement pre-execution tool constraints (e.g. guard against deleting non-scoped files, limit tool repetition without file diffs).
2. **Error Recovery & Tool Oscillation (T4 Fault Lines)**:
   - Failing tests where Fox repeatedly attempts the exact same incorrect edit.
   - Remediation: Leverage Phase 2C blast-radius tracking and oscillation detection to force alternate repair prompts.
3. **Adversarial & Intent Gaps (T5 Fault Lines)**:
   - Fox following misleading TODOs or attempting to modify test fixtures instead of application logic.
   - Remediation: Strengthen system prompt directives around test preservation and intent inference.
4. **Long-Horizon Context Drift (T6 Fault Lines)**:
   - Fox losing track of required subtasks over 10+ turns.
   - Remediation: Tune compaction, turn-supersession pruning, and subagent task handoffs.

### 3.2 Iteration Loop
- Run failing subset: `bun run bench --agent fox --tier <failing_tier>`
- Analyze logs, diffs, and verification output in `/tmp/afb-sandbox/`
- Apply surgical core or prompt fixes in `fox-code-cli`
- Re-run smoke tests and regression suite: `bun run test:smoke`
- Re-evaluate benchmark until green on target criteria.

---

## 4. Edge Cases & Failure Modes

1. **Overfitting to Specific Benchmarks**: Fixes must be general architectural improvements or prompt hardenings, not hardcoded special cases keyed to challenge IDs.
2. **Regression in Existing Capabilities**: Every fix must pass `bun run test:smoke` and `bun run test` to verify no existing tests or challenge ladder tests regress.
3. **Model Non-Determinism**: If a fix passes on 1 run but fails on 2 others, evaluate with 3 runs to confirm median convergence.

---

## 5. Verification Plan

- **Full Monorepo Smoke Test**: `timeout 60s bun run test:smoke`
- **Challenge Ladder Regression**: `bun run test:challenge`
- **AFB Suite Re-run**: `bun run bench --agent fox --all`
- **Pass Bar Validation**: Confirm `comparator.ts` outputs `PASS` on all 5 criteria (C1 through C5).

---

## 6. Refinement Checklist

1. **Rename Ripple Analysis**: N/A (code changes will be targeted bug fixes).
2. **Audit Completeness**: All 5 pass bar criteria and 4 core failure categories explicitly addressed.
3. **Constraint Specificity**: Fixes must not introduce regressions to existing smoke tests or compression ladder suites.
4. **Abstraction Boundary Precision**: Hardening improvements must be isolated to general session/prompt/tool layers without challenge-specific coupling.

> **Refinement pass**: Completed 2026-09-23. Validated regression safety rails and non-overfitting constraints.
