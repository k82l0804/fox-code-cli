# Fox Code CLI — Code Cleanup Plan

> **Derived from:** 8-phase codebase review (1,846 files, ~237K lines)
> **Environment:** National security R&D lab — local OpenAI-compatible models only
> **Kept:** GitLab (local), web search, MCP, TUI, compression pipeline
> **Goal:** Lean, testable, maintainable codebase — no dead weight
> **Status:** ✅ **COMPLETED** (Commits `8409253` through `3a8b687`, 270 app tests + full monorepo pass)

---

## Overview

Four cleanup tracks, ordered by dependency and risk:

```
Track A: Delete Dead Weight ─────────────────── (Week 1, ~10K lines removed)
Track B: Bootstrap Test Coverage ────────────── (Week 1–2, ~6 new test files)
Track C: Refactor Monoliths & State ─────────── (Week 3–6, requires Track B)
Track D: Housekeeping & Polish ──────────────── (Ongoing, independent)
```

Tracks A and B have no dependencies and run in parallel during Week 1.
Track C requires Track B (tests) as a safety net.
Track D is opportunistic — tackle items whenever convenient.

---

## Track A — Delete Dead Weight

### Priority: 🔴 IMMEDIATE | Risk: Low | Impact: ~10,000 lines removed

Remove code that has no purpose in a local-only, lab environment.

#### A1: Kilo-vs-Fox Comparison Tools (zero risk)

Just delete. No imports, no callers.

```bash
git rm tools/fork-showdown-kilo-vs-unoptimized-fox.sh   # 459 lines
git rm tools/fox-vs-kilo-realworld-eval.sh               # 506 lines
git rm tools/fox-vs-kilo-showdown.ts                     # 860 lines
```

| Lines removed | 1,825 |
|---|:---:|

---

#### A2: Dev/Debug Code

| File | Lines | Action |
|---|:---:|---|
| `src/cli/cmd/run/demo.ts` | 1,274 | Extract event factories to `test/fixtures/synthetic-events.ts`, then delete |
| `src/foxcode/plugins/session-v2-debug.tsx` | 1,227 | Delete — dev-only plugin shipping in production |
| `src/foxcode/review/review.txt` | 372 | Move to `docs/` or delete |

**Before deleting `demo.ts`**, extract the synthetic event generators (~400 lines) into `test/fixtures/synthetic-events.ts` for use in Track B tests.

| Lines removed | 2,873 |
|---|:---:|

---

#### A3: All Migration Code

No users migrating from Claude Code, Kilo, or opencode.

| File | Lines |
|---|:---:|
| `src/foxcode/config/claude-migration.ts` | 962 |
| `src/foxcode/ignore-migrator.ts` | 225 |
| `src/foxcode/mcp-migrator.ts` | 180 |
| `src/foxcode/modes-migrator.ts` | 224 |
| `src/foxcode/rules-migrator.ts` | 153 |
| `src/foxcode/workflows-migrator.ts` | 159 |
| `src/foxcode/provider/codex-refresh.ts` | 122 |
| `src/foxcode/docs/migration.md` | 389 |
| `src/foxcode/docs/rules-migration.md` | ~23 |

Also remove callers:
- Migration HTTP API routes (`src/foxcode/server/httpapi/groups/migrate.ts`, `handlers/migrate.ts`)
- `/resume-claude` and `/resume-codex` slash commands from `src/session/prompt.ts`
- Claude/Codex format handlers from `src/foxcode/session-resume/import.ts`

| Lines removed | ~3,070 |
|---|:---:|

---

#### A4: Cloud Provider Plugins

| File | Lines | What It Is |
|---|:---:|---|
| `src/plugin/openai/codex.ts` | 664 | OpenAI Codex (cloud ChatGPT API) |
| `src/plugin/openai/ws-pool.ts` | 278 | WebSocket pool for Codex |
| `src/plugin/modal/modal.ts` | 21 | Modal.com cloud compute |
| `src/plugin/modal/models.ts` | 136 | Modal model catalog |

> ⚠️ **Verify first:** Check that `src/plugin/openai/openai.ts` and `src/plugin/openai/index.ts` provide the standard OpenAI-compatible API used by your LiteLLM proxy. Keep those. Only delete `codex.ts` and `ws-pool.ts`.

| Lines removed | ~1,099 |
|---|:---:|

---

#### A5: Kilo Backward Compat Aliases

| Location | What to Remove |
|---|---|
| `src/index.ts` | `KILO_PRINT_LOGS`, `KILO_LOG_LEVEL`, `KILO_PURE`, `KILO_PID`, `KILO_CLIENT` |
| `src/foxcode/config/config.ts` | `kilo.jsonc`, `kilo.json`, `opencode.jsonc`, `opencode.json` file support |
| `src/foxcode/config/config.ts` | `.kilo`, `.kilocode` config directory suffixes |
| `bin/fox` | `KILO_CLIENT: "cli"` env var |
| Everywhere | Run `git grep "KILO_"` and remove all remaining aliases |

