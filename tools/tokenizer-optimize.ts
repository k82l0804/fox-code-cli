#!/usr/bin/env bun
/**
 * tokenizer-optimize.ts — Build-time prompt token optimization tool
 *
 * Analyzes system prompts and applies deterministic optimizations to reduce
 * token count without changing semantics. Uses a char-based heuristic
 * (4 chars ≈ 1 token) since we don't depend on tiktoken.
 *
 * Usage:
 *   bun run tools/tokenizer-optimize.ts [--apply]
 *
 * Without --apply: shows analysis and recommendations only.
 * With --apply: writes optimized versions (requires manual review).
 */

import { readFileSync, writeFileSync } from "fs"
import { resolve } from "path"

const APPLY = process.argv.includes("--apply")

// ─── Token estimation ────────────────────────────────────────────────────
// BPE tokenizers average ~4 chars per token for English prose.
// Code/structured text is closer to 3.5. We use 3.8 as a middle ground.
const CHARS_PER_TOKEN = 3.8
const estimateTokens = (text: string): number => Math.ceil(text.length / CHARS_PER_TOKEN)

// ─── Optimization strategies ─────────────────────────────────────────────

interface Optimization {
  name: string
  apply: (text: string) => string
  description: string
}

const optimizations: Optimization[] = [
  {
    name: "collapse_multi_space",
    description: "Replace 2+ spaces with 1 space (except leading indentation)",
    apply: (text) => {
      return text.split("\n").map(line => {
        const indent = line.match(/^(\s*)/)?.[0] ?? ""
        const rest = line.slice(indent.length)
        return indent + rest.replace(/  +/g, " ")
      }).join("\n")
    },
  },
  {
    name: "trim_trailing_whitespace",
    description: "Remove trailing whitespace from each line",
    apply: (text) => text.split("\n").map(l => l.trimEnd()).join("\n"),
  },
  {
    name: "collapse_blank_lines",
    description: "Replace 3+ consecutive blank lines with 2",
    apply: (text) => text.replace(/\n{4,}/g, "\n\n\n"),
  },
  {
    name: "remove_trailing_periods",
    description: "Remove trailing periods from bullet points",
    apply: (text) => text.split("\n").map(line => {
      // Only for lines that look like list items: "- Something."
      if (/^[\s]*[-*]\s/.test(line) && line.endsWith(".") && !line.endsWith("..")) {
        return line.slice(0, -1)
      }
      return line
    }).join("\n"),
  },
  {
    name: "compact_headers",
    description: "Use underscores in markdown headers: '# Tone and style' → '# Tone_and_style'",
    apply: (text) => text.split("\n").map(line => {
      if (/^#+\s/.test(line)) {
        // Replace spaces with underscores in the header text (after the # chars)
        const match = line.match(/^(#+\s)(.+)/)
        if (match) {
          return match[1] + match[2].replace(/ /g, "_")
        }
      }
      return line
    }).join("\n"),
  },
  {
    name: "known_abbreviations",
    description: "Replace known verbose phrases with universally understood short forms",
    apply: (text) => {
      const replacements: [string, string][] = [
        ["current working directory", "cwd"],
        ["package.json", "pkg.json"],
        // Only in instruction text, not in examples
        ["For example", "E.g."],
      ]
      let result = text
      for (const [from, to] of replacements) {
        result = result.replace(new RegExp(from, "g"), to)
      }
      return result
    },
  },
]

// ─── Main ────────────────────────────────────────────────────────────────

const files = [
  { path: "src/session/prompt/default-compact.txt", label: "default-compact.txt" },
  { path: "src/foxcode/soul-compact.txt", label: "soul-compact.txt" },
]

const root = resolve(import.meta.dir, "..")

console.log("═".repeat(68))
console.log("  🦊 Tokenizer-Aware Prompt Optimization Report")
console.log("═".repeat(68))
console.log()

let grandOriginal = 0
let grandOptimized = 0

for (const file of files) {
  const fullPath = resolve(root, file.path)
  let text: string
  try {
    text = readFileSync(fullPath, "utf-8")
  } catch {
    console.log(`  ⚠ ${file.label}: file not found, skipping`)
    continue
  }

  const originalBytes = text.length
  const originalTokens = estimateTokens(text)

  console.log(`  ┌─ ${file.label}`)
  console.log(`  │  Original: ${originalBytes.toLocaleString()} bytes (~${originalTokens.toLocaleString()} tokens)`)

  let optimized = text
  const details: string[] = []

  for (const opt of optimizations) {
    const before = optimized
    optimized = opt.apply(optimized)
    const saved = before.length - optimized.length
    if (saved > 0) {
      details.push(`  │    ${opt.name}: -${saved} bytes (${opt.description})`)
    }
  }

  const optimizedBytes = optimized.length
  const optimizedTokens = estimateTokens(optimized)
  const savedBytes = originalBytes - optimizedBytes
  const savedTokens = originalTokens - optimizedTokens
  const pct = ((savedBytes / originalBytes) * 100).toFixed(1)

  for (const d of details) console.log(d)
  console.log(`  │`)
  console.log(`  │  Optimized: ${optimizedBytes.toLocaleString()} bytes (~${optimizedTokens.toLocaleString()} tokens)`)
  console.log(`  │  Saved:     ${savedBytes} bytes (~${savedTokens} tokens, ${pct}%)`)
  console.log(`  └${"─".repeat(60)}`)
  console.log()

  grandOriginal += originalTokens
  grandOptimized += optimizedTokens

  if (APPLY && savedBytes > 0) {
    writeFileSync(fullPath, optimized)
    console.log(`  ✓ Written optimized ${file.label}`)
  }
}

const grandSaved = grandOriginal - grandOptimized
console.log(`  ${"─".repeat(60)}`)
console.log(`  Combined: ~${grandOriginal} → ~${grandOptimized} tokens/turn (save ~${grandSaved}/turn)`)
console.log(`  Over 10 turns: ~${grandSaved * 10} tokens saved`)
console.log()

if (!APPLY) {
  console.log("  Run with --apply to write optimized files.")
  console.log("  Review changes with: git diff")
}
console.log()
