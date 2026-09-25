# Current Tasks — Phase 2E: SOTA Harness & Localization

> **Phase flow**: Phase 1 (✅) → Phase 1B (✅) → Phase 2.0 (✅) → Phase 2A (✅) → Phase 2B (✅) → Phase 2C (✅) → Phase 2D (✅) → **Phase 2E** 🔧 → Phase 2F → Phase 2G → Phase 3 → Phase 4
>
> The harness owns done, context, and the edit contract. Everything below moves those three
> from "the model may" to "the loop will." If a plan does not change `loop.ts`'s exit condition,
> it is not this project.
>
> **Research**: [`why-aider-wins.md`](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/research/2026-09-24T20-20_why-aider-wins.md), [`how-to-make-fox-code-cli-state-of-the-art.md`](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/research/2026-09-24T20-30_how-to-make-fox-code-cli-state-of-the-art.md)

---

- [ ] **2E-1. Loop-Exit Gate + Mutation Journal** — Mutation gate in `loop.ts`: code-change tasks cannot exit on prose. Session mutation journal tracks harness-applied edits. Intent detection fails open toward code-change. Reflection names the tier-appropriate edit tool.

- [ ] **2E-2. Verification as Harness Reflection** — Exit-time verification with baseline comparison (only new regressions block). Repair budget as hard cap. Fresh-verify skip. Flaky test retry. Parse-fail circuit breaker (3-strike rule — prevents Goose-style truncate→retry livelock). Unified `resolveExitCondition()`.

- [ ] **2E-3. Localization Pipeline + Code Context Block** — `buildCodeContextBlock()` with 5k token envelope (map + localize spans + pinned bodies). Hierarchical localize prelude (BM25 over identifiers + graph). Cold-index non-blocking. Honest cache key. Repo map injection (more for weak models). Working-set pinning.

- [ ] **2E-4. ACI Simplification — Tool Surface Matrix** — Canonical ACI matrix (S/A: `edit` + `rewrite_file(create)`; B: `edit` + `rewrite_file`; C/D: none as tools → 2E-6). Syntax gate on apply. Bounded `read` (200 lines + offset). Empty success formatting. `commit`/`write`/`apply_patch` off default surface.

- [ ] **2E-5. *(Merged into 2E-3)*** — Repo Map Injection + Working-Set Pinning. Placeholder.

- [ ] **2E-6. Weak-Model Fast Path — Whole-File Generation Format** — C/D generation contract: no edit tool schemas, fence-parse in harness. Accept fenced blocks, `File:` headers, SEARCH/REPLACE. `bash` + `grep` only tools. `read` as dynamic fallback.

- [ ] **2E-7. Multi-Attempt Architecture** — `fox run --attempts N` with worktree isolation, sequential v1, deterministic selection (filter + rank for N=3, cluster for N≥5). Per-attempt timeout. No `--repro-first` in v1.

---

> **Success criteria (all four must be true before moving past 2E):**
> 1. Code-change task + weak model → at least one applied mutation, or a capped explicit failure — never a prose exit.
> 2. Dirty/red repo → only *new* failures block.
> 3. Tier C/D → first completion can be a file, not a tool call.
> 4. KV prefix still hits when map/pins have not changed.
>
> If (1) is false, 2E-3 through 2E-7 are decoration.

> **Ship order (PRs, not tasks — implement in this order, stop and measure after each):**
>
> | PR | Tasks | Gate |
> |---|---|---|
> | **PR 1** | 2E-1 + 2E-2 + 2F-1 + 2F-4 | Re-run 8B Task 3 trace — must NOT exit on prose |
> | **PR 2** | 2E-4 + 2F-2 (grep shape) | Typecheck + existing tests pass |
> | **PR 3** | 2E-3 (includes 2E-5) | Localize top-3 accuracy on fixture repo with decoys |
> | **PR 4** | 2E-6 | 8B produces and applies a fence without tool calls |
> | **PR 5** | 2E-7 | Exit + verify trusted from PR 1 |

> **Golden replay fixture**: Frozen 8B empty-exit transcript + small fixture repo with one-span bug + decoy file. Each PR changes that outcome or is not merged.

> **References**:
> - [Phase 2E full spec](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/master-plan/future-tasks.md) (cross-cutting constraints, per-task details, plan-lie guardrails)
> - [Why Aider Wins](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/research/2026-09-24T20-20_why-aider-wins.md)
> - [SOTA Stack](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/research/2026-09-24T20-30_how-to-make-fox-code-cli-state-of-the-art.md)