| Lines removed | ~150 |
|---|:---:|

---

#### A6: Cloud Provider Transforms (⚠️ highest risk — do last)

Surgically remove cloud transforms from `src/provider/transform.ts` (1,268 lines). This file has 50+ references to cloud providers.

**Remove transforms for:** Anthropic, Google/Gemini, Bedrock, Vertex, Mistral, Groq, DeepSeek, OpenRouter, xAI, Cerebras, Fireworks, Together, SambaNova, Copilot.

**Keep:** OpenAI-compatible transform (this is what LiteLLM uses).

Also remove `GitLabWorkflowLanguageModel` from `src/session/llm.ts` (cloud GitLab Duo, not your local GitLab).

| Lines removed | ~1,000 |
|---|:---:|

---

#### Track A Verification

After each step:
```bash
timeout 45s bun run typecheck
```

After all A steps complete:
```bash
timeout 45s bun run typecheck
timeout 180s bun run test
timeout 60s bun run build
```

#### Track A Summary

| Step | Lines Removed | Files Deleted/Modified |
|---|:---:|:---:|
| A1: Comparison tools | 1,825 | 3 deleted |
| A2: Dev/debug | 2,873 | 3 deleted |
| A3: Migration code | 3,070 | 9 deleted + 3 modified |
| A4: Cloud plugins | 1,099 | 4 deleted |
| A5: Kilo compat | 150 | ~10 modified |
| A6: Cloud transforms | 1,000 | 2 modified |
| **Total** | **~10,017** | **~19 deleted, ~15 modified** |

---

## Track B — Bootstrap Test Coverage

### Priority: 🔴 CRITICAL | Timeline: Week 1–2

This unblocks Track C. Without tests, refactoring is unsafe.

#### B1: Quick Wins (Day 1)

One-line fixes from the review — no tests needed:

| Fix | File | Effort |
|---|---|:---:|
| Replace hardcoded path with `import.meta.dir` | `test/standard-suite.test.ts:44` | 1 min |
| Replace `JSON.stringify` equality with deep-equal | `processor.ts:469` | 5 min |
| Move `AI_SDK_LOG_WARNINGS = false` to entrypoint | `prompt.ts:100` | 5 min |

---

#### B2: Pure Function Tests (Week 1)

Create 6 new test files covering 13 pure functions:

| Test File | Functions Covered |
|---|---|
| `test/session/llm-adapter.test.ts` | `toLLMEvents` — AI SDK → LLMEvent stream |
| `test/session/doom-loop.test.ts` | Doom-loop detection in `processor.ts` |
| `test/session/compaction.test.ts` | `summaryText`, `completedCompactions`, `turns`, `preserveRecentBudget` |
| `test/session/overflow.test.ts` | `count`, `limit`, `measure`, `shouldCompact` |
| `test/tool/mcp-docker.test.ts` | `ensureDockerRm` |
| `test/foxcode/goal-action.test.ts` | `Goal.action` classification |

---

#### B3: Integration Tests Using Demo Fixtures (Week 2)

Use the event factories extracted from `demo.ts` (Track A2) to test the real reducers:

| Test File | What It Tests |
|---|---|
| `test/session/reducer.test.ts` | `reduceSessionData` state transitions |
| `test/session/permission-flow.test.ts` | Permission request → block → approve → resume |
| `test/session/subagent-data.test.ts` | Multi-agent tab state management |

---

## Track C — Refactor Monoliths & Clean Up State

### Priority: 🟡 HIGH | Timeline: Week 3–6 | Prerequisite: Track B complete

#### C1: Decompose `prompt.ts` (2,504 lines → ~8 modules)

| New Module | What to Extract |
|---|---|
| `prompt/attachment.ts` | MCP resource handling, base64 size calc |
| `prompt/structured.ts` | Structured output tool creation |
| `prompt/orphan.ts` | Orphaned tool cleanup |
| `prompt/command.ts` | Slash command parsing and execution |
| `prompt/shell.ts` | Shell session creation |
| `prompt/resume.ts` | Session resume/continuation |
| `prompt/context.ts` | Message assembly, system prompt building |
| `prompt/index.ts` | Orchestration (the remaining ~800 lines) |

**Process:** Extract one module at a time. After each extraction:
1. `bun run typecheck`
2. `bun run test`
3. Write a test for the extracted module
4. Commit

---

#### C2: Clean Up Module-Level State (24 files)

Migrate module-level `Map`/`Set`/`let` to `InstanceState.make()`:

**Critical (do first):**

