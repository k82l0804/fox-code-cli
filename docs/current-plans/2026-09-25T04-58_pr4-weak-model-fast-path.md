# PR 4: Weak-Model Fast Path — Whole-File Generation Format

**Task**: 2E-6
**Target implementer**: Gemini 3.8 Flash High
**Gate**: 8B model produces and applies a fence without tool calls. `edit` and `rewrite_file` are NOT in the tool schema.
**Depends on**: PR 2 (C/D tool surface already trimmed), PR 3 (code-context block provides the model with file content so it can produce a completion)

---

## Loop assertion enforced by this PR

1. Tier C/D models **never see edit/rewrite_file tool schemas**. Their completions are parsed by the harness for fenced file blocks.
2. If the harness finds a valid fenced block, it applies it via `rewrite_file` internally (transactional apply, existing path).
3. If no fenced block is found AND `isCodeChangeTask === true`, the empty-exit gate from PR 1 fires (reflection: "Please write the complete updated file in a fenced block").
4. PR 1's mutation journal records the harness-applied file as a mutation (so the exit gate sees it as work done).

## Non-goals / Do not break

- **Local-first, prefix stability, transactional apply**.
- Do NOT change how S/A/B tiers work. This is C/D only.
- Do NOT add a second model or an LLM-based fence detector. Pattern matching only.
- **Two C/D contracts cannot both ship**: fence-parse is THE C/D edit contract. `rewrite_file` tool stays off the C/D surface.

---

## 1. Fence Parser — `src/session/fence-parser.ts` (new file)

### Accepted formats (in priority order)

```
1. ``` filepath            (standard fenced block with filename on opening line)
   <file content>
   ```

2. File: path/to/file.ts   (Aider-style File: header + fenced block)
   ```
   <file content>
   ```

3. <<<< SEARCH             (SEARCH/REPLACE block, forwarded to edit tool)
   <original>
   ====
   <replacement>
   >>>> REPLACE
```

### Parser function

```typescript
export interface ParsedBlock {
  file: string                   // relative path extracted from header
  content: string                // file content
  format: "fence" | "search-replace"
  startLine: number              // position in assistant message (for logging)
}

/**
 * Extract file blocks from an assistant's text response.
 * Returns empty array if no valid blocks are found.
 * Tolerant: skips malformed blocks, extracts what it can.
 */
export function parseFencedBlocks(text: string): ParsedBlock[]
```

### Rules

- Multiple blocks in one message → each applied separately.
- If a block has no file path, skip it (it's explanation prose).
- File path resolution: relative to project root, normalized (`path.normalize`).
- SEARCH/REPLACE blocks forwarded to the existing `edit` tool internally (not exposed as a tool).

---

## 2. Harness Integration — Fence Capture in `processor.ts`

### Where to hook

In [`processor.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/processor.ts), after the LLM stream finishes and the assistant message is complete (the `text-delta` or `finish` handler), check if:
1. The model tier is C or D.
2. The assistant message has no tool calls.
3. The message contains text.

If all three: run `parseFencedBlocks(text)` on the message text.

### Applying parsed blocks

For each `ParsedBlock`:
1. Resolve file path relative to project root.
2. If `format === "fence"`: call `rewrite_file` internally (harness-side, not tool-call).
3. If `format === "search-replace"`: call `edit` tool internally.
4. Record to mutation journal (PR 1).
5. Run post-mutation verification if configured (existing `MUTATION_TOOLS` path in processor.ts).
6. Create harness commit (PR 1's 2F-1).
7. Append a `tool` part to the assistant message with the apply result (so the model sees what happened on the next turn if verification loops).

### Tool part format for applied fence

```typescript
const toolPart: SessionV1.ToolPart = {
  type: "tool",
  tool: "rewrite_file",        // or "edit" for search/replace
  callID: `fence-${Date.now()}`,
  input: { file: block.file },
  output: `Applied file block to ${block.file} (${block.content.length} bytes)`,
  metadata: {
    fenceParsed: true,
    files: [{ file: block.file }],
  },
}
```

---

## 3. System Prompt Instruction for C/D

In [`src/session/prompt/prepare.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt/prepare.ts), when tier is C or D, append to system prompt:

```
When making code changes, write the complete updated file in a fenced code block with the file path on the opening line:

```filepath.ts
// complete file content
```

Do not describe changes. Write the full file content directly.
```

This **replaces** the tool instructions section for C/D (since they have no edit tools). In `prepare.ts`, the existing tool-instruction block must be conditionally skipped when `tier === "C" || tier === "D"`, and the fence instructions inserted in its place. This prevents the model from seeing contradictory guidance (fence instructions + tool instructions).

### Dynamic fallback: `read` tool

If a C/D model asks to read a file (produces text like "let me look at the file" without actually having `read` in tools), add `read` to the tool surface dynamically for that session:

```typescript
const READ_FALLBACK_PATTERN = /\b(show|read|look at|view|open|display|cat|print)\s+(the\s+)?(file|contents|source|code)\b/i

function needsReadFallback(assistantText: string): boolean {
  return READ_FALLBACK_PATTERN.test(assistantText)
}

if (tierInfo.tier === "C" || tierInfo.tier === "D") {
  if (needsReadFallback(assistantText)) {
    // Add read tool to surface for this turn only
    dynamicTools.push("read")
  }
}
```

But this is a heuristic — the primary mechanism is the code-context block from PR 3 providing file content upfront.

---

## 4. Reflection for Empty Fence-Parse

If `parseFencedBlocks()` returns empty AND `isCodeChangeTask === true`:
- Do NOT consume an empty-exit retry (PR 1 handles that).
- The PR 1 exit gate sees `journal.isEmpty()` and fires the appropriate reflection.
- The reflection text from PR 1 is already tier-aware. For C/D it says:
  "Please write the complete updated file in a fenced code block with the file path."

---

## Files Summary

| Action | File | Description |
|--------|------|-------------|
| **Create** | `src/session/fence-parser.ts` | Parse fenced file blocks from text |
| **Modify** | `src/session/processor.ts` | Hook fence-parse after C/D text completion |
| **Modify** | `src/session/prompt/prepare.ts` | C/D system prompt: fence instructions |
| **Modify** | `src/foxcode/model-tier.ts` | C/D tier config: `useFenceParse: true` |
| **Modify** | `src/session/mutation-journal.ts` | Accept entries with any `source` string (free-form field, not enum). Fence-parse entries use `source: "fence-parse"`. |

## Tests

1. Fence parser: standard ` ```filepath ` block → correct file + content.
2. Fence parser: `File: path` header + block → correct.
3. Fence parser: SEARCH/REPLACE block → `format: "search-replace"`.
4. Fence parser: multiple blocks in one message → array of all.
5. Fence parser: block with no file path → skipped.
6. Fence parser: malformed block → skipped, others still extracted.
7. Integration: C/D model produces fenced block → harness applies it → journal records mutation with `source: "fence-parse"` → exit gate satisfied.
8. Integration: C/D model produces prose only → exit gate fires → reflection says "write the complete file in a fenced block".
9. Integration: S/A model produces fenced blocks → **ignored** (S/A uses tool calls). Journal NOT updated.
10. System prompt: C/D tier → fence instructions present, no edit tool schemas.
11. System prompt: S/A tier → standard tool instructions, no fence instructions.
12. `timeout 45s bun run typecheck` passes.

> **Refinement pass**: Completed 2026-09-25. No issues found.
