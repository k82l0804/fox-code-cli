/**
 * Code Context Block Builder (Phase 2E Task 2E-3 & 2E-5)
 *
 * Assembles the unified code context block injected into the system prompt:
 * 1. Repo map (signatures-only, ~1000 tokens for S/A/B, ~1500 tokens for C/D)
 * 2. Localized code spans (~1500 tokens, top 3–5 functions/classes)
 * 3. Pinned file bodies (remainder of budget, up to 4 files)
 *
 * Enforces the 5000-token envelope via deterministic hierarchical trimming:
 * Pinned bodies truncated first -> spans reduced from 5 to 3 -> repo map trimmed.
 */
import * as fs from "fs"
import * as path from "path"
import * as crypto from "crypto"
import type { AstIndexer } from "@foxcode/indexing/ast/indexer"
import { type ModelTier, TIER_MAP_TOKEN_BUDGET } from "@/foxcode/model-tier"
import { localize, type LocalizeResult } from "./localize/pipeline"
import { tokenizeCodeText } from "./localize/bm25"
import type { LocalizedSpan } from "./localize/ranker"

export interface CodeContextOptions {
  task: string
  tier: ModelTier
  indexer: AstIndexer
  workingSet: string[]
  mutatedFiles: string[]
  projectDir: string
  maxTokens?: number
}

export interface CodeContextBlock {
  content: string
  contentHash: string
  partial: boolean
  mapTokens: number
  localizeTokens: number
  pinTokens: number
}

/**
 * Fast token counting heuristic matching GPT/Claude tokenizers.
 * Rule: ~4 characters per token.
 */
export function countTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

interface MapEntry {
  filePath: string
  text: string
  score: number
}

interface PinnedFile {
  filePath: string
  content: string
}

function formatRepoMap(entries: MapEntry[]): string {
  if (entries.length === 0) return ""
  return [
    "<repo_map>",
    ...entries.map((e) => e.text),
    "</repo_map>",
  ].join("\n")
}

function formatLocalizeSpans(spans: Array<{ span: LocalizedSpan; code: string }>): string {
  if (spans.length === 0) return ""
  const lines: string[] = ["<localized_spans>"]
  for (const { span, code } of spans) {
    lines.push(`  <span file="${span.file}" lines="${span.spanStart}-${span.spanEnd}" reason="${span.reason}">`)
    for (const l of code.split("\n")) {
      lines.push(`    ${l}`)
    }
    lines.push("  </span>")
  }
  lines.push("</localized_spans>")
  return lines.join("\n")
}

function formatPinnedFiles(pins: PinnedFile[]): string {
  if (pins.length === 0) return ""
  const lines: string[] = ["<pinned_files>"]
  for (const pin of pins) {
    lines.push(`  <file path="${pin.filePath}">`)
    for (const l of pin.content.split("\n")) {
      lines.push(`    ${l}`)
    }
    lines.push("  </file>")
  }
  lines.push("</pinned_files>")
  return lines.join("\n")
}

/**
 * Build the Code Context Block conforming to the 5000-token envelope.
 */
