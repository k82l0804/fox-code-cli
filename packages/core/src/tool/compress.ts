/**
 * ToolOutputCompressor — centralized pipeline for lossless token compression
 * of tool output text before it is sent to the model.
 *
 * Each transform is gated by a `FOX_EXPERIMENTAL_COMPRESS_*` flag and runs
 * in sequence.  The master switch `FOX_EXPERIMENTAL_COMPRESS` enables all
 * sub-flags via the existing `enabledByExperimental()` cascade in flag.ts.
 *
 * Strategies that live in other architectural layers (4.1 schema minification,
 * 4.3 KV-cache freezing, 4.4 output superseding) are NOT handled here — they
 * use their respective flag tiers directly.
 */
export * as ToolOutputCompressor from "./compress"

import { Flag } from "../flag/flag"
import { Log } from "../util/log"
import { CompressionMetrics } from "./compression-metrics"

const log = Log.create({ service: "compression" })

export interface CompressContext {
  /** Absolute path to the workspace / Location root. */
  readonly workspaceRoot: string
  /** Name of the tool that produced this output. */
  readonly toolName: string
}

// ---------------------------------------------------------------------------
// Transform registry
// ---------------------------------------------------------------------------

interface Transform {
  readonly name: string
  /** Jaeger span name matching the metrics doc convention. */
  readonly span: string
  readonly enabled: () => boolean
  readonly apply: (text: string, ctx: CompressContext) => string
}

const transforms: readonly Transform[] = [
  {
    name: "relativizePaths",
    span: "compression.path_normalization",
    enabled: () => Flag.FOX_EXPERIMENTAL_COMPRESS_PATHS,
    apply: relativizePaths,
  },
  {
    name: "compressGitStatus",
    span: "compression.git_status",
    enabled: () => Flag.FOX_EXPERIMENTAL_COMPRESS_GIT,
    apply: compressGitStatus,
  },
  {
    name: "trimDiffContext",
    span: "compression.diff_context_trim",
    enabled: () => Flag.FOX_EXPERIMENTAL_COMPRESS_DIFF,
    apply: trimDiffContext,
  },
  {
    name: "filterTestOutput",
    span: "compression.test_output",
    enabled: () => Flag.FOX_EXPERIMENTAL_COMPRESS_GIT,
    apply: filterTestOutput,
  },
  {
    name: "compressTabular",
    span: "compression.structured_data.tabular",
    enabled: () => Flag.FOX_EXPERIMENTAL_COMPRESS_DATA,
    apply: compressTabular,
  },
  {
    name: "deduplicateLogLines",
    span: "compression.structured_data.dedup",
    enabled: () => Flag.FOX_EXPERIMENTAL_COMPRESS_DATA,
    apply: deduplicateLogLines,
  },
  {
    name: "compressJsonKeys",
    span: "compression.structured_data.json_keys",
    enabled: () => Flag.FOX_EXPERIMENTAL_COMPRESS_DATA,
    apply: compressJsonKeys,
  },
]

/**
 * Run all enabled compression transforms over `text`.
 * Returns the (possibly compressed) output string.
 *
 * Each enabled transform is instrumented with timing and char-savings
 * metrics, emitted as structured log entries compatible with OTLP/Jaeger.
 */
export function process(text: string, ctx: CompressContext): string {
  const originalLen = text.length
  let anyEnabled = false
  let totalOverheadMs = 0

  for (const transform of transforms) {
    if (!transform.enabled()) continue

    // ROI auto-skip: skip transforms with consistently low ROI
    if (CompressionMetrics.shouldSkip(transform.name)) {
      log.debug(`${transform.span}: skipped (low ROI)`, { tool: ctx.toolName })
      continue
    }

    anyEnabled = true
    const beforeLen = text.length
    const beforeText = text
    const start = performance.now()
    text = transform.apply(text, ctx)
    const durationMs = performance.now() - start
    totalOverheadMs += durationMs
    const saved = beforeLen - text.length

    // Safety rail: transforms must never increase output size
    if (text.length > beforeLen) {
      log.warn(`${transform.span}: output grew (${beforeLen} → ${text.length}), reverting`, {
        tool: ctx.toolName,
      })
      text = beforeText
      continue
    }

    // Record per-transform ROI for future auto-skip decisions
    CompressionMetrics.recordTransformROI(transform.name, saved, durationMs)

    if (saved !== 0 || durationMs > 1) {
      log.debug(transform.span, {
        tool: ctx.toolName,
        durationMs: Math.round(durationMs * 100) / 100,
        charsBefore: beforeLen,
        charsAfter: text.length,
        charsSaved: saved,
      })
    }
  }

  if (anyEnabled && originalLen !== text.length) {
    log.info("compression.total", {
      tool: ctx.toolName,
      charsBefore: originalLen,
      charsAfter: text.length,
      charsSaved: originalLen - text.length,
      pctSaved: Math.round(((originalLen - text.length) / originalLen) * 1000) / 10,
    })
  }

  // Record aggregate metrics to the global accumulator (read at step-finish).
  if (anyEnabled) {
    CompressionMetrics.record("tool_output", originalLen, text.length, totalOverheadMs)
  }

  return text
}

