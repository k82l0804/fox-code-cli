import { describe, expect, test } from "bun:test"
import * as path from "path"
import {
  Parameters,
  resolveRewritePath,
  computeRewriteDiffStats,
  prepareRewriteContent,
  buildRewriteOutput,
  buildRewritePermissionAsk,
} from "@/tool/rewrite_file"
import { Schema } from "effect"

describe("rewrite_file tool", () => {
  // -------------------------------------------------------------------------
  // Category 1: Path Resolution
  // -------------------------------------------------------------------------
  describe("Path Resolution (resolveRewritePath)", () => {
    test("keeps absolute path as-is", () => {
      const absPath = "/workspace/project/src/index.ts"
      const resolved = resolveRewritePath(absPath, "/workspace/project")
      expect(resolved).toBe(absPath)
    })

    test("resolves relative path against instance directory", () => {
      const relPath = "src/components/button.tsx"
      const directory = "/workspace/project"
      const resolved = resolveRewritePath(relPath, directory)
      expect(resolved).toBe(path.join(directory, relPath))
    })

    test("resolves current directory dot prefix", () => {
      const relPath = "./docs/readme.md"
      const directory = "/workspace/project"
      const resolved = resolveRewritePath(relPath, directory)
      expect(resolved).toBe(path.join(directory, relPath))
    })
  })

  // -------------------------------------------------------------------------
  // Category 2: Diff Stats Accuracy
  // -------------------------------------------------------------------------
  describe("Diff Stats Accuracy (computeRewriteDiffStats)", () => {
    test("calculates additions for brand new content (from empty)", () => {
      const oldContent = ""
      const newContent = "line 1\nline 2\nline 3"
      const stats = computeRewriteDiffStats(oldContent, newContent)
      expect(stats.linesAdded).toBe(3)
      expect(stats.linesRemoved).toBe(0)
    })

    test("calculates modifications as removals and additions", () => {
      const oldContent = "line 1\nline 2\nline 3\n"
      const newContent = "line 1\nline 2 modified\nline 3\nline 4\n"
      const stats = computeRewriteDiffStats(oldContent, newContent)
      expect(stats.linesAdded).toBe(2)
      expect(stats.linesRemoved).toBe(1)
    })

    test("calculates pure deletion when content is cleared", () => {
      const oldContent = "line 1\nline 2\nline 3"
      const newContent = ""
      const stats = computeRewriteDiffStats(oldContent, newContent)
      expect(stats.linesAdded).toBe(0)
      expect(stats.linesRemoved).toBe(3)
    })

    test("calculates 0 changes when content is identical", () => {
      const content = "const x = 1\nconst y = 2\n"
      const stats = computeRewriteDiffStats(content, content)
      expect(stats.linesAdded).toBe(0)
      expect(stats.linesRemoved).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // Category 3: BOM Preservation
  // -------------------------------------------------------------------------
  describe("BOM Handling (prepareRewriteContent)", () => {
    const BOM = "\uFEFF"

    test("preserves BOM if old file had BOM and new content does not", () => {
      const oldContent = `${BOM}line 1\nline 2`
      const newContent = "line 1 updated\nline 2"
      const prepared = prepareRewriteContent(oldContent, newContent)
      expect(prepared.desiredBom).toBe(true)
      expect(prepared.cleanNewContent).toBe("line 1 updated\nline 2")
      expect(prepared.fullContent.startsWith(BOM)).toBe(true)
      expect(prepared.fullContent).toBe(`${BOM}line 1 updated\nline 2`)
    })

    test("preserves BOM if new content explicitly has BOM", () => {
      const oldContent = "line 1\nline 2"
      const newContent = `${BOM}line 1 updated\nline 2`
      const prepared = prepareRewriteContent(oldContent, newContent)
      expect(prepared.desiredBom).toBe(true)
      expect(prepared.cleanNewContent).toBe("line 1 updated\nline 2")
      expect(prepared.fullContent.startsWith(BOM)).toBe(true)
    })

    test("does not add BOM if neither old nor new has BOM", () => {
      const oldContent = "line 1\nline 2"
      const newContent = "line 1 updated\nline 2"
      const prepared = prepareRewriteContent(oldContent, newContent)
      expect(prepared.desiredBom).toBe(false)
      expect(prepared.fullContent.startsWith(BOM)).toBe(false)
      expect(prepared.fullContent).toBe(newContent)
    })

    test("strips BOM from cleanNewContent for diff computation", () => {
      const oldContent = `${BOM}old line`
      const newContent = `${BOM}new line`
      const prepared = prepareRewriteContent(oldContent, newContent)
      expect(prepared.cleanOldContent).toBe("old line")
      expect(prepared.cleanNewContent).toBe("new line")
    })
  })

  // -------------------------------------------------------------------------
  // Category 4: Permission Check Construction
  // -------------------------------------------------------------------------
  describe("Permission Check (buildRewritePermissionAsk)", () => {
    test("constructs edit permission ask with relative pattern for worktree", () => {
      const worktree = "/workspace/project"
      const filepath = "/workspace/project/src/index.ts"
      const ask = buildRewritePermissionAsk(worktree, filepath, true)

      expect(ask.permission).toBe("edit")
      expect(ask.patterns).toEqual(["src/index.ts"])
      expect(ask.always).toEqual(["*"])
      expect(ask.metadata.diff).toBe(`rewrite_file: overwrite ${filepath}`)
    })

    test("constructs create message when file does not exist", () => {
      const worktree = "/workspace/project"
      const filepath = "/workspace/project/src/new-file.ts"
      const ask = buildRewritePermissionAsk(worktree, filepath, false)

      expect(ask.permission).toBe("edit")
      expect(ask.patterns).toEqual(["src/new-file.ts"])
      expect(ask.metadata.diff).toBe(`rewrite_file: create ${filepath}`)
    })
  })

  // -------------------------------------------------------------------------
  // Category 5: Output Formatting
  // -------------------------------------------------------------------------
  describe("Output Formatting (buildRewriteOutput)", () => {
    test("formats Created message with line count", () => {
      const output = buildRewriteOutput(false, "src/new.ts", {
        linesAdded: 10,
        linesRemoved: 0,
        lineCount: 10,
      })
      expect(output).toBe("Created src/new.ts (10 lines)")
    })

    test("formats Overwrote message with +/- stats", () => {
      const output = buildRewriteOutput(true, "src/old.ts", {
        linesAdded: 5,
        linesRemoved: 2,
        lineCount: 8,
      })
      expect(output).toBe("Overwrote src/old.ts (+5 lines, -2 lines)")
    })
  })

  // -------------------------------------------------------------------------
  // Category 6: Schema and Parameters Validation
  // -------------------------------------------------------------------------
  describe("Parameters Schema Validation", () => {
    test("validates required file_path and content", () => {
      const valid = { file_path: "/path/to/file.ts", content: "console.log('hello')" }
      const decoded = Schema.decodeUnknownSync(Parameters)(valid)
      expect(decoded.file_path).toBe("/path/to/file.ts")
      expect(decoded.content).toBe("console.log('hello')")
      expect(decoded.reason).toBeUndefined()
    })

    test("accepts optional reason parameter", () => {
      const validWithReason = {
        file_path: "/path/to/file.ts",
        content: "hello",
        reason: "Full rewrite for Tier D model safety",
      }
      const decoded = Schema.decodeUnknownSync(Parameters)(validWithReason)
      expect(decoded.reason).toBe("Full rewrite for Tier D model safety")
    })

    test("rejects missing file_path", () => {
      expect(() => Schema.decodeUnknownSync(Parameters)({ content: "hello" })).toThrow()
    })

    test("rejects missing content", () => {
      expect(() => Schema.decodeUnknownSync(Parameters)({ file_path: "/path/to/file.ts" })).toThrow()
    })
  })
})