export function buildCodeContextBlock(options: CodeContextOptions): CodeContextBlock {
  const maxTokens = options.maxTokens ?? 5000
  const tier = options.tier ?? "A"
  const targetMapBudget = TIER_MAP_TOKEN_BUDGET[tier] ?? 1000

  // 1. Run localization pipeline
  const locResult: LocalizeResult = localize(options.task, options.indexer, options.projectDir)

  // 2. Build Repo Map
  const queryTokens = new Set(tokenizeCodeText(options.task))
  const mutatedSet = new Set(
    options.mutatedFiles.map((f) => (path.isAbsolute(f) ? path.relative(options.projectDir, f) : f)),
  )
  const workingSet = new Set(
    options.workingSet.map((f) => (path.isAbsolute(f) ? path.relative(options.projectDir, f) : f)),
  )

  const corpus = options.indexer.getCorpus()
  const mapEntries: MapEntry[] = []

  for (const entry of corpus) {
    if (entry.symbols.length === 0) continue

    const symTokens = tokenizeCodeText(
      `${entry.filePath} ${entry.symbols.map((s) => `${s.name} ${s.signature}`).join(" ")}`,
    )
    let score = 0
    for (const t of symTokens) {
      if (queryTokens.has(t)) score += 1
    }

    // Boost mutated and working set files
    const isMutated = mutatedSet.has(entry.filePath)
    const isWorking = workingSet.has(entry.filePath)
    if (isMutated) score += 10
    if (isWorking) score += 5

    const sigLines = entry.symbols
      .slice(0, 10) // top 10 signatures per file
      .map((s) => `  ${s.signature || `${s.kind} ${s.name}`} (L${s.start_line})`)

    const statusTag = isMutated ? " [modified]" : isWorking ? " [working]" : ""
    const entryText = `${entry.filePath}${statusTag}:\n${sigLines.join("\n")}`
    mapEntries.push({ filePath: entry.filePath, text: entryText, score })
  }

  // Sort repo map entries by relevance score descending
  mapEntries.sort((a, b) => b.score - a.score)

  // Trim map entries to stay within target map budget
  const trimmedMapEntries: MapEntry[] = []
  let currentMapTokens = countTokens("<repo_map>\n</repo_map>")
  for (const entry of mapEntries) {
    const entryTokens = countTokens(entry.text + "\n")
    if (currentMapTokens + entryTokens <= targetMapBudget || trimmedMapEntries.length === 0) {
      trimmedMapEntries.push(entry)
      currentMapTokens += entryTokens
    } else {
      break
    }
  }

  let mapSection = formatRepoMap(trimmedMapEntries)
  let mapTokens = countTokens(mapSection)

  // 3. Localize Spans Section
  let activeSpans = locResult.spans.slice(0, 5)
  const spanCodes: Array<{ span: LocalizedSpan; code: string }> = []

  for (const span of activeSpans) {
    const fullPath = path.isAbsolute(span.file) ? span.file : path.join(options.projectDir, span.file)
    let code = ""
    try {
      if (fs.existsSync(fullPath)) {
        const fileContent = fs.readFileSync(fullPath, "utf-8")
        const lines = fileContent.split("\n")
        const start = Math.max(0, span.spanStart - 1)
        const end = Math.min(lines.length, span.spanEnd)
        code = lines.slice(start, end).join("\n")
      }
    } catch {
      code = `// Could not read ${span.file}`
    }
    spanCodes.push({ span, code })
  }

  let localizeSection = formatLocalizeSpans(spanCodes)
  let localizeTokens = countTokens(localizeSection)

  // 4. Pinned Files Bodies Section
  // Pins = localize top spans files ∪ mutated files ∪ working set (up to 4 files)
  const pinCandidates = new Set<string>()
  for (const s of activeSpans) {
    pinCandidates.add(s.file)
  }
  for (const m of options.mutatedFiles) {
    pinCandidates.add(path.isAbsolute(m) ? path.relative(options.projectDir, m) : m)
  }
  for (const w of options.workingSet) {
    pinCandidates.add(path.isAbsolute(w) ? path.relative(options.projectDir, w) : w)
  }

  const pinnedFiles: PinnedFile[] = []
  for (const relPath of pinCandidates) {
    if (pinnedFiles.length >= 4) break
    const fullPath = path.isAbsolute(relPath) ? relPath : path.join(options.projectDir, relPath)
    try {
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const content = fs.readFileSync(fullPath, "utf-8")
        pinnedFiles.push({ filePath: relPath, content })
      }
    } catch {
      // Skip unreadable files
    }
  }

  let pinSection = formatPinnedFiles(pinnedFiles)
  let pinTokens = countTokens(pinSection)
  let totalTokens = mapTokens + localizeTokens + pinTokens

  // 5. Trimming Algorithm:
  // Step 2a: Truncate pinned bodies from the end
  if (totalTokens > maxTokens && pinnedFiles.length > 0) {
    while (totalTokens > maxTokens && pinnedFiles.length > 1) {
      pinnedFiles.pop()
      pinSection = formatPinnedFiles(pinnedFiles)
      pinTokens = countTokens(pinSection)
      totalTokens = mapTokens + localizeTokens + pinTokens
    }

    if (totalTokens > maxTokens && pinnedFiles.length === 1) {
      const remainingBudget = Math.max(0, maxTokens - mapTokens - localizeTokens)
      const maxChars = Math.max(0, (remainingBudget - 20) * 4)
      if (pinnedFiles[0].content.length > maxChars) {
        pinnedFiles[0].content =
          pinnedFiles[0].content.slice(0, maxChars) + "\n... [truncated]"
        pinSection = formatPinnedFiles(pinnedFiles)
        pinTokens = countTokens(pinSection)
        totalTokens = mapTokens + localizeTokens + pinTokens
      }
      if (totalTokens > maxTokens) {
        // Drop last pin entirely if still over
        pinnedFiles.pop()
        pinSection = ""
        pinTokens = 0
        totalTokens = mapTokens + localizeTokens
      }
    }
  }

  // Step 2b: If still over, reduce localize spans from 5 -> 3 (drop lowest scored)
  if (totalTokens > maxTokens && spanCodes.length > 3) {
    spanCodes.splice(3)
    localizeSection = formatLocalizeSpans(spanCodes)
    localizeTokens = countTokens(localizeSection)
    totalTokens = mapTokens + localizeTokens + pinTokens
  }

  // Step 2c: If still over, reduce map entries
  if (totalTokens > maxTokens && trimmedMapEntries.length > 0) {
    while (totalTokens > maxTokens && trimmedMapEntries.length > 1) {
      trimmedMapEntries.pop()
      mapSection = formatRepoMap(trimmedMapEntries)
      mapTokens = countTokens(mapSection)
      totalTokens = mapTokens + localizeTokens + pinTokens
    }
  }

  // Final hard guarantee: clamp if still slightly over
  if (totalTokens > maxTokens) {
    const overflowChars = (totalTokens - maxTokens) * 4
    if (localizeSection.length > overflowChars + 100) {
      localizeSection = localizeSection.slice(0, localizeSection.length - overflowChars - 50) + "\n</localized_spans>"
      localizeTokens = countTokens(localizeSection)
      totalTokens = mapTokens + localizeTokens + pinTokens
    }
  }

  const sections = [mapSection, localizeSection, pinSection].filter(Boolean)
  const content = sections.join("\n\n")
  const contentHash = crypto.createHash("sha256").update(content).digest("hex")

  return {
    content,
    contentHash,
    partial: locResult.partial,
    mapTokens,
    localizeTokens,
    pinTokens,
  }
}
