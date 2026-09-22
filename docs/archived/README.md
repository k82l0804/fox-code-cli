# 🗄️ Fox Code CLI — Archived Documentation

> **Archive Notice:** The documents in this directory have been superseded by subsequent architectural implementations, expanded testing harnesses, or current master roadmaps. They are preserved for historical provenance, audit trails, and research continuity.
>
> **Chronological Sorting:** All archived files are prepended with an ISO 8601 timestamp (`YYYY-MM-DDTHH-MM_`) indicating when they were authored or committed, allowing files to sort in exact chronological sequence.

---

## 🗺️ Master Supersession & Redirection Index

| Archived Document | Authored / Committed | Superseded By | Status & Reason |
|:---|:---:|:---|:---|
| [`2026-09-20T14-46_benchmark-report-lossless-token-compression.md`](./2026-09-20T14-46_benchmark-report-lossless-token-compression.md) | 2026-09-20 | [`../2026-09-22T15-54_fox-challenge-ladder-report.md`](../2026-09-22T15-54_fox-challenge-ladder-report.md) | Early Phase 1.5/2 A/B benchmark (3 prompts). Replaced by 334-fixture Challenge Ladder. |
| [`2026-09-20T14-46_test-plan-lossless-token-compression.md`](./2026-09-20T14-46_test-plan-lossless-token-compression.md) | 2026-09-20 | [`../../test/challenge-ladder/README.md`](../../test/challenge-ladder/README.md) | Early test plan noting features as "Not yet" which are now implemented and tested in Challenge Ladder. |
| [`2026-09-20T14-46_verification-guide-lossless-token-compression.md`](./2026-09-20T14-46_verification-guide-lossless-token-compression.md) | 2026-09-20 | [`../../test/challenge-ladder/README.md`](../../test/challenge-ladder/README.md) | Early verification guide superseded by modern Challenge Ladder runner (`bun run test:challenge`). |
| [`2026-09-20T19-32_fox-standard-test-suite-scoreboard.md`](./2026-09-20T19-32_fox-standard-test-suite-scoreboard.md) | 2026-09-20 | [`../2026-09-22T15-54_fox-challenge-ladder-report.md`](../2026-09-22T15-54_fox-challenge-ladder-report.md) | Baseline 52-fixture scoreboard; now integrated as Tier 1 of the 334-fixture Challenge Ladder. |
| [`2026-09-20T19-32_reproduction-guide.md`](./2026-09-20T19-32_reproduction-guide.md) | 2026-09-20 | [`../../test/challenge-ladder/README.md`](../../test/challenge-ladder/README.md) | Reproduction guide for 52-fixture suite. Replaced by Challenge Ladder guide and automated test commands. |
| [`2026-09-20T19-49_competitive-analysis.md`](./2026-09-20T19-49_competitive-analysis.md) | 2026-09-20 | [`../future/2026-09-21T06-12_plan-competitive-features-roadmap.md`](../future/2026-09-21T06-12_plan-competitive-features-roadmap.md), [`../../README.md`](../../README.md) | 35-line initial stub. Superseded by master competitive feature audit across Claude Code, Aider, Codex, etc. |
| [`2026-09-21T10-03_codebase-review-plan.md`](./2026-09-21T10-03_codebase-review-plan.md) | 2026-09-21 | [`../future/2026-09-21T06-12_plan-competitive-features-roadmap.md`](../future/2026-09-21T06-12_plan-competitive-features-roadmap.md) | Blueprint for the 8-phase codebase review. Review completed and all follow-up action items reconciled into master roadmap. |
| [`2026-09-22T15-16_benchmark-report-current-showdown.md`](./2026-09-22T15-16_benchmark-report-current-showdown.md) | 2026-09-22 | [`../2026-09-22T15-54_fox-challenge-ladder-report.md`](../2026-09-22T15-54_fox-challenge-ladder-report.md) | Showdown on 52 fixtures prior to Phase 2.0 Adaptive Compression and 334-fixture expansion. |
| [`2026-09-22T15-16_fox-vs-kilo-comprehensive-ab-report.md`](./2026-09-22T15-16_fox-vs-kilo-comprehensive-ab-report.md) | 2026-09-22 | [`../2026-09-22T15-54_fox-challenge-ladder-report.md`](../2026-09-22T15-54_fox-challenge-ladder-report.md) | Master Comparative Ledger v2.0.0; superseded by Challenge Ladder Report v1.1. |

---

## 📁 Subdirectory Archives