// ---------------------------------------------------------------------------
// 4.2 — Path Prefix Normalization
// ---------------------------------------------------------------------------

/**
 * Replace all occurrences of the workspace root path with relative paths.
 * Prepends a single `[CWD: ...]` header so the model knows the root.
 */
export function relativizePaths(text: string, ctx: CompressContext): string {
  if (!ctx.workspaceRoot) return text
  const root = ctx.workspaceRoot.endsWith("/") ? ctx.workspaceRoot : `${ctx.workspaceRoot}/`
  const replaced = text.replaceAll(root, "")
  if (replaced === text) return text
  return `[CWD: ${ctx.workspaceRoot}]\n${replaced}`
}

// ---------------------------------------------------------------------------
// 4.7 — Structured Data Compression: Tabular
// ---------------------------------------------------------------------------

/**
 * Detect JSON arrays of objects with repeated keys and convert to columnar
 * format:  `Columns: key1 | key2\nval1 | val2\n...`
 *
 * Only triggers when the text is a top-level JSON array of ≥3 objects with
 * identical key sets.  Falls back to raw text on any detection failure.
 */
export function compressTabular(text: string, _ctx: CompressContext): string {
  const trimmed = text.trim()
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return text
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return text
  }
  if (!Array.isArray(parsed) || parsed.length < 3) return text
  if (!parsed.every((item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item)))
    return text

  const keys = Object.keys(parsed[0]!)
  if (keys.length === 0) return text
  const keySet = keys.join(",")
  if (!parsed.every((item) => Object.keys(item).join(",") === keySet)) return text

  const header = `Columns: ${keys.join(" | ")}`
  const rows = parsed.map((item) => keys.map((key) => String(item[key] ?? "")).join(" | "))
  return [header, ...rows].join("\n")
}

// ---------------------------------------------------------------------------
// 4.7 — Structured Data Compression: Log Deduplication
// ---------------------------------------------------------------------------

/**
 * Collapse consecutive identical lines into `[×N] line` markers.
 * Also collapses runs of lines matching common success patterns
 * (e.g., `✓ test_name`, `✔ test_name`, `PASS test_name`).
 */
export function deduplicateLogLines(text: string, _ctx: CompressContext): string {
  const lines = text.split("\n")
  if (lines.length < 5) return text

  const result: string[] = []
  let i = 0
  while (i < lines.length) {
    const current = lines[i]!
    let count = 1
    while (i + count < lines.length && lines[i + count] === current) {
      count++
    }
    if (count >= 3) {
      result.push(`[×${count}] ${current}`)
    } else {
      for (let j = 0; j < count; j++) result.push(current)
    }
    i += count
  }

  if (result.length === lines.length) return text
  return result.join("\n")
}

// ---------------------------------------------------------------------------
// 4.10 — JSON Key Legend Packing
// ---------------------------------------------------------------------------

/**
 * For JSON arrays with repeated object keys, emit a short legend and
 * replace keys with single-letter abbreviations.
 *
 * Only triggers when:
 * - Text is a JSON array of ≥3 objects
 * - Objects have identical key sets
 * - Key names are long enough that abbreviation saves tokens
 *
 * NOTE: This transform runs AFTER compressTabular. If compressTabular
 * already converted the text, this is a no-op (the text is no longer JSON).
 */