| File | State Variables | Risk |
|---|:---:|---|
| `src/foxcode/sandbox/policy.ts` | 5 Maps + 1 let | Memory leak, no cleanup |
| `src/foxcode/session/prompt.ts` | `intakes` Map | Race condition |
| `src/foxcode/indexing.ts` | `consent` Map | Never pruned, unbounded growth |
| `src/mcp/index.ts` | `pendingOAuthTransports` | Auth state leaked |

**Moderate (batch together):**

| File | State |
|---|---|
| `src/foxcode/indexing-worker.ts` | Worker state Map |
| `src/foxcode/plan-followup.ts` | Plan tracking Map |
| `src/foxcode/pr-link.ts` | PR state Map |
| `src/foxcode/provider/metadata.ts` | Metadata cache Map |
| `src/foxcode/sandbox/inheritance.ts` | Inheritance Map |
| `src/foxcode/session/title.ts` | Title tracking Map |
| `src/foxcode/effect/instance-registry.ts` | Registry Map |

**Migration pattern:**
```typescript
// BEFORE (dangerous — lives forever, no cleanup)
const snapshots = new Map<string, Snapshot>()

// AFTER (safe — cleaned up on teardown, isolated for testing)
const state = yield* InstanceState.make(() =>
  Effect.succeed({ snapshots: new Map<string, Snapshot>() })
)
```

---

#### C3: Split `background-process/index.ts` (1,251 lines)

| New Module | What to Extract |
|---|---|
| `background-process/schema.ts` | ID, Status, Lifetime, Ready, Info schemas |
| `background-process/lifecycle.ts` | Start, stop, ready detection |
| `background-process/output.ts` | Output capture and truncation |
| `background-process/index.ts` | Service registration (remaining ~300 lines) |

---

## Track D — Housekeeping

### Priority: 🟢 LOW | Timeline: Ongoing

| # | Task | Effort |
|---|---|:---:|
| 1 | Fix outdated `kilo` branding in comments (`git grep "kilo run\|kilo --mini"`) | 1 hr |
| 2 | Consolidate `scripts/test-*.sh` with `package.json` scripts | 30 min |
| 3 | Fix `tools/README.md` reference to `src/kilocode/cli/logo.ts` | 5 min |
| 4 | Move `src/foxcode/review/review.txt` to `docs/` | 5 min |
| 5 | Add timeout-guarded exit to `src/index.ts` `finally` block | 15 min |
| 6 | Scope `process.type` monkey-patch in `mcp/index.ts` | 30 min |
| 7 | Add SHA-256 verification for LSP binary downloads | 2 hr |
| 8 | Clear timeout in SSE `cancel()` handler | 15 min |
| 9 | Integrate `bun run test:standard-suite` into CI | 2 hr |

---

## Execution Timeline

```
         Track A (Delete)              Track B (Tests)
Week 1 ┃ A1: comparison tools        ┃ B1: quick wins (day 1)
       ┃ A2: dev/debug               ┃ B2: pure function tests
       ┃ A3: migration code          ┃
       ┃ A4: cloud plugins           ┃
───────╋──────────────────────────────╋─────────────────────────
Week 2 ┃ A5: kilo compat             ┃ B3: integration tests
       ┃ A6: cloud transforms        ┃     (using demo fixtures)
───────╋──────────────────────────────╋─────────────────────────
         Track C (Refactor)             Track D (Housekeeping)
Week 3 ┃ C1: prompt.ts extraction    ┃ D1–D3: branding, scripts
       ┃ C2: critical state cleanup  ┃
───────╋──────────────────────────────╋─────────────────────────
Week 4 ┃ C1: continued               ┃ D4–D6: process fixes
       ┃ C2: moderate state cleanup  ┃
───────╋──────────────────────────────╋─────────────────────────
Week 5 ┃ C3: background-process      ┃ D7–D9: security, CI
───────╋──────────────────────────────╋─────────────────────────
Week 6 ┃ Buffer / mini-TUI extract   ┃
```

---

## Success Metrics

| Metric | Before | After Track A | After Track C |
|---|:---:|:---:|:---:|
| Total source lines | ~237K | ~227K | ~225K |
| Dead/unused files | 31 | 0 | 0 |
| Cloud service dependencies | 15+ | 0 | 0 |
| Test files for orchestration | 0 | 9 | 15+ |
| Largest single file | 2,504 | 2,504 | <800 |
| Files with module-level mutable state | 24 | 24 | <5 |
| P1 issues open | 22 | 16 | 8 |
| Migration/compat code | 2,437 | 0 | 0 |

---

## Reference Documents

| Document | Path |
|---|---|
| Codebase Review Plan | `docs/codebase-review-plan.md` |
| Review Tracker | `docs/reviews/full-codebase-review-tracker.md` |
| Post-Review Action Plan | `docs/plans/post-review-action-plan.md` |
| Code Removal Plan | `docs/plans/code-removal-plan.md` |
| Phase 1–8 Reviews | Review artifacts in `.gemini/` |