### 1. `plans/` — Completed Review & Cleanup Execution Plans
Completed plans from the 8-phase codebase review and cleanup cycle:
- [`2026-09-21T10-03_code-cleanup-plan.md`](./plans/2026-09-21T10-03_code-cleanup-plan.md) — Cleanup plan (Track A: Dead weight deletion, Track B: Tests). **Status: Completed**.
- [`2026-09-21T10-03_code-removal-plan.md`](./plans/2026-09-21T10-03_code-removal-plan.md) — Removal of cloud dependencies and legacy migration code. **Status: Completed**.
- [`2026-09-21T10-03_post-review-action-plan.md`](./plans/2026-09-21T10-03_post-review-action-plan.md) — Workstream roadmap. **Reconciled into [`../future/2026-09-21T06-12_plan-competitive-features-roadmap.md`](../future/2026-09-21T06-12_plan-competitive-features-roadmap.md)**.

### 2. `prompts/` — Operational Review Prompts
- [`2026-09-21T10-03_create-code-cleanup-plan.md`](./prompts/2026-09-21T10-03_create-code-cleanup-plan.md) — Structured architect prompt used to generate the initial cleanup plan.

### 3. `research/` — Lossless Compression & SWE Benchmarking RFCs
Early research notes and RFCs that led to the current compression engine and test suite:
- [`2026-09-19T12-00_lossless-token-compression.md`](./research/2026-09-19T12-00_lossless-token-compression.md) — Original RFC on lossless token compression for local LLMs.
- [`2026-09-20T14-46_considerations-lossless-token-compression.md`](./research/2026-09-20T14-46_considerations-lossless-token-compression.md) — Hygiene and prefix considerations.
- [`2026-09-20T14-46_est-savings-lossless-token-compression.md`](./research/2026-09-20T14-46_est-savings-lossless-token-compression.md) — Early token savings projections.
- [`2026-09-20T14-46_git-tool-optimization-lossless-compression.md`](./research/2026-09-20T14-46_git-tool-optimization-lossless-compression.md) — Git tool optimization strategies.
- [`2026-09-20T14-46_metrics-lossless-token-compression.md`](./research/2026-09-20T14-46_metrics-lossless-token-compression.md) — Jaeger telemetry guide for compression.
- [`2026-09-20T14-46_more-ideas-lossless-token-compression.md`](./research/2026-09-20T14-46_more-ideas-lossless-token-compression.md) — Early brainstorm on per-turn compression telemetry.
- [`2026-09-20T14-46_stepping-back-lossless-token-compression.md`](./research/2026-09-20T14-46_stepping-back-lossless-token-compression.md) — Architectural shift to per-tool compression.
- [`2026-09-20T14-46_test-plan-ideas-lossless-token-compression.md`](./research/2026-09-20T14-46_test-plan-ideas-lossless-token-compression.md) — Workload-specific test ideas.
- [`2026-09-20T19-32_concerns-lossless-token-compression.md`](./research/2026-09-20T19-32_concerns-lossless-token-compression.md) — Risk analysis on KV-cache, truncation, and git rewrite invariants.
- [`2026-09-20T19-32_report-realworld-autonomous-swe-benchmark.md`](./research/2026-09-20T19-32_report-realworld-autonomous-swe-benchmark.md) — Early real-world autonomous benchmark report (feature branch).
- [`2026-09-20T19-32_std-test-suite-sort-of.md`](./research/2026-09-20T19-32_std-test-suite-sort-of.md) — Initial memo recommending standard SWE test suites. Superseded by [`../future/2026-09-22T15-16_autonomous-agent-std-tests.md`](../future/2026-09-22T15-16_autonomous-agent-std-tests.md).

### 4. `reviews/` — Codebase & Compression Reviews
Historical peer reviews and tracker artifacts:
- [`2026-09-20T14-46_review-lossless-token-compression.md`](./reviews/2026-09-20T14-46_review-lossless-token-compression.md) — Frontier model peer review on compression priorities.
- [`2026-09-20T19-32_review-addressing-concerns.md`](./reviews/2026-09-20T19-32_review-addressing-concerns.md) — Review on hardening plan guardrails.
- [`2026-09-20T19-32_user-specified-workflow-last-thoughts.md`](./reviews/2026-09-20T19-32_user-specified-workflow-last-thoughts.md) — Review memo on user workflow optimizations.
- [`2026-09-20T19-32_workload-classification-concerns.md`](./reviews/2026-09-20T19-32_workload-classification-concerns.md) — Review on workload classification scope.
- [`2026-09-21T10-03_full-codebase-review-tracker.md`](./reviews/2026-09-21T10-03_full-codebase-review-tracker.md) — Master progress tracker for 8-phase codebase review (1,846 files, 100% complete).
