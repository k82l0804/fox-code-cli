# Implementation Plan — Task 2D-4: Competitive Evaluation

> **Task**: 2D-4. Competitive Evaluation (Fox vs Aider vs Goose)  
> **Status**: Pending  
> **Depends on**: Task 2D-2, Task 2D-3  
> **Target**: Gemini Flash 3.8 High  

---

## 1. Goal / Problem Statement

Execute the full 100-challenge benchmark suite across Fox, Aider, and Goose under controlled conditions (same model via LiteLLM proxy, identical sandbox environments, 3 runs per challenge to compute median performance). Generate a comprehensive comparative evaluation report and evaluate the 5-criterion pass bar to determine if Fox qualifies to advance to Phase 3.

---

## 2. Key Code Locations & Touchpoints

- `test/capability-ladder/runner.ts`: Execution harness orchestrating benchmark runs across agents.
- `test/capability-ladder/reporter.ts`: Report generation and Markdown formatting.
- `test/capability-ladder/comparator.ts`: Statistical comparison, median computation, and 5-criterion verdict evaluation.
- `test/capability-ladder/results/`: Raw JSON result storage (`fox-*.json`, `aider-*.json`, `goose-*.json`).
- `docs/reports/YYYY-MM-DDTHH-MM_afb-competitive-benchmark-report.md`: Final published benchmark report with methodology, tier matrices, and failure taxonomies.

---

## 3. Proposed Changes & Evaluation Methodology

### 3.1 Controlled Evaluation Variables
- **Model**: `gpt-4o` (or `gemini-2.5-flash`) hosted via local LiteLLM proxy (`http://localhost:8000/v1`).
- **Trial Repetition**: 3 runs per challenge per agent; calculate median dimension scores and median efficiency ratios to eliminate network or non-deterministic sampling variance.
- **Timeouts**: Enforce tier-appropriate limits (T1–5: 120s, T6–7: 300s, T8–9: 600s, T10: 300s).

### 3.2 Evaluation Execution Flow
1. Run full 100 challenges for Fox:
   ```bash
   bun run bench --agent fox --all --runs 3 > test/capability-ladder/results/fox-results.json
   ```
2. Run full 100 challenges for Aider:
   ```bash
   bun run bench --agent aider --all --runs 3 > test/capability-ladder/results/aider-results.json
   ```
3. Run full 100 challenges for Goose:
   ```bash
   bun run bench --agent goose --all --runs 3 > test/capability-ladder/results/goose-results.json
   ```
4. Generate comparative verdict:
   ```bash
   bun run bench:compare \
     --fox test/capability-ladder/results/fox-results.json \
     --aider test/capability-ladder/results/aider-results.json \
     --goose test/capability-ladder/results/goose-results.json \
     --output docs/reports/<timestamp>_afb-competitive-benchmark-report.md
   ```

### 3.3 Pass Bar 5-Criterion Verification
- **C1: Absolute Competence**: Fox total on T1–7 + T10 ≥ 560/800 points (≥ 70%).
- **C2: Competitive Parity**: Fox overall score ≥ Aider AND Fox overall score ≥ Goose.
- **C3: Tier Dominance**: Fox score ≥ best competitor score on ≥ 6 of the 8 runnable tiers (T1–7 + T10).
- **C4: Zero Catastrophic Failures**: Count of catastrophic failure events across T1–7 + T10 for Fox == 0.
- **C5: AND Gate**: All four criteria must evaluate to true simultaneously.

---

## 4. Edge Cases & Failure Modes

1. **Proxy Rate Limiting / 429 Errors**: LiteLLM proxy might encounter upstream rate limits when running 300 evaluations. The runner must implement exponential backoff with jitter on HTTP 429 / 503 errors.
2. **Missing Competitor Binary**: If Aider or Goose are temporarily unavailable in a CI or local environment, support partial evaluation modes while flagging the full competitive verdict as incomplete.
3. **Flaky Median Scoring**: If one run hangs and two succeed, median must discard the timeout outlier appropriately.

---

## 5. Verification Plan

- **Dry-run Comparative Suite**: Run a 3-challenge mini-benchmark comparing Fox, Aider, and Goose to verify end-to-end report generation.
- **Report Validation**: Verify that the generated Markdown report conforms to Rule 8 naming conventions in `docs/reports/` and contains valid links and tables.

---

## 6. Refinement Checklist

1. **Rename Ripple Analysis**: N/A.
2. **Audit Completeness**: All 10 tiers, 3 candidate agents, and 5 pass criteria accounted for.
3. **Constraint Specificity**: Clarified that median score across 3 runs is used for each challenge to evaluate the pass bar.
4. **Abstraction Boundary Precision**: Report generation consumes strictly normalized JSON schemas output by `runner.ts`.

> **Refinement pass**: Completed 2026-09-23. Validated 3-run median aggregation methodology and backoff retry logic.
