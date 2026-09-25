# PR 3: Code Context Block — Localization + Map + Pins

**Tasks**: 2E-3 (includes 2E-5)
**Target implementer**: Gemini 3.8 Flash High
**Gate**: Localize top-3 accuracy on fixture repo with decoy files. 5k token envelope respected. Cache key changes when map/pins change, stays stable when they don't.
**Depends on**: PR 2 (C/D tool surface must be trimmed first so map replaces removed tools)

---

## Loop assertion enforced by this PR

1. `buildCodeContextBlock()` output is **≤5000 tokens**. Allocation: map first, localize spans second, pinned bodies last (bodies truncated first when over budget).
2. Content hash of the code-context block is part of the `sysCache` key. **Refreshes only on**: session start, after successful apply/edit, after `/add`. NOT every turn.
3. On a code-change task, the model's first completion has access to the relevant file content — no `read` tool hop required.
4. Cold-index is non-blocking: generate starts immediately, block marked `partial` if index is still warming.

## Non-goals / Do not break

- **Local-first, prefix stability, transactional apply**.
- **PR 1's exit gate and PR 2's ACI matrix**: unchanged.
- Do NOT add new tools. The localize pipeline is harness-internal.
- Do NOT block the first LLM generation on index warming.

---

## 1. `buildCodeContextBlock()` — `src/session/code-context.ts` (new file)

### Single function, single envelope

```typescript
export interface CodeContextOptions {
  task: string                    // user message text
  tier: ModelTier                 // S | A | B | C | D
  indexer: ASTIndexer             // from @foxcode/indexing
  workingSet: string[]            // files from working set (2F-5, empty until then)
  mutatedFiles: string[]          // files the harness applied edits to this session
  projectDir: string
  maxTokens?: number              // default 5000
}

export interface CodeContextBlock {
  content: string                 // the full block to inject
  contentHash: string             // sha256 of content, for sysCache key
  partial: boolean                // true if index was cold
  mapTokens: number
  localizeTokens: number
  pinTokens: number
}

export function buildCodeContextBlock(options: CodeContextOptions): CodeContextBlock
```

### Token budget allocation (5000 total)

1. **Repo map** (~1000 tokens for S/A, ~1500 for C/D): signatures-only map trimmed by task keyword overlap + PageRank in import graph + files the harness has edited this session.
2. **Localize spans** (~1500 tokens): top 3–5 `{file, span_start, span_end, score, reason}` from the pipeline.
3. **Pinned file bodies** (remainder): full content of pinned files, truncated from the end when over budget. Pins = localize top spans ∪ mutated files ∪ working set. Up to 4 files.

**Trimming algorithm** (when over the 5000-token envelope):

```
1. Compute mapTokens, localizeTokens, pinTokens.
2. If total > maxTokens:
   a. Truncate pinned bodies from the end (remove last pin, then shorten remaining).
   b. If still over: reduce localize spans from 5 → 3 (drop lowest-scored).
   c. If still over: reduce map entries by removing files with lowest keyword overlap.
3. Assert total <= maxTokens.
```

Token counting: use `Math.ceil(text.length / 4)` as a fast heuristic (matches GPT-family tokenizers). Do NOT import a full tokenizer.

### Injection point

In [`loop.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt/loop.ts), after resolving the agent and model (line ~295), before building the system prompt:

```typescript
// Build code context block (refreshes only when needed)
if (codeContextDirty || !codeContextCache) {
  codeContextCache = buildCodeContextBlock({ ... })
  codeContextDirty = false
}
// Include contentHash in sysCache key
sysCache.codeContextHash = codeContextCache.contentHash
```

Inject the block into the system prompt via [`prepare.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt/prepare.ts) as a suffix section.

**sysCache integration**: The current `sysCache` in `loop.ts` (lines 161–166) is invalidated by agent name comparison (line 470: `if (sysCache.agentName !== agent.name)`), not by a hash function. Add a `codeContextHash?: string` field to the `sysCache` type. When building the system prompt, include the hash in a new field so the prompt changes when the code-context block changes. The `sysCache` invalidation check stays agent-name–driven; the code-context block is rebuilt separately via its own dirty flag.

### Dirty flag

Set `codeContextDirty = true` on:
- Session start (`step === 0`, approximately line 172 in `loop.ts`)
- After a successful apply/edit — set from `processor.ts` after `journal.record()` (PR 1 integration point, after line 719). Expose via a callback or session-level flag that `loop.ts` reads.
- After `/add` command — set where `/add` handler pushes files to the working set (see `src/session/prompt/commands.ts`).

