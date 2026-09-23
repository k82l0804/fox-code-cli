# Plan: Turn-Supersession Context Pruning

> **Task**: Phase 2A #2 from [`current-tasks.md`](../master-plan/current-tasks.md)
> **Goal**: Extend `supersede.ts` to cover more stale context patterns beyond file reads and git commands.

## Background

[`supersede.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/supersede.ts) (372 lines) implements render-time replacement of stale tool outputs. Currently it supersedes:
- **File reads** when the same file is later modified by `edit`/`write`/`apply_patch`
- **Git status/diff/branch** when files are subsequently modified or new git commands run

This is applied at render time via `toModelMessagesEffect` — stored messages are never modified.

The LLTC compression pipeline in [`compress.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/tool/compress.ts) (1,181 lines) handles output-level compression (collapsing test output, stripping timestamps, etc.). Supersession is a different layer — it prunes entire tool results from the conversation history.

## New Supersession Patterns to Add

### Pattern 1: Repeated `grep` supersession
When the same `grep` tool is called with the same query on the same path, only the latest result is relevant. Earlier grep results for the same (query, path) pair should be superseded.

### Pattern 2: Repeated `glob` supersession
Same logic as grep — when `glob` is called with the same pattern, earlier results are stale.

### Pattern 3: Directory listing (`ls`/`find` via bash) supersession
When bash runs `ls` or `find` on a directory, and that directory is later modified (file created/deleted), the earlier listing is stale.

### Pattern 4: Verification output supersession
When auto-verification runs multiple times (across multiple edit cycles), earlier verification outputs are superseded by the latest. Only the most recent test/typecheck result matters.

### Pattern 5: `read` supersession on re-read
When the same file is `read` twice (without an intervening mutation), the second read supersedes the first. The model already has the latest content.

## Proposed Changes

### 1. [MODIFY] [`src/session/supersede.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/supersede.ts)

Add to the tool sets at top of file:
```typescript
const GREP_TOOLS = new Set(["grep"])
const GLOB_TOOLS = new Set(["glob"])
```

Add new detection functions:
```typescript
function extractGrepKey(input: unknown): string | undefined
  // Returns `${query}:${path}` composite key

function extractGlobPattern(input: unknown): string | undefined
  // Returns the glob pattern string

function isVerificationOutput(output: string): boolean
  // Detects "─── Auto-Verification" markers
```

Extend the main `applySupersession()` function with new tracking maps:
```typescript
// Existing
const latestMutations: Map<string, { index: number; tool: string }>
// New
const latestGreps: Map<string, number>      // grepKey → last index
const latestGlobs: Map<string, number>      // pattern → last index  
const latestReads: Map<string, number>      // filePath → last index (no mutation between)
let latestVerificationIndex: number = -1     // index of latest verification output
```

Two-pass approach (existing pattern):
1. **Forward pass**: Record latest index for each grep key, glob pattern, read path, and verification output
2. **Backward pass**: Supersede all non-latest instances

### 2. [MODIFY] [`test/verification.test.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/test/verification.test.ts) or create `test/supersede.test.ts`

Add tests:

| Test | Scenario | Expected |
|------|----------|----------|
| `grep supersession: same query replaces earlier` | grep("foo", "src/") at turn 3 and turn 7 | Turn 3 output superseded |
| `grep supersession: different query preserved` | grep("foo") then grep("bar") | Both preserved |
| `glob supersession: same pattern replaces earlier` | glob("*.ts") at turn 2 and turn 5 | Turn 2 superseded |
| `read supersession: re-read without mutation` | read("a.ts") then read("a.ts") | First superseded |
| `read supersession: re-read after mutation preserved` | read → edit → read | Both preserved (different content) |
| `verification supersession` | verify at turn 3, verify at turn 7 | Turn 3 superseded |
| `no false positives on different files` | read("a.ts") then read("b.ts") | Both preserved |

## Verification

```bash
# Run supersession tests
CI=true timeout 30s bun test test/supersede.test.ts --timeout 30000

# Ensure compression pipeline unchanged
CI=true timeout 30s bun run test:compress

# Typecheck
timeout 45s bun run typecheck
```

## Architecture Notes

- Supersession is **render-time only** — never modify stored `SessionV1.Part` data
- The `applySupersession()` function receives `parts: SessionV1.Part[]` and returns modified parts
- Superseded outputs are replaced with a short marker string (e.g., `[Grep results superseded — newer results available]`)
- The `CompressionMetrics` service should be updated to track supersession counts
- Feature flag: `FOX_EXPERIMENTAL_COMPRESS_SUPERSEDE=true` (existing flag, already on by default)
