# Session Handoff: Competitive Features Roadmap Implementation

**Session ID**: `8d3ee5e0-5c40-4c1c-80d0-660c7ace72b1`  
**Date**: 2026-09-22  
**Workspace**: `fox-code-cli/` (Bun + Effect TS monorepo)

---

## What Was Accomplished This Session

### ✅ 1. Blueprint 6a — All-or-Nothing Patch Repair Prompt Updates
Updated agent error-recovery prompt templates for transactional patch failures:
- [`src/tool/apply_patch.txt`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/apply_patch.txt) — Added atomic rollback failure guidance
- [`src/tool/edit.txt`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/edit.txt) — Added transactional failure recovery instructions
- [`src/prompt/default.txt`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/prompt/default.txt) — Added system-level transactional awareness
- [`src/tool/apply-patch.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/apply-patch.ts) — Enhanced error messages for rollback states

### ✅ 2. Blueprint 11.1 — Static Tool Closure Resolution Caching
Refactored `src/session/tools.ts` to decouple `resolveDefinitions` (static, cacheable) from `bindExecutionContext` (per-request). Enables tool definition caching across turns (~10–50ms saved per turn).

### ✅ 3. Blueprint 1 Phase 1 — Incremental AST Caching
Full implementation of SQLite-backed Tree-sitter symbol indexing:

**New files created:**
- [`packages/fox-indexing/src/ast/schema.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/fox-indexing/src/ast/schema.ts) — SQLite schema (symbol_files + symbols tables) using `bun:sqlite`
- [`packages/fox-indexing/src/ast/grammars.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/fox-indexing/src/ast/grammars.ts) — Lazy WASM grammar loading for 36 languages via `tree-sitter-wasms`
- [`packages/fox-indexing/src/ast/extractor.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/fox-indexing/src/ast/extractor.ts) — Language-specific symbol extraction (TS/JS, Python, Go, Rust + generic fallback)
- [`packages/fox-indexing/src/ast/indexer.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/fox-indexing/src/ast/indexer.ts) — Core engine: git blob SHA1 caching, background scan, lookup/repoMap APIs
- [`src/tool/lookup_symbols.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/lookup_symbols.ts) + [`.txt`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/lookup_symbols.txt) — On-demand symbol lookup tool
- [`src/tool/fetch_repo_map.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/fetch_repo_map.ts) + [`.txt`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/fetch_repo_map.txt) — Hierarchical repository map tool

**Modified files:**
- [`src/tool/registry.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/registry.ts) — Wired both new tools into builtin registry
- [`packages/fox-indexing/package.json`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/fox-indexing/package.json) — Added `ast/` subpath exports

**Design decisions:**
- Enabled by default — no config gate, zero external dependencies
- Per-project DBs at `~/.local/state/fox/ast-cache/<project-hash>.db`
- Git blob SHA1 as cache key (zero hashing overhead from `git ls-files -s`)
- Session-start + first-tool-call scan trigger (no watcher in Phase 1)
- Top-level + class methods symbol depth

### ✅ 4. Roadmap Restructured
- Split Phase 2 into **Phase 2A (Autonomy Core)** and **Phase 2B (Refinement & Performance)**
- Phase 2A maps to Steps 4–8 of [`2026-09-22T15-16_autonomous-agent-workflow.md`](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/future/2026-09-22T15-16_autonomous-agent-workflow.md)
- Promoted Turn-Supersession and Atomic Commits to Phase 2A (were buried in Phase 2)
- Demoted Snapshot↔Oscillation to Phase 2B (works standalone, integration is refinement)
- Added missing Blueprint 11.3 (JSON Serialization Bypass) to Phase 2B
- Added risk callouts to routing, regression detection, and snapshot integration items
- Reconciled into [`docs/master-plan/`](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/master-plan/)

---

## Verification Status

| Check | Result |
|-------|--------|
| `bun run typecheck` | ✅ 0 errors |
| `bun run test` | ✅ 379 pass, 0 fail, 1100 expect() calls |

---

## Key Reference Documents

