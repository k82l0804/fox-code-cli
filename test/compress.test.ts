/**
 * Unit tests for the ToolOutputCompressor pipeline (compress.ts)
 *
 * Tests each transform independently and the full pipeline.
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import {
  relativizePaths,
  compressTabular,
  deduplicateLogLines,
  compressJsonKeys,
  process,
  type CompressContext,
} from "@opencode-ai/core/tool/compress"

const ctx: CompressContext = {
  workspaceRoot: "/home/user/project",
  toolName: "test",
}

describe("ToolOutputCompressor", () => {
  describe("relativizePaths", () => {
    test("replaces workspace root with relative path and adds CWD header", () => {
      const input = "File: /home/user/project/src/index.ts\nContent at /home/user/project/src/utils.ts"
      const result = relativizePaths(input, ctx)
      expect(result).toBe("[CWD: /home/user/project]\nFile: src/index.ts\nContent at src/utils.ts")
    })

    test("returns unchanged text when workspace root not found", () => {
      const input = "No paths here"
      const result = relativizePaths(input, ctx)
      expect(result).toBe("No paths here")
    })

    test("handles trailing slash in workspace root", () => {
      const input = "File: /home/user/project/src/index.ts"
      const result = relativizePaths(input, { ...ctx, workspaceRoot: "/home/user/project/" })
      expect(result).toBe("[CWD: /home/user/project/]\nFile: src/index.ts")
    })

    test("returns unchanged when workspaceRoot is empty", () => {
      const input = "some text"
      const result = relativizePaths(input, { ...ctx, workspaceRoot: "" })
      expect(result).toBe("some text")
    })
  })

  describe("compressTabular", () => {
    test("converts JSON arrays with repeated keys to columnar format", () => {
      const input = JSON.stringify([
        { name: "foo", size: 100 },
        { name: "bar", size: 200 },
        { name: "baz", size: 300 },
      ])
      const result = compressTabular(input, ctx)
      expect(result).toBe("Columns: name | size\nfoo | 100\nbar | 200\nbaz | 300")
    })

    test("returns unchanged text when not a JSON array", () => {
      const input = '{"key": "value"}'
      const result = compressTabular(input, ctx)
      expect(result).toBe(input)
    })

    test("returns unchanged text when array has fewer than 3 items", () => {
      const input = JSON.stringify([{ a: 1 }, { a: 2 }])
      const result = compressTabular(input, ctx)
      expect(result).toBe(input)
    })

    test("returns unchanged text when objects have different key sets", () => {
      const input = JSON.stringify([{ a: 1 }, { b: 2 }, { a: 3 }])
      const result = compressTabular(input, ctx)
      expect(result).toBe(input)
    })

    test("returns unchanged for non-JSON text", () => {
      const input = "Just some regular text"
      const result = compressTabular(input, ctx)
      expect(result).toBe(input)
    })
  })

  describe("deduplicateLogLines", () => {
    test("collapses 3+ consecutive identical lines", () => {
      const lines = ["ok", "ok", "ok", "ok", "done"]
      const input = lines.join("\n")
      const result = deduplicateLogLines(input, ctx)
      expect(result).toBe("[×4] ok\ndone")
    })

    test("keeps 2 consecutive identical lines unchanged", () => {
      const lines = ["first", "ok", "ok", "last", "x", "y"]
      const input = lines.join("\n")
      const result = deduplicateLogLines(input, ctx)
      expect(result).toBe(input)
    })

    test("returns unchanged for short inputs (< 5 lines)", () => {
      const input = "a\nb\nc"
      const result = deduplicateLogLines(input, ctx)
      expect(result).toBe(input)
    })

    test("handles multiple runs of duplicates", () => {
      const lines = ["a", "a", "a", "b", "b", "b", "c"]
      const input = lines.join("\n")
      const result = deduplicateLogLines(input, ctx)
      expect(result).toBe("[×3] a\n[×3] b\nc")
    })
  })

  describe("compressJsonKeys", () => {
    test("creates legend and abbreviates keys for large JSON arrays", () => {
      const input = JSON.stringify([
        { sourceFileName: "a.ts", lineCountTotal: 10, programmingLanguage: "typescript", compilationStatus: "ok" },
        { sourceFileName: "b.ts", lineCountTotal: 20, programmingLanguage: "typescript", compilationStatus: "ok" },
        { sourceFileName: "c.ts", lineCountTotal: 30, programmingLanguage: "javascript", compilationStatus: "ok" },
        { sourceFileName: "d.ts", lineCountTotal: 40, programmingLanguage: "python", compilationStatus: "err" },
      ])
      const result = compressJsonKeys(input, ctx)
      expect(result).toContain("[legend:")
      expect(result).toContain("a=sourceFileName")
      expect(result).toContain("b=lineCountTotal")
      expect(result).toContain("c=programmingLanguage")
      expect(result).toContain("d=compilationStatus")
    })

    test("returns unchanged when total key chars are too small", () => {
      const input = JSON.stringify([{ a: 1 }, { a: 2 }, { a: 3 }])
      const result = compressJsonKeys(input, ctx)
      expect(result).toBe(input)
    })

    test("returns unchanged for non-JSON text", () => {
      const input = "not json"
      const result = compressJsonKeys(input, ctx)
      expect(result).toBe(input)
    })
  })

  describe("process (full pipeline)", () => {
    // The process function respects feature flags, which default to off
    // in test environments (no FOX_EXPERIMENTAL set). These tests verify
    // that the pipeline passes through unchanged when flags are off.

    test("returns text unchanged when all flags are disabled", () => {
      const input = "File: /home/user/project/src/index.ts"
      const result = process(input, ctx)
      expect(result).toBe(input)
    })
  })
})