export function compressJsonKeys(text: string, _ctx: CompressContext): string {
  const trimmed = text.trim()
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return text
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return text
  }
  if (!Array.isArray(parsed) || parsed.length < 3) return text
  if (!parsed.every((item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item)))
    return text

  const keys = Object.keys(parsed[0]!)
  if (keys.length === 0 || keys.length > 26) return text
  const keySet = keys.join(",")
  if (!parsed.every((item) => Object.keys(item).join(",") === keySet)) return text

  const totalKeyChars = keys.reduce((sum, key) => sum + key.length, 0) * parsed.length
  if (totalKeyChars < 100) return text

  const alphabet = "abcdefghijklmnopqrstuvwxyz"
  const legend: string[] = []
  const keyMap = new Map<string, string>()
  for (let i = 0; i < keys.length; i++) {
    const abbr = alphabet[i]!
    keyMap.set(keys[i]!, abbr)
    legend.push(`${abbr}=${keys[i]}`)
  }

  const compressed = parsed.map((item) => {
    const entries: string[] = []
    for (const [key, value] of Object.entries(item)) {
      entries.push(`${keyMap.get(key) ?? key}:${JSON.stringify(value)}`)
    }
    return `{${entries.join(",")}}`
  })

  return `[legend: ${legend.join(", ")}]\n[${compressed.join(",")}]`
}

// ---------------------------------------------------------------------------
// Git Status Compression
// ---------------------------------------------------------------------------

/**
 * Convert standard verbose git status output into compact status representation.
 * Eliminates novice instructional hints like (use "git add..." ) while preserving
 * 100% of branch, tracking, staged, unstaged, and untracked file status.
 */
export function compressGitStatus(text: string, _ctx: CompressContext): string {
  if (!text.includes("On branch ") && !text.startsWith("On branch ")) return text

  const lines = text.split("\n")
  let branch = ""
  let tracking = ""
  const staged: string[] = []
  const unstaged: string[] = []
  const untracked: string[] = []

  let section: "header" | "staged" | "unstaged" | "untracked" = "header"

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const trimmed = line.trim()

    if (trimmed.startsWith("On branch ")) {
      branch = trimmed.replace("On branch ", "").trim()
      continue
    }
    if (trimmed.startsWith("Your branch is ")) {
      tracking = trimmed
      continue
    }

    if (trimmed.startsWith("Changes to be committed:")) {
      section = "staged"
      continue
    }
    if (trimmed.startsWith("Changes not staged for commit:")) {
      section = "unstaged"
      continue
    }
    if (trimmed.startsWith("Untracked files:")) {
      section = "untracked"
      continue
    }

    // Skip instructional help lines
    if (trimmed.startsWith("(") && trimmed.endsWith(")")) continue
    if (trimmed.startsWith("no changes added to commit")) continue
    if (trimmed === "") continue

    if (section === "staged") {
      const match = trimmed.match(/^([a-z\s]+):\s+(.+)$/i)
      if (match) {
        const kind = match[1]!.toLowerCase()
        const file = match[2]!.trim()
        if (kind === "modified") staged.push(`M  ${file}`)
        else if (kind === "new file") staged.push(`A  ${file}`)
        else if (kind === "deleted") staged.push(`D  ${file}`)
        else if (kind === "renamed") staged.push(`R  ${file}`)
        else staged.push(`M  ${file}`)
      }
    } else if (section === "unstaged") {
      const match = trimmed.match(/^([a-z\s]+):\s+(.+)$/i)
      if (match) {
        const kind = match[1]!.toLowerCase()
        const file = match[2]!.trim()
        if (kind === "modified") unstaged.push(` M ${file}`)
        else if (kind === "deleted") unstaged.push(` D ${file}`)
        else unstaged.push(` M ${file}`)
      }
    } else if (section === "untracked") {
      untracked.push(`?? ${trimmed}`)
    }
  }

  if (!branch && staged.length === 0 && unstaged.length === 0 && untracked.length === 0) {
    return text
  }

  const out: string[] = []
  let header = `## ${branch || "HEAD"}`
  if (tracking && !tracking.includes("up to date")) {
    header += ` [${tracking}]`
  }
  out.push(header)

  if (staged.length === 0 && unstaged.length === 0 && untracked.length === 0) {
    out.push("(working tree clean)")
  } else {
    out.push(...staged, ...unstaged, ...untracked)
  }

  const result = out.join("\n")
  return result.length < text.length ? result : text
}

// ---------------------------------------------------------------------------
// Test Output Filtering
// ---------------------------------------------------------------------------

