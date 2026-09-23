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
