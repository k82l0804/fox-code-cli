/**
 * Fenced Code Block & SEARCH/REPLACE Parser (Phase 2E Task 2E-6)
 *
 * Extracts whole-file updates and search/replace hunks from weak-model (Tier C/D)
 * prose completions, allowing code mutations without model-side tool calling.
 *
 * Supported formats (in priority order):
 * 1. ``` filepath.ts           (standard fenced block with filename on opening line)
 * 2. File: path/to/file.ts      (Aider-style File: header preceding a fenced block)
 *    ```
 * 3. <<<< SEARCH                (SEARCH/REPLACE block with preceding or inline file header)
 *    <original>
 *    ====
 *    <replacement>
 *    >>>> REPLACE
 */
import * as path from "path"

export interface ParsedBlock {
  /** Relative file path extracted from block header */
  file: string
  /** Extracted file content (full content for fence, replacement for search-replace) */
  content: string
  /** Block format */
  format: "fence" | "search-replace"
  /** 1-based start line of block in assistant response */
  startLine: number
  /** Original content to find, if format is search-replace */
  searchContent?: string
  /** Replacement content, if format is search-replace */
  replaceContent?: string
}

const COMMON_LANGUAGES = new Set([
  "ts", "tsx", "js", "jsx", "javascript", "typescript",
  "py", "python", "rb", "ruby", "sh", "bash", "zsh", "shell",
  "json", "jsonc", "yaml", "yml", "toml", "xml", "html", "css", "scss",
  "md", "markdown", "sql", "diff", "text", "txt", "go", "golang",
  "rs", "rust", "c", "cpp", "h", "hpp", "java", "kt", "kotlin",
  "cs", "csharp", "php", "swift", "dart", "scala", "proto",
])

function cleanFilePath(raw: string): string {
  const unquoted = raw.replace(/^['"`]+|['"`]+$/g, "").replace(/:$/, "").trim()
  return path.normalize(unquoted).replace(/^(\.\/)+/, "")
}

function extractFileFromInfoString(info: string): string | undefined {
  if (!info) return undefined
  const trimmed = info.trim()
  const parts = trimmed.split(/[\s:]+/).filter(Boolean)

  if (parts.length === 1) {
    const single = parts[0]
    // If it's a known language name without extension or path separator, it's not a file
    if (COMMON_LANGUAGES.has(single.toLowerCase()) && !single.includes(".") && !single.includes("/")) {
      return undefined
    }
    // Must look like a file path (has extension or directory separator)
    if (single.includes(".") || single.includes("/")) {
      return cleanFilePath(single)
    }
    return undefined
  }

  // Multiple tokens, e.g. "typescript src/index.ts" or "ts:src/index.ts"
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]
    if (p.includes(".") || p.includes("/")) {
      return cleanFilePath(p)
    }
  }

  // If second token is non-empty and not just a language tag
  if (parts[1] && !COMMON_LANGUAGES.has(parts[1].toLowerCase())) {
    return cleanFilePath(parts[1])
  }

  return undefined
}

/**
 * Extract file blocks from an assistant's text response.
 * Returns an empty array if no valid blocks are found.
 * Tolerant: skips malformed blocks and extracts valid ones.
 */
export function parseFencedBlocks(text: string): ParsedBlock[] {
  if (!text) return []

  const lines = text.split("\n")
  const blocks: ParsedBlock[] = []

  let lastHeaderFile: { file: string; line: number } | undefined

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // 1. Check for File header: "File: path/to/file.ts" or "### path/to/file.ts" or "path/to/file.ts:"
    const fileHeaderMatch =
      trimmed.match(/^(?:File|file|Filename|filename):\s*([^\s]+)/) ||
      trimmed.match(/^###\s+([^\s:]+\.[a-zA-Z0-9_-]+)/) ||
      trimmed.match(/^([a-zA-Z0-9_./-]+\.[a-zA-Z0-9_-]+):$/)

    if (fileHeaderMatch && fileHeaderMatch[1]) {
      const candidate = cleanFilePath(fileHeaderMatch[1])
      if (candidate.includes(".") || candidate.includes("/")) {
        lastHeaderFile = { file: candidate, line: i + 1 }
        continue
      }
    }

    // 2. Check for SEARCH/REPLACE block
    const searchMatch = trimmed.match(/^<{4,7}\s*SEARCH/)
    if (searchMatch) {
      const startLine = i + 1
      const searchLines: string[] = []
      const replaceLines: string[] = []
      let foundDivider = false
      let foundEnd = false

      let j = i + 1
      while (j < lines.length) {
        const cur = lines[j]
        const curTrimmed = cur.trim()

        if (!foundDivider) {
          if (curTrimmed.match(/^={4,7}/)) {
            foundDivider = true
          } else {
            searchLines.push(cur)
          }
        } else {
          if (curTrimmed.match(/^>{4,7}\s*REPLACE/)) {
            foundEnd = true
            i = j
            break
          } else {
            replaceLines.push(cur)
          }
        }
        j++
      }

      if (foundDivider && foundEnd) {
        const file = lastHeaderFile && Math.abs(startLine - lastHeaderFile.line) <= 5
          ? lastHeaderFile.file
          : undefined

        if (file) {
          const searchContent = searchLines.join("\n")
          const replaceContent = replaceLines.join("\n")
          blocks.push({
            file,
            content: replaceContent,
            format: "search-replace",
            startLine,
            searchContent,
            replaceContent,
          })
          lastHeaderFile = undefined
        }
      }
      continue
    }

    // 3. Check for fenced code block: ``` ...
    if (trimmed.startsWith("```")) {
      const startLine = i + 1
      const info = trimmed.slice(3).trim()

      let targetFile = extractFileFromInfoString(info)

      // If no file in opening line, check preceding File header (within 3 lines)
      if (!targetFile && lastHeaderFile && startLine - lastHeaderFile.line <= 3) {
        targetFile = lastHeaderFile.file
      }

      // Collect block content until closing ```
      const contentLines: string[] = []
      let closed = false

      let j = i + 1
      while (j < lines.length) {
        const curLine = lines[j]
        const curTrim = curLine.trim()

        // If we encounter a new File: header or another opening fence,
        // the current block was never closed!
        if (
          curTrim.match(/^(?:File|file|Filename|filename):\s*([^\s]+)/) ||
          curTrim.match(/^###\s+([^\s:]+\.[a-zA-Z0-9_-]+)/) ||
          (curTrim.startsWith("```") && curTrim.slice(3).trim().length > 0)
        ) {
          i = j - 1
          break
        }

        if (curTrim === "```" || curTrim.match(/^`{3,}\s*$/)) {
          closed = true
          i = j
          break
        }
        contentLines.push(curLine)
        j++
      }

      // Only emit if block was properly closed and has a recognized file path
      if (closed && targetFile) {
        blocks.push({
          file: targetFile,
          content: contentLines.join("\n"),
          format: "fence",
          startLine,
        })
        lastHeaderFile = undefined
      }
      continue
    }
  }

  return blocks
}
