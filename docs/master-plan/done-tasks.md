# Done Tasks

> Completed phases and items. Each entry records what was delivered and when.

---

## Phase 1 — Core Foundations (Q4 2026) ✅

- [x] **Named Shadow Checkpoints & /undo** — `packages/core/src/checkpoint.ts`, `fox checkpoint list/create/undo/diff`
- [x] **Local Model Profiles & Prompts Matrix** — `model-profiles.json`, `--profile` flag, non-Chinese open weights: Llama 3.1/3.3, Codestral/Mistral, Gemma 2/4, Nemotron, GPT-OSS
- [x] **All-or-Nothing Patch Repair Prompt Templates** — Updated `apply_patch.txt`, `edit.txt`, `default.txt` system prompts for transactional (all-or-nothing) failure recovery
- [x] **Static Tool Resolution Caching** — Split `resolveDefinitions` (cached) + `bindExecutionContext` (per-step) in Blueprint 11.1
- [x] **Model Capability Tier System (Phase 1)** — `resolveTier()` cascade (override → profile → pattern → heuristic), `ModelTier` types (S/A/B/C/D), step capping + coding warnings, 94 tests

> **Note**: ACP Metadata Debounce & Batching deferred to `fox-acp-client` VS Code extension repository. Does not block CLI.

---

## Phase 1B — Compression Hardening (2026-09-22) ✅

> Challenge Ladder: **334/334 (100.0%)**. Suite expanded from 300 → 334 fixtures. 3 bugs found and fixed.

- [x] **GitOps Preservation Rule**
- [x] **Stability Fixes**
- [x] **GAIA Keyword Fix**
- [x] **Score Tracking Infrastructure** — `tools/challenge-snapshot.ts` + `docs/challenge-history/`
- [x] **CI Gate for Challenge Score** — `test:challenge` in `package.json`
- [x] **Heuristic Workload Classification (BP 12)** — Delivered as Phase 2.0 Adaptive Compression

---

## Phase 2.0 — Adaptive Compression (2026-09-22) ✅

> Content classifier + 3 new risk-gated transforms. Token savings: **15.8% → 19.1%** (+3.3pp).
> 279 smoke tests pass. Zero regressions. Sub-millisecond overhead.

- [x] **Content Classifier (`compression-levels.ts`)**
- [x] **Timestamp Stripping (Level 1)**
- [x] **Boilerplate Header Stripping (Level 1)**
- [x] **Repeated Pattern Collapsing (Level 2)**
- [x] **Pipeline Integration + Safety Rails**
- [x] **Guardian-Ready Interface (`CompressionPolicyOverride`)**

---

## Phase 2A — Core Infrastructure (2026-09-23) ✅

> Multi-command auto-verification pipeline, turn-supersession context pruning, dynamic context window discovery, atomic task-completion commits, paginated message loading, and JSON serialization bypass.
> All 6 tasks complete, typecheck passes, all test suites pass (292 smoke tests, 44 verification, 19 supersede, 8 discovery, 9 commit, 9 pagination).

- [x] **1. Multi-Command Auto-Verification Pipeline** — [📋 Plan](../completed-plans/2026-09-23T12-40_plan-multi-cmd-verification.md)
  Extend `verification.ts` to run typecheck → tests → lint as a configurable sequence.

- [x] **2. Turn-Supersession Context Pruning** — [📋 Plan](../completed-plans/2026-09-23T12-40_plan-supersession-pruning.md)
  Extend `supersede.ts` to cover grep/glob/re-read/verification supersession patterns.

- [x] **3. Dynamic Context Window Discovery** — [📋 Plan](../completed-plans/2026-09-23T12-40_plan-dynamic-context-window.md)
  Query `/v1/models` for actual context limits to feed into compaction thresholds.

- [x] **4. Atomic Task-Completion Commits** — [📋 Plan](../completed-plans/2026-09-23T12-40_plan-atomic-commits.md)
  New `commit` tool with LLM-generated messages, replacing ad-hoc `git commit` via bash.

- [x] **5. Paginated Message Loading** — [📋 Plan](../completed-plans/2026-09-23T12-40_plan-paginated-loading.md)
  Cursor-based pagination for session message loading (UI performance).

- [x] **6. JSON Serialization Bypass** — [📋 Plan](../completed-plans/2026-09-23T12-40_plan-json-bypass.md)
  Cache token estimates and tool schemas to eliminate redundant `JSON.stringify` calls.

---

## Phase 2B — Model Intelligence (2026-09-23) ✅

> Tier-aware tool surfaces, small model safety, runtime reclassification, and specialized subagents.
> All 4 tasks complete, typecheck passes, all test suites pass (292 smoke, 119 model-tier, 19 rewrite-file, 19 subagent tests).
> Code review identified and resolved 4 plan-quality issues (2 omissions, 1 ambiguity, 1 insufficient granularity).

- [x] **7. Whole-File Rewrite Mode (Tier D)** — [📋 Plan](../completed-plans/2026-09-23T16-38_task-07-whole-file-rewrite-mode.md)
  New `rewrite_file` tool for tiny models. No diff, no hunk parsing — full-file overwrite.

- [x] **8. Tool Surface Filtering by Tier** — [📋 Plan](../completed-plans/2026-09-23T16-38_task-08-tool-surface-filtering.md)
  Hide complex tools from Tier C/D models. Audit and categorize all tools into `TIER_SAFE_TOOLS` / `TIER_COMPLEX_TOOLS`.

- [x] **9. Runtime Tier Reclassification** — [📋 Plan](../completed-plans/2026-09-23T16-38_task-09-runtime-tier-reclassification.md)
  Wire `reclassifyOnSuccess`/`reclassifyOnFailure` into session loop. C↔B transitions only, B-native models protected from demotion.

- [x] **10. Specialized Subagents** — [📋 Plan](../completed-plans/2026-09-23T16-38_task-10-specialized-subagents.md)
  Add `scout` (read-only research), `runner` (test/build execution), `scribe` (file writing) subagents. Rename experimental scout to `reference`.

---

## Phase 2C — Routing & Refinement (2026-09-23) ✅

> System-driven model selection and quality-of-life improvements.
> All 4 tasks complete, typecheck passes, all test suites pass.

- [x] **11. System-Driven Model Routing** — `recommendModelForTask(agentMode, availableModels[])` — system picks cheapest viable model for each subtask. Tier-based: research on Tier C, planning on Tier A/S, implementation on Tier B+.

- [x] **12. Blast-Radius Regression Detection (3b)** — Baseline test tracking to distinguish "I broke this" from "this was already broken." Structured input for future Guardian.

- [x] **13. LSP Confidence Scoring (6a)** — Language-aware edit confidence. The parity matrix shows AST/symbol index as a top gap.

- [x] **14. Repo-Level Intent Detection** — Classify task scope and blast radius from the goal description before planning.
