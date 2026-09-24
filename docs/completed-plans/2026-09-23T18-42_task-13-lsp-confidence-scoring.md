# Task 13: LSP Confidence Scoring

> **Status**: Ready for implementation
> **Implementer**: Gemini Flash 3.8 High
> **Depends on**: None (consumes existing LSP diagnostics infrastructure)
> **Estimated scope**: Medium — new scoring module + integration into edit/write tool output

## Background

The reference architecture's parity matrix ([Phase 1 — Context Discovery](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/future/2026-09-22T15-16_autonomous-agent-workflow.md#L319)) marks **AST / symbol index** as ❌ — Fox's context discovery is text-only (grep/glob/read), with no language-aware structural understanding.

While a full symbol index is Phase 3+ work, Fox already has a powerful LSP subsystem that runs language servers and collects diagnostics. The edit tool *already* reports LSP errors after edits ([`src/tool/edit.ts:216-219`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/edit.ts#L216-L219)):

```typescript
const diagnostics = yield* lsp.diagnostics()
const block = LSP.Diagnostic.report(filePath, diagnostics[normalizedFilePath] ?? [])
if (block) output += `\n\nLSP errors detected in this file, please fix:\n${block}`
```

But this is a binary signal: errors or no errors. There's no **confidence score** that quantifies how likely the edit is to be correct based on the full diagnostic picture.

### What Exists

1. **LSP Service** ([`src/lsp/lsp.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/lsp/lsp.ts#L120-L137)): Full LSP client with `diagnostics()`, `hover()`, `definition()`, `references()`, `documentSymbol()`, and `workspaceSymbol()` capabilities.

2. **LSP Client** ([`src/lsp/client.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/lsp/client.ts)): Manages push/pull diagnostics with dedup and merge. Diagnostic type is `vscode-languageserver-types.Diagnostic` with `severity`, `source`, `code`, `message`, `range`.

3. **Diagnostics filter** ([`src/tool/diagnostics.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/diagnostics.ts)): `filterDiagnostics()` narrows diagnostics to edited files only, preventing payload bloat.

4. **Edit tool** ([`src/tool/edit.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/edit.ts#L214-L229)): After applying an edit, touches the LSP, collects diagnostics, and appends error report to tool output. Also stored in `metadata.diagnostics`.

5. **Write tool**: Similar pattern — writes file, touches LSP, reports diagnostics.

6. **Diagnostic severity levels** (from `vscode-languageserver-types`):
   - `1` = Error
   - `2` = Warning
   - `3` = Information
   - `4` = Hint

### The Gap

Today's LSP integration is a **flat error list**. It doesn't:
- Score confidence based on error severity and count
- Track diagnostic delta (did this edit *introduce* new errors or *fix* existing ones?)
- Weight diagnostics by source (TypeScript errors are more serious than ESLint warnings)
- Provide a single numeric confidence metric for downstream systems

## Proposed Changes

### New Module: Confidence Scorer

#### [NEW] `src/foxcode/lsp-confidence.ts`

```typescript
/**
 * LSP Confidence Scoring
 *
 * Assigns a 0.0-1.0 confidence score to an edit based on
 * LSP diagnostics before and after the edit. A score of 1.0
 * means no errors introduced; lower scores indicate problems.
 *
 * The score is designed for:
 * 1. Model feedback: append to tool output so the LLM knows its edit quality
 * 2. Future Guardian: inform review decisions and repair priority
 * 3. TUI: surface edit confidence to the user
 */

import type { Diagnostic } from "vscode-languageserver-types"

/** Diagnostic severity as defined by LSP spec */
const enum Severity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}

/** Weights for computing the confidence penalty per diagnostic severity */
const SEVERITY_WEIGHTS: Record<number, number> = {
  [Severity.Error]: 0.25,      // Each error reduces confidence by 25%
  [Severity.Warning]: 0.05,    // Each warning reduces by 5%
  [Severity.Information]: 0.01, // Each info reduces by 1%
  [Severity.Hint]: 0.0,        // Hints don't affect confidence
}

/** Trusted diagnostic sources that carry higher weight */
const HIGH_TRUST_SOURCES = new Set([
  "ts",           // TypeScript
  "typescript",
  "Pyright",
  "pyright",
  "rust-analyzer",
  "rustc",
  "gopls",
  "clangd",
])

export interface ConfidenceInput {
  /** Diagnostics for the edited file(s) BEFORE the edit */
  readonly before: ReadonlyArray<Diagnostic>
  /** Diagnostics for the edited file(s) AFTER the edit */
  readonly after: ReadonlyArray<Diagnostic>
  /** The file path being scored (for logging) */
  readonly filePath: string
}

export interface ConfidenceResult {
  /** Overall confidence score 0.0-1.0 */
  readonly score: number
  /** Human-readable confidence label */
  readonly label: "high" | "medium" | "low" | "critical"
  /** Number of new errors introduced by this edit */
  readonly newErrors: number
  /** Number of errors fixed by this edit */
  readonly fixedErrors: number
  /** Net diagnostic delta (negative = improvement) */
  readonly netDelta: number
  /** Human-readable summary */
  readonly summary: string
}

/**
 * Compute edit confidence from LSP diagnostic deltas.
 */
export function computeConfidence(input: ConfidenceInput): ConfidenceResult {
  const beforeErrors = countBySeverity(input.before)
  const afterErrors = countBySeverity(input.after)

  // Calculate new diagnostics introduced
  const newErrors = Math.max(0, afterErrors.errors - beforeErrors.errors)
  const newWarnings = Math.max(0, afterErrors.warnings - beforeErrors.warnings)
  const fixedErrors = Math.max(0, beforeErrors.errors - afterErrors.errors)

  // Compute penalty
  const penalty =
    newErrors * SEVERITY_WEIGHTS[Severity.Error] +
    newWarnings * SEVERITY_WEIGHTS[Severity.Warning]

  // Apply trust multiplier for high-trust sources
  const highTrustNewErrors = input.after.filter(
    (d) => (d.severity ?? 4) === Severity.Error && HIGH_TRUST_SOURCES.has(d.source ?? "")
  ).length - input.before.filter(
    (d) => (d.severity ?? 4) === Severity.Error && HIGH_TRUST_SOURCES.has(d.source ?? "")
  ).length
  const trustPenalty = Math.max(0, highTrustNewErrors) * 0.1 // Extra 10% per high-trust error

  const score = Math.max(0, Math.min(1.0, 1.0 - penalty - trustPenalty))
  const netDelta = afterErrors.total - beforeErrors.total

  const label: ConfidenceResult["label"] =
    score >= 0.9 ? "high" :
    score >= 0.6 ? "medium" :
    score >= 0.3 ? "low" :
    "critical"

  const parts: string[] = []
  if (newErrors > 0) parts.push(`+${newErrors} error${newErrors !== 1 ? "s" : ""}`)
  if (fixedErrors > 0) parts.push(`-${fixedErrors} error${fixedErrors !== 1 ? "s" : ""} fixed`)
  if (newWarnings > 0) parts.push(`+${newWarnings} warning${newWarnings !== 1 ? "s" : ""}`)
  const summary = parts.length > 0
    ? `Edit confidence: ${label} (${(score * 100).toFixed(0)}%) — ${parts.join(", ")}`
    : `Edit confidence: ${label} (${(score * 100).toFixed(0)}%) — no new diagnostics`

  return { score, label, newErrors, fixedErrors, netDelta, summary }
}

function countBySeverity(diagnostics: ReadonlyArray<Diagnostic>) {
  let errors = 0, warnings = 0, info = 0, total = 0
  for (const d of diagnostics) {
    total++
    switch (d.severity) {
      case Severity.Error: errors++; break
      case Severity.Warning: warnings++; break
      case Severity.Information: info++; break
    }
  }
  return { errors, warnings, info, total }
}
```

**Key design decisions**:
- **Delta-based, not absolute**: The score is based on the *change* in diagnostics, not the absolute count. A project with 50 pre-existing warnings that stays at 50 gets `score: 1.0`.
- **Severity weighting**: Errors penalize heavily (25% each), warnings lightly (5%), hints ignored.
- **Trusted source boost**: TypeScript, Pyright, rust-analyzer errors carry extra penalty because they're highly reliable.
- **Pure function**: No Effect dependencies, no I/O — fully testable in isolation.

### Integration: Capture "Before" Diagnostics

#### [MODIFY] [`src/tool/edit.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/edit.ts#L214-L229)

Currently, the edit tool only captures diagnostics *after* the edit. To compute confidence, we need diagnostics *before* the edit too.

**Before the edit is applied** (before `writeContent` or equivalent), capture the current diagnostics:

```typescript
// Before applying the edit:
yield* lsp.touchFile(filePath, "document")
const diagnosticsBefore = yield* lsp.diagnostics()
const beforeDiags = diagnosticsBefore[normalizedFilePath] ?? []

// ... apply the edit ...

// After the edit (existing code):
yield* lsp.touchFile(filePath, "document")
const diagnosticsAfter = yield* lsp.diagnostics()
const afterDiags = diagnosticsAfter[normalizedFilePath] ?? []

// Compute confidence
const confidence = computeConfidence({
  before: beforeDiags,
  after: afterDiags,
  filePath,
})

// Append confidence to output
if (confidence.score < 1.0 || confidence.fixedErrors > 0) {
  output += `\n\n${confidence.summary}`
}
```

**Important**: The "before" diagnostic capture must happen *before* the file content is modified. The `touchFile` call notifies the LSP of the current file state. After the edit, a second `touchFile` notifies the LSP of the new content, and the diff in diagnostics measures the edit's impact.

#### [MODIFY] [`src/tool/write.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/write.ts)

Apply the same before/after pattern to the write tool.

#### [MODIFY] [`src/tool/apply-patch.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/apply-patch.ts)

Apply the same before/after pattern to the apply_patch tool.

### Metadata Extension

#### [MODIFY] Tool metadata output

Include confidence score in the tool call metadata so it's available to the TUI and future systems:

```typescript
metadata: {
  diagnostics: filterDiagnostics(diagnosticsAfter, [normalizedFilePath]),
  diff,
  filediff,
  confidence: { score: confidence.score, label: confidence.label, newErrors: confidence.newErrors },
}
```

### Tests

#### [NEW] `test/lsp-confidence.test.ts`

1. **Clean edit**: 0 errors before, 0 errors after → score 1.0, label "high"
2. **Single new error**: 0 before, 1 error after → score 0.75, label "medium"
3. **Multiple new errors**: 0 before, 4 errors after → score 0.0, label "critical"
4. **Error fixed**: 2 errors before, 1 after → `fixedErrors: 1`, high confidence
5. **All errors fixed**: 3 errors before, 0 after → score 1.0, `fixedErrors: 3`
6. **Pre-existing errors unchanged**: 5 errors before, 5 errors after (same diagnostics) → score 1.0, netDelta 0
7. **Warning impact**: 0 before, 3 warnings after → score 0.85, label "medium"
8. **High-trust source**: New TypeScript error → extra penalty vs unknown-source error
9. **Hint ignored**: 0 before, 10 hints after → score 1.0
10. **Summary formatting**: Verify correct label, percentage, and delta text
11. **Edge: empty diagnostics**: Both before and after empty → score 1.0
12. **Edge: severity undefined**: Diagnostic with `severity: undefined` treated as Hint (no penalty)

### Edge Cases

1. **LSP not available**: If no LSP clients are configured or connected for the file's language, `diagnostics()` returns `{}` and both before/after will be empty. Confidence will be 1.0 (no data, not a false negative). This is correct — we can't score what we can't observe.

2. **Slow LSP response**: The `touchFile` + `diagnostics` calls may take 100-500ms for large files. This is already the case today (edit tool already waits for diagnostics). No additional latency is introduced by capturing "before" since the LSP was already running.

3. **Multi-file edits**: For `apply_patch` which can touch multiple files, compute confidence per-file and report the worst score.

4. **New files**: A newly created file has no "before" diagnostics. Any errors in the new file are scored normally (they're "new" by definition).

5. **Diagnostic race**: LSP diagnostics are asynchronous. The existing `touchFile("document")` call handles this by waiting for the LSP to process the file change. The "before" capture benefits from the same mechanism.

## Verification Plan

### Automated Tests
```bash
timeout 30s CI=true bun test test/lsp-confidence.test.ts
timeout 60s bun run test:smoke
timeout 45s bun run typecheck
```

### Manual Verification
- Make an intentionally buggy edit in a TypeScript file. Verify the confidence score drops and the summary mentions new errors.
- Fix an existing error in a file. Verify `fixedErrors > 0` and score remains high.
- Edit a file with no LSP server configured. Verify graceful degradation (score 1.0).

> **Refinement pass**: Completed 2026-09-23. Audit: All 3 LSP-integrated mutation tools enumerated (edit.ts, write.ts, apply_patch.ts). rewrite_file confirmed excluded (no LSP touchFile call). HIGH_TRUST_SOURCES explicitly listed (ts, typescript, Pyright, pyright, rust-analyzer, rustc, gopls, clangd). Severity weight formula explicit. Abstraction "confidence" decomposed into score/label/delta/summary sub-components. No renames. No issues found.