| Document | Purpose |
|----------|---------|
| [`docs/archived/2026-09-21T06-12_plan-competitive-features-roadmap.md`](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/archived/2026-09-21T06-12_plan-competitive-features-roadmap.md) | Archived mega-roadmap (superseded by master plan) |
| [`docs/master-plan/`](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/master-plan/) | **Master Plan** — single source of truth (current-tasks, future-tasks, done-tasks, deferred-tasks) |
| [`docs/future/2026-09-22T15-16_autonomous-agent-workflow.md`](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/future/2026-09-22T15-16_autonomous-agent-workflow.md) | Gold-standard 10-step autonomous SWE loop |

---

## What's Next — Prioritized Backlog

### Phase 1 Remaining (Q4 2026)
These are independent, lower-risk items:
1. **ACP Metadata Debounce & Batching** — Editor latency optimization in `fox-acp-client`
2. **Named Shadow Checkpoints & /undo** — Surface `/undo`, `/diff` in TUI
3. **Local Model Profiles & Prompts Matrix** — Qwen 2.5, DeepSeek R1/V3, Llama 3, Codestral profiles
4. **CI Invariant & Compression Gate** — `bun run test:standard-suite` gating

### Phase 2A: Autonomy Core (Q1 2027) — The Closed Loop
**This is the next major milestone.** These 7 items complete the autonomous `edit → verify → detect → route → prune → commit` loop:

1. **Auto-Verification Execution Pipeline (3a)** — **Start here.** Execute tests automatically after mutations. Compress output via LLTC. Everything downstream depends on this.
   - Entry points: `src/session/processor.ts` (where mutations happen), `packages/core/src/verification.ts` (infrastructure exists)
   - Key question: How to detect the project's test command (package.json scripts? Makefile? `.fox/config`?)

2. **Multi-Model Routing (4)** — Fast coder default + escalation after 2 failed turns.
   - Entry point: `src/session/llm.ts` (model selection)
   - Risk: Ping-pong escalation. Bound to max 2 wasted turns.

3. **Turn-Supersession Context Pruning** — Productionize `FOX_EXPERIMENTAL_COMPRESS_SUPERSEDE`.
   - Entry point: Existing experimental flag in compression pipeline

4. **Atomic Task-Completion Commits** — Interactive commit dialog on verified success.
   - Entry point: `src/snapshot/index.ts` (shadow git), TUI integration

5. **Blast-Radius Regression Detection (3b)** — Baseline test snapshot diffing.
   - Risk: Baseline invalidation, flaky tests. Deceptively complex.

6. **Dynamic Context Window Discovery (4b)** — `/v1/models` query for auto-sizing.
   - Dependency of #2 (routing needs to know model capabilities).

### Phase 2B: Refinement (Q1–Q2 2027)
Auto-Lint (3c), Snapshot↔Oscillation (3d), Paginated Loading (11.2), JSON Bypass (11.3), LSP Scoring, Intent Detection, Workload Classification (12), TUI Dashboard (13).

### Phase 3: Architecture (Q2 2027)
OS Sandboxing (10), MCP Security (8), Project Memory (7), Mini-TUI Decoupling, ACP Multi-Root, Cross-Session Checklists.

---

## Architectural Context for Next Agent

### Package Aliases (tsconfig paths)
| Alias | Location |
|---|---|
| `@/*` | `src/*` |
| `@opencode-ai/core` | `packages/core/src/` |
| `@opencode-ai/llm` | `packages/llm/src/` |
| `@foxcode/indexing` | `packages/fox-indexing/src/` |

### Key Patterns
- **Tool registration**: `Tool.define()` in `src/tool/*.ts`, `yield*` init in `registry.ts`, add to `builtin` array
- **Effect TS**: All services use `Effect.gen`, `Layer`, `Context`. Do not `Effect.provide(Layer)` inside request handlers.
- **Database**: `bun:sqlite` for local storage (see `packages/core/src/database/sqlite.bun.ts`)
- **Config**: Files in precedence order: `fox.jsonc`, `fox.json`, `kilo.jsonc`, `kilo.json`, `opencode.jsonc`, `opencode.json`

### Testing
```bash
bun run typecheck         # tsc --noEmit
bun run test:smoke        # Quick: typecheck + patch + edit + config (~30s)
bun run test              # Full: 379 tests across 34 files (~60s)
```

### Anti-Hang Rules
- Always prefix with `timeout`; never run interactive commands
- Always `CI=true` for test runners
- Never run `bun run dev` (launches interactive TUI)
- Always `GIT_TERMINAL_PROMPT=0` for git commands
