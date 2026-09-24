# Current Plans — Phase 2C: Routing & Refinement

Implementation plans for each task in [current-tasks.md](../master-plan/current-tasks.md).

**Target implementer**: Gemini Flash 3.8 High

**Recommended execution order**: 11 → 14 → 12 → 13

| Plan | Task | Status |
|------|------|--------|
| [Task 11: System-Driven Model Routing](2026-09-23T18-42_task-11-system-driven-model-routing.md) | `recommendModelForTask` — system picks cheapest viable model per subtask | ✅ Implemented |
| [Task 14: Repo-Level Intent Detection](2026-09-23T18-42_task-14-repo-level-intent-detection.md) | Classify task scope and blast radius from goal description | ✅ Implemented |
| [Task 12: Blast-Radius Regression Detection](2026-09-23T18-42_task-12-blast-radius-regression-detection.md) | Baseline test tracking: "I broke this" vs "already broken" | ✅ Implemented |
| [Task 13: LSP Confidence Scoring](2026-09-23T18-42_task-13-lsp-confidence-scoring.md) | Language-aware edit confidence from LSP diagnostic deltas | ✅ Implemented |