/**
 * Collapse consecutive passing test result lines (e.g. `✓ test_name [0.1ms]`)
 * into `[N passing tests omitted]` when there are ≥4 consecutive passes.
 * Failures, errors, stack traces, and summary stats are never modified.
 */
export function filterTestOutput(text: string, _ctx: CompressContext): string {
  const lines = text.split("\n")
  if (lines.length < 6) return text

  const isPassLine = (line: string): boolean => {
    const trimmed = line.trim()
    return /^(?:✓|✔|PASS\b|ok\s+\d+)/.test(trimmed)
  }

  const result: string[] = []
  let i = 0

  while (i < lines.length) {
    if (isPassLine(lines[i]!)) {
      let count = 0
      while (i + count < lines.length && isPassLine(lines[i + count]!)) {
        count++
      }
      if (count >= 4) {
        result.push(`  [...${count} passing tests omitted...]`)
        i += count
        continue
      } else {
        for (let j = 0; j < count; j++) {
          result.push(lines[i + j]!)
        }
        i += count
        continue
      }
    }
    result.push(lines[i]!)
    i++
  }

  const output = result.join("\n")
  return output.length < text.length ? output : text
}

// ---------------------------------------------------------------------------
// 4.5 — Diff Context Trimming & Lockfile Collapsing
// ---------------------------------------------------------------------------

const LOCKFILE_REGEX = /(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|Cargo\.lock|poetry\.lock|Gemfile\.lock|composer\.lock)$/i

/**
 * Detect unified diff format and reduce context lines, strip index hashes,
 * and collapse massive lockfile diffs.
 *
 * Unified diffs typically include 3 lines of context above/below each hunk.
 * This transform reduces that to `contextLines` (default 1) while preserving
 * all `+`/`-` (changed) lines, hunk headers, and file headers.
 *
 * Safety: all `+`/`-` lines are preserved. Hunk line counts are recalculated.
 */
