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

- [x] **11. System-Driven Model Routing** — [📋 Plan](../completed-plans/2026-09-23T18-42_task-11-system-driven-model-routing.md)
  `recommendModelForTask(agentMode, availableModels[])` — system picks cheapest viable model for each subtask. Tier-based: research on Tier C, planning on Tier A/S, implementation on Tier B+.

- [x] **12. Blast-Radius Regression Detection (3b)** — [📋 Plan](../completed-plans/2026-09-23T18-42_task-12-blast-radius-regression-detection.md)
  Baseline test tracking to distinguish "I broke this" from "this was already broken." Structured input for future Guardian.

- [x] **13. LSP Confidence Scoring (6a)** — [📋 Plan](../completed-plans/2026-09-23T18-42_task-13-lsp-confidence-scoring.md)
  Language-aware edit confidence. The parity matrix shows AST/symbol index as a top gap.

- [x] **14. Repo-Level Intent Detection** — [📋 Plan](../completed-plans/2026-09-23T18-42_task-14-repo-level-intent-detection.md)
  Classify task scope and blast radius from the goal description before planning.

---

## Phase 2D — Agent Faultline Benchmark (2026-09-24) ✅

> 100-challenge tiered benchmark (10 tiers × 10 challenges). Infrastructure built, all challenges authored.
> Competitive analysis completed via research docs rather than automated runner — identified root causes
> (loop-exit bug, verification wiring, tool surface sprawl) that drove Phase 2E design.
> 2D-4 (automated competitive runner) and 2D-5 (mechanical hardening) deferred to testing infrastructure;
> superseded strategically by Phase 2E SOTA Harness.

- [x] **2D-1. Benchmark Infrastructure** — [📋 Plan](../completed-plans/2026-09-23T22-41_task-2d-1-benchmark-infrastructure.md)
  `rubric.ts` (5-dimension scoring), `runner.ts` (sandbox + agent invocation), `reporter.ts`, `comparator.ts`. Scripts: `bun run bench`, `bun run bench:compare`.

- [x] **2D-2. Tier 1–5 Challenges (50)** — [📋 Plan](../completed-plans/2026-09-24T04-47_task-2d-2-tier-1-5-challenges.md)
  Sanity, Multi-step, Multi-file SWE, Error Recovery, Adversarial Instructions. 50 workspaces + verify scripts.

- [x] **2D-3. Tier 6–10 Challenges (50)** — [📋 Plan](../completed-plans/2026-09-24T05-00_task-2d-3-tier-6-10-challenges.md)
  Long-horizon, Unsafe Autonomy, Guardian+Autonomy, Arbitration, SWE-bench Bugs. 50 workspaces + verify scripts.

- [~] **2D-4. Competitive Evaluation** — Deferred. Strategic analysis completed via [`why-aider-wins.md`](../research/2026-09-24T20-20_why-aider-wins.md) and [`how-to-make-fox-code-cli-state-of-the-art.md`](../research/2026-09-24T20-30_how-to-make-fox-code-cli-state-of-the-art.md). Automated runner deferred to testing infrastructure.

- [~] **2D-5. Fox Hardening** — Superseded by Phase 2E (SOTA Harness & Localization) which addresses root causes identified in the research.

---

## Phase 2E — SOTA Harness & Localization (2026-09-25) ✅

> SOTA harness loop: exit gate, verification reflection, localization pipeline, tool surface matrix,
> weak-model fast path, multi-attempt architecture. The harness owns done, context, and the edit contract.
> 781 tests pass, 0 failures, typecheck clean.
>
> 2F-1 (Harness-Owned Commit) and 2F-4 (Unified Control-Plane Table) were pulled forward into PR 1.
> 2F-2 (Search ACI: Files + Counts) was pulled forward into PR 2.

- [x] **2E-1. Loop-Exit Gate + Mutation Journal** — `src/session/mutation-journal.ts`, `src/session/control-plane.ts`. Append-only journal, `resolveExitCondition()` with 6-row exit table, reflection injection, `max_empty_exit_retries`. Intent detection fails open toward code-change.
- [x] **2E-2. Verification as Harness Reflection** — Exit-time verification with baseline comparison (only new regressions block). Repair budget hard cap. Fresh-verify skip. Parse-fail circuit breaker (3-strike). Wake-up audit logging.
- [x] **2E-3. Localization Pipeline + Code Context Block** — `src/session/code-context.ts`, `src/session/localize/{pipeline,bm25,graph,ranker}.ts`. 5k token envelope, BM25 over identifiers + PageRank graph, RRF fusion, function-level span extraction, cold-index non-blocking, honest cache key.
- [x] **2E-4. ACI Simplification — Tool Surface Matrix** — `TIER_TOOL_SURFACE` in `model-tier.ts`, `filterToolsByTier()`. Syntax gate (`src/tool/syntax-gate.ts`). Bounded `read` (200 lines + offset + byte cap). `commit`/`write`/`apply_patch` off default surface. Empty success formatting.
- [x] **2E-5. *(Merged into 2E-3)*** — Repo map injection + working-set pinning subsumed by `buildCodeContextBlock()`.
- [x] **2E-6. Weak-Model Fast Path** — `src/session/fence-parser.ts`. C/D contract: no edit tool schemas, fence-parse in harness. Accepts fenced blocks, `File:` headers, SEARCH/REPLACE. Journal records with `source: "fence-parse"`. `FENCE_INSTRUCTION_PROMPT` injected for C/D tiers.
- [x] **2E-7. Multi-Attempt Architecture** — `src/session/attempt.ts`, `src/session/attempt-selector.ts`. `fox run --attempts N` + `--attempt-timeout`. Git worktree isolation, sequential v1, deterministic selection (filter + rank), per-attempt timeout, signal-handler cleanup.
- [x] **2F-1. Harness-Owned Commit** _(pulled forward)_ — `harnessCommit()` in `processor.ts`. Deterministic commit message (`fox: <tool> <file>`). Empty diff → no commit. Rollback to last green commit.
- [x] **2F-2. Search ACI: Files + Counts** _(pulled forward)_ — Grep returns `{path, hitCount, preview}` by default. `context` param for full hunks.
- [x] **2F-4. Unified Control-Plane Table** _(pulled forward)_ — `resolveExitCondition()` in `src/session/control-plane.ts`. One function, 6-row matrix, combination tests.