NOT on every turn. This preserves `sysCache` hit rate.

---

## 2. Localization Pipeline — `src/session/localize/`

### `pipeline.ts` (orchestrator)

Only runs on code-change tasks (same `isCodeChangeTask()` check from PR 1).

```typescript
export interface LocalizeResult {
  spans: Array<{
    file: string
    spanStart: number
    spanEnd: number
    score: number
    reason: string
  }>
  partial: boolean  // true if index was cold
}

export function localize(task: string, indexer: ASTIndexer, projectDir: string): LocalizeResult
```

### `bm25.ts` (text scoring)

BM25 search over **exported identifiers + comments/docstrings** from the AST indexer, not just filenames from `git ls-files`.

Key requirement: "sliding window carry-over" must match `rate_limiter.ts` even if the filename doesn't say "sliding window." This means the corpus is: `{filename, exportedSymbolNames, docstrings, comments}` per file.

### `graph.ts` (symbol graph queries)

Extend [`packages/fox-indexing/src/ast/indexer.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/fox-indexing/src/ast/indexer.ts) to expose:
- `callers(symbol)`: who calls this function
- `callees(symbol)`: what does this function call
- `importers(file)`: who imports this file

These are **harness-internal functions**, not tools. `lookup_symbols` stays as an optional deep-dive tool for Tier S/A.

### `ranker.ts` (RRF fusion + span ranking)

Reciprocal Rank Fusion of BM25 scores + graph centrality (callers/callees count). Top-K files (K=5) then get function-level span extraction via tree-sitter AST.

### Cold-index non-blocking

If the index is cold (first run):
- Serve path + symbol BM25 from whatever is warm (file list from `git ls-files` + any partial index).
- Mark `block.partial = true`.
- Do NOT block the first generate on a full AST scan.
- Background: kick off index warming for subsequent turns.

### AST-boundary chunking

All retrieval chunks align to tree-sitter function/class boundaries, never arbitrary character windows.

---

## 3. Repo Map Injection

Auto-inject into code-context block:
- Signatures-only: `file → exported function/class/type signatures`
- Trim by: (a) task keyword overlap, (b) PageRank in import graph, (c) files the harness has applied edits to this session
- Token allocation: S/A ~1000 tokens; C/D ~1500 (weak models need more context)
- For C/D: remove `fetch_repo_map` and `lookup_symbols` from tool surface (done in PR 2)

---

## 4. Working-Set File Pinning

Pins = localize top spans ∪ mutated files. Up to 4 files. Pinned body budget = remainder of 5k envelope after map + localize.

Not "last 4 reads" (that oscillates). Stable until: new localize run (after apply), or explicit `/drop`.

Full `/add`/`/drop` as first-class session object deferred to 2F-5.

---

## Files Summary

| Action | File | Description |
|--------|------|-------------|
| **Create** | `src/session/code-context.ts` | `buildCodeContextBlock()` |
| **Create** | `src/session/localize/pipeline.ts` | Orchestrator |
| **Create** | `src/session/localize/bm25.ts` | BM25 over identifiers + docstrings |
| **Create** | `src/session/localize/graph.ts` | callers/callees/importers |
| **Create** | `src/session/localize/ranker.ts` | RRF fusion + span ranking |
| **Modify** | `src/session/prompt/loop.ts` | Call `buildCodeContextBlock()`, include hash in sysCache |
| **Modify** | `src/session/prompt/prepare.ts` | Inject block into system prompt suffix |
| **Modify** | `packages/fox-indexing/src/ast/indexer.ts` | Expose callers/callees/importers |
| **Modify** | `src/foxcode/model-tier.ts` | C/D map token allocation (1500 vs 1000) |

## Tests

1. BM25 unit: score identifiers, verify "sliding window" matches `rate_limiter.ts`.
2. Graph unit: callers/callees/importers return correct results on fixture.
3. RRF fusion: combined ranking outperforms either signal alone on fixture.
4. Integration: task description + fixture repo with **decoy files** → correct file in top-3.
5. Envelope: map + localize + pins never exceed 5000 tokens.
6. **Envelope overflow regression**: deliberately feed 20 large files as pins → trimming engages, bodies truncated first, then spans, then map. Final output ≤ 5000 tokens.
7. Cache key: changes when content changes, stable when it doesn't.
8. Map refresh after apply: new cache key, correct content.
9. Cold-index: generate starts without blocking; block marked `partial`.
10. Localize not run on Ask/explain tasks.
11. "the rate limiter tests are failing" → localizes to `rate_limiter.ts`.

> **Refinement pass**: Completed 2026-09-25. No issues found.