export function trimDiffContext(text: string, _ctx: CompressContext): string {
  const contextLines = Flag.FOX_EXPERIMENTAL_COMPRESS_DIFF_CONTEXT ?? 1

  // Quick detection: must contain diff-like markers
  if (!text.includes("@@") || (!text.includes("--- ") && !text.includes("diff "))) return text

  const lines = text.split("\n")
  const result: string[] = []
  let inDiff = false
  let hunkLines: string[] = []
  let currentFile = ""
  let isLockfile = false
  let lockfileLines: string[] = []

  const flushHunk = () => {
    if (hunkLines.length > 0) {
      result.push(...trimHunkContext(hunkLines, contextLines))
      hunkLines = []
    }
  }

  const flushLockfile = () => {
    if (isLockfile && currentFile) {
      let added = 0
      let deleted = 0
      for (const line of lockfileLines) {
        if (line.startsWith("+") && !line.startsWith("+++")) added++
        if (line.startsWith("-") && !line.startsWith("---")) deleted++
      }
      if (added + deleted > 10) {
        result.push(
          `[${currentFile}: +${added} -${deleted} lines — lockfile diff collapsed; inspect with git diff -- ${currentFile}]`,
        )
      } else {
        result.push(...lockfileLines)
      }
      lockfileLines = []
      isLockfile = false
      currentFile = ""
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!

    // File start
    if (line.startsWith("diff --git ")) {
      flushHunk()
      flushLockfile()

      const match = line.match(/diff --git a\/(.+?)\s+b\/(.+)/)
      const fileName = match ? match[2]! : ""
      currentFile = fileName
      isLockfile = LOCKFILE_REGEX.test(fileName)

      if (isLockfile) {
        result.push(line)
        inDiff = true
        continue
      }

      result.push(line)
      inDiff = true
      continue
    }

    if (isLockfile) {
      if (line.startsWith("index ")) continue
      lockfileLines.push(line)
      continue
    }

    // Strip index hashes from regular diffs to save tokens
    if (line.startsWith("index ")) {
      continue
    }

    // File headers: pass through
    if (line.startsWith("--- ") || line.startsWith("+++ ") || line.startsWith("old mode ") || line.startsWith("new mode ")) {
      flushHunk()
      result.push(line)
      inDiff = true
      continue
    }

    // Hunk header: start a new hunk
    if (line.startsWith("@@") && inDiff) {
      flushHunk()
      hunkLines = [line]
      continue
    }

    // Inside a hunk: collect lines
    if (hunkLines.length > 0 && (line.startsWith(" ") || line.startsWith("+") ||
        line.startsWith("-") || line === "")) {
      hunkLines.push(line)
      continue
    }

    // Not in a hunk anymore
    flushHunk()
    inDiff = false
    result.push(line)
  }

  flushHunk()
  flushLockfile()

  const output = result.join("\n")
  return output.length < text.length ? output : text
}

/**
 * Trim context lines within a single hunk (hunk header + body lines).
 * Preserves all +/- lines and keeps at most `keep` context lines around each change group.
 */
function trimHunkContext(hunkLines: string[], keep: number): string[] {
  if (hunkLines.length <= 1) return hunkLines

  const header = hunkLines[0]!
  const body = hunkLines.slice(1)

  // Find changed line indices
  const changedIndices: number[] = []
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]![0]
    if (ch === "+" || ch === "-") {
      changedIndices.push(i)
    }
  }

  if (changedIndices.length === 0) return hunkLines

  // Mark which context lines to keep (within `keep` lines of any change)
  const keepSet = new Set<number>()
  for (const ci of changedIndices) {
    keepSet.add(ci) // always keep changed lines
    for (let d = 1; d <= keep; d++) {
      if (ci - d >= 0 && body[ci - d]![0] === " ") keepSet.add(ci - d)
      if (ci + d < body.length && body[ci + d]![0] === " ") keepSet.add(ci + d)
    }
  }

  // Build trimmed body
  const trimmedBody: string[] = []
  for (let i = 0; i < body.length; i++) {
    if (keepSet.has(i)) {
      trimmedBody.push(body[i]!)
    }
  }

  // Recalculate hunk header counts
  let oldCount = 0
  let newCount = 0
  for (const line of trimmedBody) {
    const ch = line[0]
    if (ch === " ") { oldCount++; newCount++ }
    else if (ch === "-") { oldCount++ }
    else if (ch === "+") { newCount++ }
  }

  // Parse original header to get start lines
  const hunkMatch = header.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/)
  if (!hunkMatch) return [header, ...trimmedBody]

  const newHeader = `@@ -${hunkMatch[1]},${oldCount} +${hunkMatch[2]},${newCount} @@${hunkMatch[3] ?? ""}`
  return [newHeader, ...trimmedBody]
}

// ---------------------------------------------------------------------------
// Pre-Execution Git Command Rewriting
// ---------------------------------------------------------------------------

/**
 * Pre-execution command rewriter for Git commands.
 * Transparently injects terse flags (-sb, -U1, --oneline -n 20) when the model
 * issues raw git commands without formatting flags.
 */
export function rewriteGitCommand(command: string, options?: { enabled?: boolean }): string {
  const enabled = options?.enabled ?? Flag.FOX_EXPERIMENTAL_COMPRESS_GIT
  if (!enabled) return command

  // Split chained statements by &&, ;, ||
  const delimiterRegex = /(\s*(?:&&|;|\|\|)\s*)/
  const parts = command.split(delimiterRegex)

  const rewritten = parts.map((part) => {
    const trimmed = part.trim()
    if (!trimmed.startsWith("git ") && trimmed !== "git") return part

    // 1. git status
    if (/^git\s+status(?:\s+|$)/.test(trimmed)) {
      if (!trimmed.includes("-s") && !trimmed.includes("--short") && !trimmed.includes("--porcelain")) {
        return part.replace(/\bgit\s+status\b/, "git status -sb")
      }
    }

    // 2. git diff
    if (/^git\s+diff(?:\s+|$)/.test(trimmed)) {
      if (!trimmed.includes("-U") && !trimmed.includes("--unified")) {
        return part.replace(/\bgit\s+diff\b/, "git diff -U1")
      }
    }

    // 3. git log
    if (/^git\s+log(?:\s+|$)/.test(trimmed)) {
      const hasLimit = /-\d+\b|-n\s+\d+|--max-count\b/.test(trimmed)
      const hasFormat = /--oneline\b|--format\b|--pretty\b/.test(trimmed)
      if (!hasLimit && !hasFormat) {
        return part.replace(/\bgit\s+log\b/, "git log --oneline -n 20")
      }
    }

    return part
  })

  return rewritten.join("")
}

