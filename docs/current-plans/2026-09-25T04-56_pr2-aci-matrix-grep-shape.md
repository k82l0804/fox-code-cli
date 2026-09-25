# PR 2: ACI Tool Surface Matrix + Search Shape

**Tasks**: 2E-4, 2F-2
**Target implementer**: Gemini 3.8 Flash High
**Gate**: Typecheck + existing tests pass. Tier S/A sees `edit`+`rewrite_file`+`read`+`grep`+`glob`+`lsp`+`bash`. Tier C/D sees `grep`+`bash` only.
**Depends on**: PR 1 (exit gate must be in place first)

---

## Loop assertions enforced by this PR

1. Tier C/D model **never sees** `edit`, `apply_patch`, `rewrite_file`, `write`, `commit`, `read` as tool schemas in the LLM request. (2E-6 handles C/D editing via fence-parse.)
2. `apply_patch`, `write`, `commit` are **never** in the default tool surface for any tier.
3. `read` output is capped at 200 lines + hard byte cap. Offset pagination works.
4. Syntax gate rejects edits that introduce **new** parse errors (compare to pre-edit error count).
5. `grep`/`search` returns `{path, hitCount, 1–2 preview lines}` by default, not full hunks.

## Non-goals / Do not break

- **Local-first, prefix stability, transactional apply**: unchanged.
- **Existing tool implementations**: `edit`, `rewrite_file`, `apply_patch` internal logic stays. Only the surface exposure and output formatting changes.
- **PR 1's exit gate**: Do not modify `resolveExitCondition()`. The gate works with whatever tools are present.

---

## 1. Canonical ACI Matrix

Implement in [`src/foxcode/model-tier.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/model-tier.ts) and [`src/tool/registry.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/registry.ts):

| Tier | Edit tools | Explore tools | Shell |
|------|-----------|---------------|-------|
| **S/A** | `edit`, `rewrite_file`(create:true) | `read` (paginated), `grep`, `glob`, `lsp` | `bash` |
| **B** | `edit`, `rewrite_file` | `read` (paginated), `grep`, `glob`, `lsp` | `bash` |
| **C/D** | **none** (2E-6 fence-parse) | `grep` only (+ `read` dynamic after failed apply) | `bash` |

### Tools removed from default surface for ALL tiers
- `apply_patch` — stays in codebase for internal harness use, removed from tool schemas
- `write` — subsumed into `rewrite_file` with `create: true` flag
- `commit` — harness-side only (PR 1's 2F-1)
- `fetch_repo_map` — for C/D, removed (map injected in prefix by PR 3)
- `lookup_symbols` — for C/D, removed (reserved for S/A opt-in)

### `rewrite_file` gets `create: true`

Modify [`src/tool/rewrite_file.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/rewrite_file.ts): add a `create` boolean parameter to the tool schema. When `create: true`, create the file if it doesn't exist (subsumes `write` tool). S/A and B tiers get this. C/D does not see `rewrite_file` as a tool.

---

## 2. Syntax Gate on Edit Application

### Where to add

In [`src/tool/edit.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/edit.ts) and [`src/tool/rewrite_file.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/rewrite_file.ts), after computing the new file content but before writing to disk:

```typescript
import { syntaxCheck } from "./syntax-gate"

// Before writing:
const preErrors = await syntaxCheck(originalContent, filePath)
const postErrors = await syntaxCheck(newContent, filePath)
if (postErrors.count > preErrors.count) {
  return {
    output: `Edit rejected: introduces ${postErrors.count - preErrors.count} new syntax error(s).\n${postErrors.summary}`,
    metadata: { rejected: true },
  }
}
```

### `src/tool/syntax-gate.ts` (new file)

Use tree-sitter parse (available via `@foxcode/indexing`). If tree-sitter grammar not available for the language, skip the gate (fail open). Compare error node count, not absolute clean.

---

## 3. Bounded `read` Tool

### Modify [`src/tool/read.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/read.ts)

- Add `offset` parameter to tool schema (default 0).
- Cap output at **200 lines** per call (configurable via `max_read_lines`).
- Add hard **byte cap** of 50KB (catches minified bundles).
- Always include line numbers.
- When truncated, append: `"... N more lines (M bytes), use offset=K to continue"`

---

## 4. Grep Shape: Files + Counts (2F-2)

### Modify [`src/tool/grep.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/grep.ts)

Default output format changes from full hunks to summary:

```
Found "searchTerm" in 12 files:
  src/session/prompt/loop.ts       (7 hits) — line 217: if (lastAssistantMsgRef?.finish &&
  src/session/processor.ts         (3 hits) — line 643: if (Verification.MUTATION_TOOLS.has(value.name))
  packages/core/src/verification.ts (2 hits) — line 78: export const MUTATION_TOOLS = new Set([...
  ... and 9 more files
```

- Cap at ~20 files in summary mode.
- Add `context` boolean parameter to schema. When `context=true`, return full hunks (existing behavior).
- Include 1–2 preview lines per file (first match).

---

## 5. Empty Success Formatting

Any tool result that produces no output returns `"Command completed successfully with no output."` instead of `""`. Apply to `bash` tool in [`src/tool/shell.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/shell.ts) and any tool that can return empty string on success.

---

## Files Summary

| Action | File | Description |
|--------|------|-------------|
| **Create** | `src/tool/syntax-gate.ts` | Tree-sitter parse gate for edits |
| **Modify** | `src/foxcode/model-tier.ts` | Tier → tool surface mapping |
| **Modify** | `src/tool/registry.ts` | Surface selection per tier |
| **Modify** | `src/tool/edit.ts` | Syntax gate integration |
| **Modify** | `src/tool/rewrite_file.ts` | `create: true` flag + syntax gate |
| **Modify** | `src/tool/read.ts` | 200-line cap, offset param, byte cap |
| **Modify** | `src/tool/grep.ts` | Summary mode default + `context` param |
| **Modify** | `src/tool/shell.ts` | Empty output → success message |
| **Modify** | `src/tool/write.ts` | Deprecation: redirect to `rewrite_file(create:true)` |

## Tests

1. Tier routing: S/A → sees `edit`, `rewrite_file`, `read`, `grep`, `glob`, `lsp`, `bash`. Does NOT see: `apply_patch`, `write`, `commit`.
2. Tier C/D → sees `grep`, `bash` only.
3. Syntax gate: edit introduces new parse error → rejected. File already invalid + error count unchanged → accepted.
4. Read pagination: request 200+ line file → capped, offset param returns next chunk, byte cap catches minified.
5. Grep summary: broad search → file+count+preview. `context=true` → full hunks.
6. Empty output: `bash exit 0` with no stdout → "Command completed successfully with no output."
7. `rewrite_file(create: true)` on non-existent file → creates it.
8. `timeout 45s bun run typecheck` passes.
