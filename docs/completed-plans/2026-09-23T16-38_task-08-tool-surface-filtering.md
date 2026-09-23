# Task 8: Tool Surface Filtering by Tier

> **Status**: Ready for implementation
> **Implementer**: Gemini Flash 3.8 High
> **Depends on**: Task 7 (rewrite_file tool exists), Model Capability Tier System (Phase 1)
> **Estimated scope**: Small — the implementation is already complete, work is wiring + tests

## Background

Tool surface filtering is **already fully implemented**:

- [`filterToolsByTier()`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/model-tier.ts#L288-L304) — pure function that filters tool arrays by tier
- [`TIER_SAFE_TOOLS`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/model-tier.ts#L240-L255) — tools safe for all tiers
- [`TIER_COMPLEX_TOOLS`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/model-tier.ts#L262-L275) — tools hidden from C/D tiers
- [`tools_filter_by_tier`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/v1/config/config.ts#L114-L117) — config field (already in schema)
- The filtering is **already wired** into [`src/session/tools.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/tools.ts#L134-L137):
  ```typescript
  if (input.tierInfo) {
    rawTools = filterToolsByTier(rawTools, input.tierInfo, input.toolsFilterByTier !== false)
  }
  ```
- And called from [`src/session/prompt/loop.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt/loop.ts#L401):
  ```typescript
  toolsFilterByTier: cfg.tools_filter_by_tier,
  ```

**What remains**: The existing test coverage in `test/model-tier.test.ts` covers the `filterToolsByTier` function with 15 tests, but the _integration_ — that the loop actually passes `tierInfo` and the config flag to `resolveDefinitions` — is not directly tested. Additionally, the `TIER_SAFE_TOOLS` and `TIER_COMPLEX_TOOLS` sets should be audited against the actual tool registry to ensure nothing is missing.

## Proposed Changes

### Audit

#### [VERIFY] Tool Set Completeness

Compare `TIER_SAFE_TOOLS` + `TIER_COMPLEX_TOOLS` against the full tool registry in [`src/tool/registry.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/registry.ts) and [`src/foxcode/tool/registry.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/tool/registry.ts). Identify any tools that appear in neither set. These "uncategorized" tools will be available to all tiers by default (since `filterToolsByTier` only removes tools in `TIER_COMPLEX_TOOLS`).

Current built-in tool IDs from the registry:
- `read`, `grep`, `glob`, `bash`, `write`, `edit`, `apply_patch`, `task`, `skill`, `webfetch`, `websearch`, `question`, `todowrite`, `rewrite_file`, `commit`, `lsp`, `lookup_symbols`, `fetch_repo_map`, `repo_clone`, `repo_overview`, `recall`, `suggest`, `plan_exit`, `open_plan`, `invalid`
- Fox tools: `agent_manager`, `fox_memory_save`, `fox_memory_recall`, `kilo_memory_save`, `kilo_memory_recall`, `kilo_local_recall`, `board_read`, `board_post`, `semantic_search`, `agent_manager_models`
- Code mode: `code_mode` (when experimental)
- Notebook tools: `notebook_read`, `notebook_edit`, `notebook_execute`

Tools currently uncategorized (in neither TIER_SAFE nor TIER_COMPLEX):
- `commit` — involves git operations, arguably complex for C/D → **add to `TIER_COMPLEX_TOOLS`**
- `repo_clone` — network + disk write, but single invocation → leave uncategorized (available to all)
- `repo_overview` — read-only → **add to `TIER_SAFE_TOOLS`**
- `suggest`, `plan_exit`, `open_plan` — UI/plan tools, simple → leave as-is
- `recall` — read-only → **add to `TIER_SAFE_TOOLS`**
- `semantic_search` — read-only → **add to `TIER_SAFE_TOOLS`**
- `websearch` — read-only → **add to `TIER_SAFE_TOOLS`**
- `board_read`, `board_post` — simple → leave as-is
- `notebook_*` — complex, already in `guarded` set → **add `notebook_edit`, `notebook_execute` to `TIER_COMPLEX_TOOLS`**

### Code Changes

#### [MODIFY] [`src/foxcode/model-tier.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/model-tier.ts)

Update the tool sets based on the audit above:

```typescript
export const TIER_SAFE_TOOLS = new Set([
  "read",
  "grep",
  "glob",
  "bash",
  "webfetch",
  "websearch",       // ← ADD
  "question",
  "invalid",
  "todowrite",
  "rewrite_file",
  "recall",           // ← ADD
  "repo_overview",    // ← ADD
  "semantic_search",  // ← ADD
  // Kilo tools that are read-only / status
  "agent_manager_models",
  "fox_memory_recall",
  "kilo_memory_recall",
  "kilo_local_recall",
])

export const TIER_COMPLEX_TOOLS = new Set([
  "task",
  "write",
  "edit",
  "apply_patch",
  "skill",
  "lookup_symbols",
  "fetch_repo_map",
  "lsp",
  "commit",              // ← ADD
  "notebook_edit",       // ← ADD
  "notebook_execute",    // ← ADD
  // Kilo write tools that require multi-step reasoning
  "agent_manager",
  "fox_memory_save",
  "kilo_memory_save",
])
```

### Tests

#### [MODIFY] `test/model-tier.test.ts`

Add tests for the newly added tool IDs:

1. **`commit` is in TIER_COMPLEX_TOOLS** — verify `filterToolsByTier` removes it for Tier C
2. **`websearch` is in TIER_SAFE_TOOLS** — verify it survives Tier D filtering
3. **`recall` is in TIER_SAFE_TOOLS** — verify it survives Tier D filtering
4. **`repo_overview` is in TIER_SAFE_TOOLS** — verify it survives Tier D filtering
5. **`semantic_search` is in TIER_SAFE_TOOLS** — verify it survives Tier D filtering
6. **`notebook_edit` is in TIER_COMPLEX_TOOLS** — verify it's removed for Tier C
7. **Completeness test** — verify that every tool ID in TIER_SAFE_TOOLS is not also in TIER_COMPLEX_TOOLS (no overlap)

**Minimum required: 7 new tests.**

### Documentation

#### [MODIFY] `src/foxcode/skills/fox-config.md`

Add `tools_filter_by_tier` to the "Other Top-Level Fields" table:

| Field | Type | Description |
|---|---|---|
| `tools_filter_by_tier` | `boolean` | Filter tools by model tier. Default: `true` |

## Verification Plan

### Automated Tests

```bash
timeout 30s CI=true bun test test/model-tier.test.ts
timeout 45s bun run typecheck
```

### Manual Verification

None required — the wiring is already in place; this task adds categorization corrections and test coverage.
