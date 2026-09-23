# Current Tasks — Phase 2A: Core Infrastructure

> **Phase flow**: Phase 1 (✅) → Phase 1B (✅) → Phase 2.0 (✅) → **Phase 2A** 🔧 → Phase 2B → Phase 2C → Phase 3 → Phase 4
>
> Verification, context management, commits, and performance.
> Infrastructure that makes Fox better for **every user, every session**.

---

- [ ] **1. Multi-Command Auto-Verification Pipeline (3a)** — Extend `verification.ts` to run typecheck → tests → lint as a configurable sequence. Today Fox runs only the single best-priority command. Multi-command gives the LLM richer feedback per edit cycle. Subsumes Auto-Lint (3c).
- [ ] **2. Turn-Supersession Context Pruning** — Extend `supersede.ts` to cover more stale context patterns. Keeps long sessions lean and the model sharp. Mechanical — no LLM intelligence required.
- [ ] **3. Dynamic Context Window Discovery (4b)** — Query model/provider for actual context limits. Feed into compaction thresholds for proactive overflow prevention instead of reactive recovery.
- [ ] **4. Atomic Task-Completion Commits** — Platform-level commit flow with generated messages, metadata, and optional walkthrough — replacing ad-hoc `git commit` via bash. Useful in interactive mode ("fox, commit what you just did").
- [ ] **5. Paginated Message Loading (11.2)** — Performance: loading large sessions is slow today. Every user benefits.
- [ ] **6. JSON Serialization Bypass (11.3)** — Performance: reduces serialization overhead. Every user benefits.

---

> **References**:
> - [Guardian Design](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/future/2026-09-22T15-16_autonomous-dual-agent-design.md)
> - [Reference Architecture](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/future/2026-09-22T15-16_autonomous-agent-workflow.md)
> - [Competitive Analysis](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/reports/2026-09-23T10-07_competitive-analysis-product-features.md)
