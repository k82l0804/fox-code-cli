import { describe, expect, test } from "bun:test"
import { Transaction } from "../packages/core/src/transaction"
import { Effect, Layer } from "effect"
import { FSUtil } from "../packages/core/src/fs-util"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

// ─── Helpers ────────────────────────────────────────────────────────────────

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "fox-tx-test-"))
}

function writeFile(dir: string, name: string, content: string) {
  const filepath = path.join(dir, name)
  fs.mkdirSync(path.dirname(filepath), { recursive: true })
  fs.writeFileSync(filepath, content, "utf-8")
  return filepath
}

function readFile(filepath: string) {
  return fs.readFileSync(filepath, "utf-8")
}

function fileExists(filepath: string) {
  return fs.existsSync(filepath)
}

// ─── Transaction.create ─────────────────────────────────────────────────────

describe("Transaction", () => {
  test("creates an empty transaction", () => {
    const tx = Transaction.create()
    expect(tx.sealed()).toBe(false)
    expect(tx.entries().size).toBe(0)
  })

  test("journal records pre-image on first call", () => {
    const tx = Transaction.create()
    const bytes = new TextEncoder().encode("hello")
    tx.journal("/test/file.ts", bytes)
    expect(tx.entries().size).toBe(1)
    expect(tx.entries().get("/test/file.ts")).toBe(bytes)
  })

  test("journal ignores duplicate calls for same path", () => {
    const tx = Transaction.create()
    const first = new TextEncoder().encode("first")
    const second = new TextEncoder().encode("second")
    tx.journal("/test/file.ts", first)
    tx.journal("/test/file.ts", second)
    expect(tx.entries().size).toBe(1)
    expect(tx.entries().get("/test/file.ts")).toBe(first)
  })

  test("journal records null for created files", () => {
    const tx = Transaction.create()
    tx.journal("/test/new.ts", null)
    expect(tx.entries().get("/test/new.ts")).toBe(null)
  })

  test("commit seals and clears journal", () => {
    const tx = Transaction.create()
    tx.journal("/test/file.ts", new TextEncoder().encode("data"))
    tx.commit()
    expect(tx.sealed()).toBe(true)
    expect(tx.entries().size).toBe(0)
  })

  test("journal is no-op after commit", () => {
    const tx = Transaction.create()
    tx.commit()
    tx.journal("/test/file.ts", new TextEncoder().encode("data"))
    expect(tx.entries().size).toBe(0)
  })

  test("multiple files can be journaled", () => {
    const tx = Transaction.create()
    tx.journal("/a.ts", new TextEncoder().encode("a"))
    tx.journal("/b.ts", new TextEncoder().encode("b"))
    tx.journal("/c.ts", null)
    expect(tx.entries().size).toBe(3)
  })
})

// ─── deriveWithConfidence (from patch.ts) ────────────────────────────────────

import { Patch } from "../packages/core/src/patch"

describe("deriveWithConfidence", () => {
  test("returns exact match confidence 1.0 for exact matches", () => {
    const original = "line one\nline two\nline three\n"
    const chunks: Patch.UpdateFileChunk[] = [
      { oldLines: ["line two"], newLines: ["line TWO"] },
    ]
    const result = Patch.deriveWithConfidence("test.ts", chunks, original)
    expect(result.update.content).toContain("line TWO")
    expect(result.confidence).toHaveLength(1)
    expect(result.confidence[0].matchTier).toBe("exact")
    expect(result.confidence[0].score).toBe(1.0)
  })

  test("returns lower tier for whitespace-trimmed matches", () => {
    const original = "line one  \nline two\n"
    const chunks: Patch.UpdateFileChunk[] = [
      { oldLines: ["line one"], newLines: ["line ONE"] },
    ]
    const result = Patch.deriveWithConfidence("test.ts", chunks, original)
    expect(result.update.content).toContain("line ONE")
    expect(result.confidence[0].matchTier).toBe("rstrip")
    expect(result.confidence[0].score).toBeLessThan(1.0)
    expect(result.confidence[0].score).toBeGreaterThanOrEqual(0.9)
  })

  test("includes context lines in confidence scoring", () => {
    const original = "function foo() {\n  return 1\n}\nfunction bar() {\n  return 2\n}\n"
    const chunks: Patch.UpdateFileChunk[] = [
      {
        oldLines: ["  return 2"],
        newLines: ["  return 42"],
        changeContext: "function bar() {",
      },
    ]
    const result = Patch.deriveWithConfidence("test.ts", chunks, original)
    expect(result.update.content).toContain("return 42")
    expect(result.confidence[0].contextLines).toBeGreaterThanOrEqual(1)
  })

  test("pure additions have exact confidence", () => {
    const original = "existing\n"
    const chunks: Patch.UpdateFileChunk[] = [
      { oldLines: [], newLines: ["added line"] },
    ]
    const result = Patch.deriveWithConfidence("test.ts", chunks, original)
    expect(result.confidence[0].matchTier).toBe("exact")
    expect(result.confidence[0].score).toBe(1.0)
  })

  test("multi-chunk patch produces multiple confidence entries", () => {
    const original = "a\nb\nc\nd\n"
    const chunks: Patch.UpdateFileChunk[] = [
      { oldLines: ["a"], newLines: ["A"] },
      { oldLines: ["c"], newLines: ["C"] },
    ]
    const result = Patch.deriveWithConfidence("test.ts", chunks, original)
    expect(result.confidence).toHaveLength(2)
    expect(result.confidence[0].hunkIndex).toBe(0)
    expect(result.confidence[1].hunkIndex).toBe(1)
  })

  test("throws on missing lines (same as derive)", () => {
    const original = "line one\nline two\n"
    const chunks: Patch.UpdateFileChunk[] = [
      { oldLines: ["not in file"], newLines: ["replacement"] },
    ]
    expect(() => Patch.deriveWithConfidence("test.ts", chunks, original)).toThrow("Failed to find expected lines")
  })
})
