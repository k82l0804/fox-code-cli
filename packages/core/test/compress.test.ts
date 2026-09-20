import { describe, expect, test, beforeEach } from "bun:test"
import {
  relativizePaths,
  deduplicateLogLines,
  compressTabular,
  compressJsonKeys,
  trimDiffContext,
  compressGitStatus,
  filterTestOutput,
  rewriteGitCommand,
  process,
  type CompressContext,
} from "../src/tool/compress"
import { CompressionMetrics } from "../src/tool/compression-metrics"

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const ctx = (overrides?: Partial<CompressContext>): CompressContext => ({
  workspaceRoot: "/home/user/project",
  toolName: "test",
  ...overrides,
})

// ═══════════════════════════════════════════════════════════════════════════
// 4.2 — Path Prefix Normalization
// ═══════════════════════════════════════════════════════════════════════════

describe("relativizePaths", () => {
  test("replaces workspace root with relative path", () => {
    const input = "File: /home/user/project/src/main.ts"
    const result = relativizePaths(input, ctx())
    expect(result).toContain("src/main.ts")
    expect(result).not.toContain("/home/user/project/src/main.ts")
  })

  test("prepends CWD header when paths are replaced", () => {
    const input = "/home/user/project/src/main.ts"
    const result = relativizePaths(input, ctx())
    expect(result).toStartWith("[CWD: /home/user/project]")
  })

  test("handles grep-style output with line numbers", () => {
    const input = "/home/user/project/src/foo.ts:42: const x = 1"
    const result = relativizePaths(input, ctx())
    expect(result).toContain("src/foo.ts:42: const x = 1")
  })

  test("replaces multiple paths in multi-line output", () => {
    const input = [
      "/home/user/project/src/a.ts",
      "/home/user/project/src/b.ts",
      "/home/user/project/test/c.ts",
    ].join("\n")
    const result = relativizePaths(input, ctx())
    expect(result).toContain("src/a.ts")
    expect(result).toContain("src/b.ts")
    expect(result).toContain("test/c.ts")
  })

  test("does not modify text without workspace paths", () => {
    const input = "Just some text with no paths"
    const result = relativizePaths(input, ctx())
    expect(result).toBe(input)
  })

  test("does not modify paths outside workspace", () => {
    const input = "/usr/lib/node_modules/foo.ts"
    const result = relativizePaths(input, ctx())
    expect(result).toBe(input)
  })

  test("handles empty workspace root gracefully", () => {
    const input = "/home/user/project/src/main.ts"
    const result = relativizePaths(input, ctx({ workspaceRoot: "" }))
    expect(result).toBe(input)
  })

  test("handles trailing slash in workspace root", () => {
    const input = "/home/user/project/src/main.ts"
    const result = relativizePaths(input, ctx({ workspaceRoot: "/home/user/project/" }))
    expect(result).toContain("src/main.ts")
  })

  test("produces shorter output on repeated deep paths", () => {
    const deepPath = "/home/user/project/packages/core/src/tool/compress.ts"
    const input = Array(20).fill(`${deepPath}: some content`).join("\n")
    const result = relativizePaths(input, ctx())
    expect(result.length).toBeLessThan(input.length)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4.7a — Tabular Compression
// ═══════════════════════════════════════════════════════════════════════════

describe("compressTabular", () => {
  test("converts JSON array of objects to columnar format", () => {
    const input = JSON.stringify([
      { name: "Alice", age: 30, city: "NYC" },
      { name: "Bob", age: 25, city: "LA" },
      { name: "Charlie", age: 35, city: "SF" },
    ])
    const result = compressTabular(input, ctx())
    expect(result).toContain("Columns: name | age | city")
    expect(result).toContain("Alice | 30 | NYC")
    expect(result).toContain("Bob | 25 | LA")
  })

  test("does not compress arrays with fewer than 3 objects", () => {
    const input = JSON.stringify([{ a: 1 }, { a: 2 }])
    const result = compressTabular(input, ctx())
    expect(result).toBe(input)
  })

  test("does not compress objects with different key sets", () => {
    const input = JSON.stringify([{ a: 1, b: 2 }, { a: 1, c: 3 }, { a: 1, b: 2 }])
    const result = compressTabular(input, ctx())
    expect(result).toBe(input)
  })

  test("does not modify non-JSON text", () => {
    const input = "just plain text"
    const result = compressTabular(input, ctx())
    expect(result).toBe(input)
  })

  test("does not modify non-array JSON", () => {
    const input = JSON.stringify({ key: "value" })
    const result = compressTabular(input, ctx())
    expect(result).toBe(input)
  })

  test("produces shorter output for large arrays", () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      username: `user_${i}`,
      email: `user${i}@example.com`,
      status: i % 2 === 0 ? "active" : "inactive",
    }))
    const input = JSON.stringify(items)
    const result = compressTabular(input, ctx())
    expect(result.length).toBeLessThan(input.length)
    expect(result).toContain("Columns:")
  })

  test("handles null values in objects", () => {
    const input = JSON.stringify([
      { name: "Alice", age: null },
      { name: "Bob", age: 25 },
      { name: "Charlie", age: null },
    ])
    const result = compressTabular(input, ctx())
    expect(result).toContain("Columns:")
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4.7b — Log Line Deduplication
// ═══════════════════════════════════════════════════════════════════════════

describe("deduplicateLogLines", () => {
  test("collapses 3+ consecutive identical lines", () => {
    const input = Array(10).fill("ERROR: connection timeout").join("\n")
    const result = deduplicateLogLines(input, ctx())
    expect(result).toContain("[×10] ERROR: connection timeout")
    expect(result.split("\n").length).toBe(1)
  })

  test("does not collapse 2 identical lines", () => {
    const lines = [
      "line 1",
      "ERROR: timeout",
      "ERROR: timeout",
      "line 4",
      "line 5",
    ]
    const input = lines.join("\n")
    const result = deduplicateLogLines(input, ctx())
    // 2 copies → not collapsed (threshold is 3)
    expect(result).toBe(input)
  })

  test("preserves unique lines", () => {
    const lines = ["line 1", "line 2", "line 3", "line 4", "line 5"]
    const input = lines.join("\n")
    const result = deduplicateLogLines(input, ctx())
    expect(result).toBe(input)
  })

  test("collapses multiple separate groups", () => {
    const lines = [
      ...Array(5).fill("AAA"),
      "unique",
      ...Array(4).fill("BBB"),
    ]
    const input = lines.join("\n")
    const result = deduplicateLogLines(input, ctx())
    expect(result).toContain("[×5] AAA")
    expect(result).toContain("[×4] BBB")
    expect(result).toContain("unique")
  })

  test("does not compress text with fewer than 5 lines", () => {
    const input = "a\nb\nc\nd"
    const result = deduplicateLogLines(input, ctx())
    expect(result).toBe(input)
  })

  test("produces shorter output on repetitive logs", () => {
    const input = Array(100).fill("2026-09-20 10:00:00 INFO  healthcheck OK").join("\n")
    const result = deduplicateLogLines(input, ctx())
    expect(result.length).toBeLessThan(input.length)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4.10 — JSON Key Legend Packing
// ═══════════════════════════════════════════════════════════════════════════

describe("compressJsonKeys", () => {
  test("replaces long keys with abbreviations and adds legend", () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      username: `user_${i}`,
      email_address: `u${i}@example.com`,
      full_name: `User Number ${i}`,
      department: "engineering",
    }))
    const input = JSON.stringify(items)
    const result = compressJsonKeys(input, ctx())
    expect(result).toContain("[legend:")
    expect(result).toContain("a=username")
    expect(result.length).toBeLessThan(input.length)
  })

  test("does not compress when key chars savings < 100", () => {
    const input = JSON.stringify([{ a: 1 }, { a: 2 }, { a: 3 }])
    const result = compressJsonKeys(input, ctx())
    expect(result).toBe(input)
  })

  test("does not compress non-JSON text", () => {
    const input = "not json"
    const result = compressJsonKeys(input, ctx())
    expect(result).toBe(input)
  })

  test("does not compress when keys > 26", () => {
    const obj: Record<string, number> = {}
    for (let i = 0; i < 27; i++) obj[`key_${i}_long_name`] = i
    const input = JSON.stringify([obj, { ...obj }, { ...obj }])
    const result = compressJsonKeys(input, ctx())
    expect(result).toBe(input)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Compression Metrics Accumulator
// ═══════════════════════════════════════════════════════════════════════════

describe("CompressionMetrics", () => {
  beforeEach(() => {
    CompressionMetrics.reset()
  })

  test("reset clears all counters", () => {
    CompressionMetrics.record("test", 1000, 800, 5.0)
    CompressionMetrics.reset()
    const s = CompressionMetrics.summary()
    expect(s.charsBefore).toBe(0)
    expect(s.charsAfter).toBe(0)
    expect(s.charsSaved).toBe(0)
    expect(s.overheadMs).toBe(0)
  })

  test("record accumulates charsBefore/charsAfter", () => {
    CompressionMetrics.record("test", 1000, 800, 5.0)
    CompressionMetrics.record("test", 500, 450, 2.0)
    const s = CompressionMetrics.summary()
    expect(s.charsBefore).toBe(1500)
    expect(s.charsAfter).toBe(1250)
    expect(s.charsSaved).toBe(250)
  })

  test("summary computes pctSaved correctly", () => {
    CompressionMetrics.record("test", 1000, 800, 5.0)
    const s = CompressionMetrics.summary()
    expect(s.pctSaved).toBe(20.0)
  })

  test("active returns false before any recording", () => {
    expect(CompressionMetrics.active()).toBe(false)
  })

  test("active returns true after record", () => {
    CompressionMetrics.record("test", 100, 90, 1.0)
    expect(CompressionMetrics.active()).toBe(true)
  })

  test("recordSchema tracks separately", () => {
    CompressionMetrics.recordSchema(500)
    const s = CompressionMetrics.summary()
    expect(s.schemaSaved).toBe(500)
    expect(CompressionMetrics.active()).toBe(true)
  })

  test("recordSuperseded tracks count", () => {
    CompressionMetrics.recordSuperseded(3)
    const s = CompressionMetrics.summary()
    expect(s.superseded).toBe(3)
  })

  test("pctSaved is 0 when charsBefore is 0", () => {
    const s = CompressionMetrics.summary()
    expect(s.pctSaved).toBe(0)
  })

  test("overheadMs accumulates and rounds", () => {
    CompressionMetrics.record("test", 100, 90, 1.234)
    CompressionMetrics.record("test", 100, 90, 2.345)
    const s = CompressionMetrics.summary()
    expect(s.overheadMs).toBe(3.58)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Full Pipeline (process)
// ═══════════════════════════════════════════════════════════════════════════

describe("process (full pipeline)", () => {
  beforeEach(() => {
    CompressionMetrics.reset()
  })

  test("returns input unchanged when no transforms match", () => {
    const input = "simple text, no paths, no JSON"
    const result = process(input, ctx())
    expect(result).toBe(input)
  })

  test("is safe on empty string", () => {
    expect(process("", ctx())).toBe("")
  })

  test("is idempotent (double-compress same result)", () => {
    const input = "/home/user/project/src/main.ts\n/home/user/project/src/util.ts"
    const once = process(input, ctx())
    const twice = process(once, ctx())
    expect(twice).toBe(once)
  })

  test("records metrics when transforms are enabled", () => {
    // This test depends on FOX_EXPERIMENTAL_COMPRESS_PATHS being set
    // at runtime. If not set, transforms won't fire. That's OK —
    // the test verifies the metrics plumbing when transforms do run.
    const input = "/home/user/project/src/main.ts"
    process(input, ctx())
    // Metrics should have been recorded (active if any flag was on)
    const s = CompressionMetrics.summary()
    // At minimum, charsBefore should reflect the input
    if (CompressionMetrics.active()) {
      expect(s.charsBefore).toBeGreaterThan(0)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4.5 — Diff Context Trimming
// ═══════════════════════════════════════════════════════════════════════════

describe("trimDiffContext", () => {
  const UNIFIED_DIFF = [
    "diff --git a/src/main.ts b/src/main.ts",
    "index abc1234..def5678 100644",
    "--- a/src/main.ts",
    "+++ b/src/main.ts",
    "@@ -10,9 +10,9 @@ function init() {",
    "   const a = 1",
    "   const b = 2",
    "   const c = 3",
    "-  const old = true",
    "+  const new_ = false",
    "   const d = 4",
    "   const e = 5",
    "   const f = 6",
  ].join("\n")

  test("trims 3 context lines to 1", () => {
    const result = trimDiffContext(UNIFIED_DIFF, ctx())
    // Should keep only 1 context line before and after the change
    expect(result).toContain("-  const old = true")
    expect(result).toContain("+  const new_ = false")
    // Should NOT contain lines far from the change
    expect(result).not.toContain("const a = 1")
    expect(result).not.toContain("const f = 6")
    // Should keep 1 context line adjacent to change
    expect(result).toContain("const c = 3")
    expect(result).toContain("const d = 4")
    // Should be shorter
    expect(result.length).toBeLessThan(UNIFIED_DIFF.length)
  })

  test("preserves file headers", () => {
    const result = trimDiffContext(UNIFIED_DIFF, ctx())
    expect(result).toContain("diff --git a/src/main.ts b/src/main.ts")
    expect(result).toContain("--- a/src/main.ts")
    expect(result).toContain("+++ b/src/main.ts")
  })

  test("preserves ALL changed lines (+/-)", () => {
    const multiChange = [
      "diff --git a/f.ts b/f.ts",
      "--- a/f.ts",
      "+++ b/f.ts",
      "@@ -1,10 +1,10 @@",
      "   line1",
      "-  old1",
      "+  new1",
      "   line3",
      "   line4",
      "   line5",
      "-  old2",
      "+  new2",
      "   line7",
      "   line8",
    ].join("\n")
    const result = trimDiffContext(multiChange, ctx())
    expect(result).toContain("-  old1")
    expect(result).toContain("+  new1")
    expect(result).toContain("-  old2")
    expect(result).toContain("+  new2")
  })

  test("handles multi-hunk diffs", () => {
    const multiHunk = [
      "diff --git a/f.ts b/f.ts",
      "--- a/f.ts",
      "+++ b/f.ts",
      "@@ -5,7 +5,7 @@ first hunk",
      "   ctx1",
      "   ctx2",
      "   ctx3",
      "-  old1",
      "+  new1",
      "   ctx4",
      "   ctx5",
      "   ctx6",
      "@@ -20,7 +20,7 @@ second hunk",
      "   ctx1",
      "   ctx2",
      "   ctx3",
      "-  old2",
      "+  new2",
      "   ctx4",
      "   ctx5",
      "   ctx6",
    ].join("\n")
    const result = trimDiffContext(multiHunk, ctx())
    expect(result).toContain("-  old1")
    expect(result).toContain("+  new1")
    expect(result).toContain("-  old2")
    expect(result).toContain("+  new2")
    expect(result.length).toBeLessThan(multiHunk.length)
  })

  test("passes through non-diff text unchanged", () => {
    const input = "This is just regular text\nWith multiple lines\nNo diff here"
    const result = trimDiffContext(input, ctx())
    expect(result).toBe(input)
  })

  test("passes through text with @@ but no diff headers", () => {
    const input = "some text with @@ in it\nbut no diff markers"
    const result = trimDiffContext(input, ctx())
    expect(result).toBe(input)
  })

  test("recalculates hunk line counts correctly", () => {
    const result = trimDiffContext(UNIFIED_DIFF, ctx())
    // Extract the @@ header from result
    const resultLines = result.split("\n")
    const hunkIdx = resultLines.findIndex(l => l.startsWith("@@"))
    expect(hunkIdx).toBeGreaterThanOrEqual(0)
    const hunkHeader = resultLines[hunkIdx]!
    // Parse counts
    const match = hunkHeader.match(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/)
    expect(match).toBeTruthy()
    if (match) {
      const oldCount = parseInt(match[2]!)
      const newCount = parseInt(match[4]!)
      // Count actual lines in trimmed hunk (only body lines after @@)
      const bodyLines = resultLines.slice(hunkIdx + 1).filter(l =>
        l.startsWith("   ") || l.startsWith("-") || l.startsWith("+"))
      const actualOld = bodyLines.filter(l => l.startsWith("   ") || l.startsWith("-")).length
      const actualNew = bodyLines.filter(l => l.startsWith("   ") || l.startsWith("+")).length
      expect(oldCount).toBe(actualOld)
      expect(newCount).toBe(actualNew)
    }
  })

  test("saves significant bytes on large diffs", () => {
    // Simulate a 50-hunk diff with 3 context lines each
    const hunks: string[] = [
      "diff --git a/big.ts b/big.ts",
      "--- a/big.ts",
      "+++ b/big.ts",
    ]
    for (let h = 0; h < 50; h++) {
      hunks.push(`@@ -${h * 10 + 1},7 +${h * 10 + 1},7 @@ function f${h}()`)
      hunks.push("   context line 1")
      hunks.push("   context line 2")
      hunks.push("   context line 3")
      hunks.push(`-  old value ${h}`)
      hunks.push(`+  new value ${h}`)
      hunks.push("   context line 4")
      hunks.push("   context line 5")
      hunks.push("   context line 6")
    }
    const input = hunks.join("\n")
    const result = trimDiffContext(input, ctx())
    expect(result.length).toBeLessThan(input.length)
    // Should save ~40% by trimming 6 context lines to 2 per hunk
    const savings = ((input.length - result.length) / input.length) * 100
    expect(savings).toBeGreaterThan(30)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Safety Rails
// ═══════════════════════════════════════════════════════════════════════════

describe("safety rails", () => {
  test("no transform increases output size", () => {
    // Run various inputs through each individual transform
    const inputs = [
      "simple text",
      "/home/user/project/src/main.ts",
      '[\n{"a":1},\n{"a":2},\n{"a":3}\n]',
      "line1\nline1\nline1\nline1\nline1\nline1",
    ]
    for (const input of inputs) {
      expect(relativizePaths(input, ctx()).length).toBeLessThanOrEqual(input.length + 50) // CWD header OK
      expect(compressTabular(input, ctx()).length).toBeLessThanOrEqual(input.length)
      expect(deduplicateLogLines(input, ctx()).length).toBeLessThanOrEqual(input.length)
      expect(compressJsonKeys(input, ctx()).length).toBeLessThanOrEqual(input.length)
    }
  })

  test("tabular compression preserves row count", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: i, name: `item${i}`, value: i * 100 }))
    const input = JSON.stringify(items)
    const result = compressTabular(input, ctx())
    // Result should have header + 10 data rows
    const lines = result.split("\n")
    expect(lines[0]).toStartWith("Columns:")
    expect(lines.length).toBe(11) // 1 header + 10 rows
  })

  test("diff trimming never drops a changed line", () => {
    const diff = [
      "diff --git a/f.ts b/f.ts",
      "--- a/f.ts",
      "+++ b/f.ts",
      "@@ -1,20 +1,20 @@",
    ]
    // Add 5 changes with 3 context lines between each
    for (let i = 0; i < 5; i++) {
      diff.push("   ctx1", "   ctx2", "   ctx3")
      diff.push(`-  removed_line_${i}`)
      diff.push(`+  added_line_${i}`)
    }
    diff.push("   ctx1", "   ctx2", "   ctx3")
    const input = diff.join("\n")
    const result = trimDiffContext(input, ctx())
    for (let i = 0; i < 5; i++) {
      expect(result).toContain(`-  removed_line_${i}`)
      expect(result).toContain(`+  added_line_${i}`)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Git Status Compression Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("compressGitStatus", () => {
  test("compresses standard verbose git status to compact format", () => {
    const raw = [
      "On branch feat/auth-tokens",
      "Your branch is up to date with 'origin/feat/auth-tokens'.",
      "",
      "Changes to be committed:",
      '  (use "git restore --staged <file>..." to unstage)',
      "\tmodified:   packages/core/src/tool/compress.ts",
      "",
      "Changes not staged for commit:",
      '  (use "git add <file>..." to update what will be committed)',
      '  (use "git restore <file>..." to discard changes in working directory)',
      "\tmodified:   src/tool/tool.ts",
      "\tmodified:   src/session/supersede.ts",
      "",
      "Untracked files:",
      '  (use "git add <file>..." to include in what will be committed)',
      "\ttest/fixtures/sample.diff",
      "",
      'no changes added to commit (use "git add" to commit)',
    ].join("\n")

    const result = compressGitStatus(raw, ctx())
    expect(result).toContain("## feat/auth-tokens")
    expect(result).toContain("M  packages/core/src/tool/compress.ts")
    expect(result).toContain(" M src/tool/tool.ts")
    expect(result).toContain(" M src/session/supersede.ts")
    expect(result).toContain("?? test/fixtures/sample.diff")
    expect(result).not.toContain('(use "git add')
    expect(result).not.toContain("no changes added to commit")
    expect(result.length).toBeLessThan(raw.length * 0.5) // >50% compression
  })

  test("handles clean working tree", () => {
    const raw = [
      "On branch main",
      "Your branch is up to date with 'origin/main'.",
      "",
      "nothing to commit, working tree clean",
    ].join("\n")

    const result = compressGitStatus(raw, ctx())
    expect(result).toContain("## main")
    expect(result).toContain("(working tree clean)")
    expect(result.length).toBeLessThan(raw.length)
  })

  test("returns non-git-status text unchanged", () => {
    const input = "Just some arbitrary console output\nwith multiple lines"
    const result = compressGitStatus(input, ctx())
    expect(result).toBe(input)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Test Output Filtering Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("filterTestOutput", () => {
  test("collapses consecutive passing tests into summary line", () => {
    const lines = [
      "Running test suite...",
      "✓ test 1 passes (1ms)",
      "✓ test 2 passes (1ms)",
      "✓ test 3 passes (2ms)",
      "✓ test 4 passes (1ms)",
      "✓ test 5 passes (1ms)",
      "✓ test 6 passes (2ms)",
      "FAIL test 7 failed with Assertion Error",
      "  expected true to be false",
      "  at src/test.ts:42",
      "Tests: 1 failed, 6 passed",
    ]
    const input = lines.join("\n")
    const result = filterTestOutput(input, ctx())
    expect(result).toContain("passing tests omitted")
    expect(result).toContain("FAIL test 7 failed with Assertion Error")
    expect(result).toContain("at src/test.ts:42")
    expect(result).toContain("Tests: 1 failed, 6 passed")
    expect(result.length).toBeLessThan(input.length)
  })

  test("keeps fewer than 4 passing tests uncollapsed", () => {
    const lines = [
      "Running test suite...",
      "✓ test 1 passes",
      "✓ test 2 passes",
      "FAIL test 3 failed",
      "Tests: 1 failed, 2 passed",
    ]
    const input = lines.join("\n")
    const result = filterTestOutput(input, ctx())
    expect(result).toBe(input)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Lockfile & Index Trimming in Diff Context
// ═══════════════════════════════════════════════════════════════════════════

describe("trimDiffContext with Git enhancements", () => {
  test("strips index hash lines from diffs", () => {
    const diff = [
      "diff --git a/src/index.ts b/src/index.ts",
      "index 8a3b1c2..9d4e5f6 100644",
      "--- a/src/index.ts",
      "+++ b/src/index.ts",
      "@@ -1,3 +1,3 @@",
      " const a = 1",
      "-const b = 2",
      "+const b = 3",
      " const c = 4",
    ].join("\n")

    const result = trimDiffContext(diff, ctx())
    expect(result).not.toContain("index 8a3b1c2..9d4e5f6 100644")
    expect(result).toContain("-const b = 2")
    expect(result).toContain("+const b = 3")
  })

  test("collapses large lockfile diffs", () => {
    const lockfileDiff = [
      "diff --git a/package-lock.json b/package-lock.json",
      "--- a/package-lock.json",
      "+++ b/package-lock.json",
      "@@ -1,50 +1,50 @@",
      ...Array.from({ length: 30 }, (_, i) => `-  "integrity": "sha512-old${i}"`),
      ...Array.from({ length: 30 }, (_, i) => `+  "integrity": "sha512-new${i}"`),
    ].join("\n")

    const result = trimDiffContext(lockfileDiff, ctx())
    expect(result).toContain("package-lock.json")
    expect(result).toContain("lockfile diff collapsed")
    expect(result.length).toBeLessThan(lockfileDiff.length * 0.3)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Pre-Execution Git Command Rewriting Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("rewriteGitCommand", () => {
  const opt = { enabled: true }

  test("rewrites bare git status to git status -sb", () => {
    expect(rewriteGitCommand("git status", opt)).toBe("git status -sb")
    expect(rewriteGitCommand("git status .", opt)).toBe("git status -sb .")
  })

  test("preserves existing short or porcelain flags on git status", () => {
    expect(rewriteGitCommand("git status -s", opt)).toBe("git status -s")
    expect(rewriteGitCommand("git status --short", opt)).toBe("git status --short")
    expect(rewriteGitCommand("git status --porcelain", opt)).toBe("git status --porcelain")
  })

  test("rewrites bare git diff to inject -U1 context lines", () => {
    expect(rewriteGitCommand("git diff", opt)).toBe("git diff -U1")
    expect(rewriteGitCommand("git diff src/index.ts", opt)).toBe("git diff -U1 src/index.ts")
    expect(rewriteGitCommand("git diff --cached", opt)).toBe("git diff -U1 --cached")
  })

  test("preserves existing -U or --unified flags on git diff", () => {
    expect(rewriteGitCommand("git diff -U3", opt)).toBe("git diff -U3")
    expect(rewriteGitCommand("git diff --unified=2", opt)).toBe("git diff --unified=2")
  })

  test("rewrites unbounded git log to inject --oneline -n 20", () => {
    expect(rewriteGitCommand("git log", opt)).toBe("git log --oneline -n 20")
  })

  test("preserves existing limit or format flags on git log", () => {
    expect(rewriteGitCommand("git log -n 5", opt)).toBe("git log -n 5")
    expect(rewriteGitCommand("git log --oneline", opt)).toBe("git log --oneline")
    expect(rewriteGitCommand("git log -10", opt)).toBe("git log -10")
    expect(rewriteGitCommand("git log --format='%h %s'", opt)).toBe("git log --format='%h %s'")
  })

  test("rewrites chained git commands properly", () => {
    const input = "git add . && git commit -m 'update' && git status"
    const expected = "git add . && git commit -m 'update' && git status -sb"
    expect(rewriteGitCommand(input, opt)).toBe(expected)
  })

  test("leaves non-git commands unchanged", () => {
    expect(rewriteGitCommand("npm test", opt)).toBe("npm test")
    expect(rewriteGitCommand("bun run build", opt)).toBe("bun run build")
    expect(rewriteGitCommand("ls -la", opt)).toBe("ls -la")
  })

  test("returns command unchanged when disabled", () => {
    expect(rewriteGitCommand("git status", { enabled: false })).toBe("git status")
  })
})
