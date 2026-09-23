# Current Tasks — Phase 2C: Routing & Refinement

> **Phase flow**: Phase 1 (✅) → Phase 1B (✅) → Phase 2.0 (✅) → Phase 2A (✅) → Phase 2B (✅) → **Phase 2C** 🔧 → Phase 3 → Phase 4
>
> System-driven model selection and quality-of-life improvements.
> Builds on the [Model Capability Tier System](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/model-tier.ts) (Phase 1 + 2B complete: tier resolution, reclassification, tool filtering, specialized subagents).

---

- [ ] **11. System-Driven Model Routing** — `recommendModelForTask(agentMode, availableModels[])` — system picks cheapest viable model for each subtask. Tier-based: research on Tier C, planning on Tier A/S, implementation on Tier B+.

- [ ] **12. Blast-Radius Regression Detection (3b)** — Baseline test tracking to distinguish "I broke this" from "this was already broken." Structured input for future Guardian.

- [ ] **13. LSP Confidence Scoring (6a)** — Language-aware edit confidence. The parity matrix shows AST/symbol index as a top gap.

- [ ] **14. Repo-Level Intent Detection** — Classify task scope and blast radius from the goal description before planning.

---

> **Recommended execution order**: 11 → 14 → 12 → 13
> (Model routing first as it's the most impactful; intent detection informs routing; regression detection and LSP scoring are independent refinements)

> **References**:
> - [Model Capability Tier System](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/model-tier.ts)
> - [Capability-Proportional Execution Analysis](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/reports/2026-09-23T09-18_competitive-analysis-fox-aider-goose.md)
> - [Guardian Design](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/future/2026-09-22T15-16_autonomous-dual-agent-design.md)
> - [Reference Architecture](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/future/2026-09-22T15-16_autonomous-agent-workflow.md)
