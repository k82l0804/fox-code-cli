# Current Tasks — Phase 2A: Core Infrastructure

> **Phase flow**: Phase 1 (✅) → Phase 1B (✅) → Phase 2.0 (✅) → **Phase 2A** 🔧 → Phase 2B → Phase 2C → Phase 3 → Phase 4
>
> Verification, context management, commits, and performance.
> Infrastructure that makes Fox better for **every user, every session**.

---

- [ ] **1. Multi-Command Auto-Verification Pipeline** — [📋 Plan](../plans/2026-09-23T12-40_plan-multi-cmd-verification.md)
  Extend `verification.ts` to run typecheck → tests → lint as a configurable sequence.

- [ ] **2. Turn-Supersession Context Pruning** — [📋 Plan](../plans/2026-09-23T12-40_plan-supersession-pruning.md)
  Extend `supersede.ts` to cover grep/glob/re-read/verification supersession patterns.

- [ ] **3. Dynamic Context Window Discovery** — [📋 Plan](../plans/2026-09-23T12-40_plan-dynamic-context-window.md)
  Query `/v1/models` for actual context limits to feed into compaction thresholds.

- [ ] **4. Atomic Task-Completion Commits** — [📋 Plan](../plans/2026-09-23T12-40_plan-atomic-commits.md)
  New `commit` tool with LLM-generated messages, replacing ad-hoc `git commit` via bash.

- [ ] **5. Paginated Message Loading** — [📋 Plan](../plans/2026-09-23T12-40_plan-paginated-loading.md)
  Cursor-based pagination for session message loading (UI performance).

- [ ] **6. JSON Serialization Bypass** — [📋 Plan](../plans/2026-09-23T12-40_plan-json-bypass.md)
  Cache token estimates and tool schemas to eliminate redundant `JSON.stringify` calls.

---

> **Recommended execution order**: 1 → 3 → 2 → 6 → 4 → 5
> (most impactful first, dependencies resolved, paginated loading last as most complex)

> **References**:
> - [Guardian Design](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/future/2026-09-22T15-16_autonomous-dual-agent-design.md)
> - [Reference Architecture](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/future/2026-09-22T15-16_autonomous-agent-workflow.md)
> - [Competitive Analysis](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/reports/2026-09-23T10-07_competitive-analysis-product-features.md)
