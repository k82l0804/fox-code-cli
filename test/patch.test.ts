import { describe, expect, test } from "bun:test"
import {
  parsePatch,
  deriveNewContentsFromChunks,
  maybeParseApplyPatch,
  MaybeApplyPatch,
  type Hunk,
  type UpdateFileChunk,
} from "../src/patch"

// ─── parsePatch ─────────────────────────────────────────────────────────────

describe("parsePatch", () => {
  test("parses a simple Add File hunk", () => {
    const patch = `*** Begin Patch
*** Add File: src/hello.ts
+export const hello = "world"
*** End Patch`
    const { hunks } = parsePatch(patch)
    expect(hunks).toHaveLength(1)
    expect(hunks[0].type).toBe("add")
    if (hunks[0].type === "add") {
      expect(hunks[0].path).toBe("src/hello.ts")
      expect(hunks[0].contents).toBe('export const hello = "world"')
    }
  })

  test("parses a multi-line Add File hunk", () => {
    const patch = `*** Begin Patch
*** Add File: src/multi.ts
+line one
+line two
+line three
*** End Patch`
    const { hunks } = parsePatch(patch)
    expect(hunks).toHaveLength(1)
    if (hunks[0].type === "add") {
      expect(hunks[0].contents).toBe("line one\nline two\nline three")
    }
  })

  test("parses a Delete File hunk", () => {
    const patch = `*** Begin Patch
*** Delete File: old/file.ts
*** End Patch`
    const { hunks } = parsePatch(patch)
    expect(hunks).toHaveLength(1)
    expect(hunks[0].type).toBe("delete")
    expect(hunks[0].path).toBe("old/file.ts")
  })

  test("parses an Update File hunk with context", () => {
    const patch = `*** Begin Patch
*** Update File: src/foo.ts
@@ function bar()
-  return 1
+  return 2
*** End Patch`
    const { hunks } = parsePatch(patch)
    expect(hunks).toHaveLength(1)
    expect(hunks[0].type).toBe("update")
    if (hunks[0].type === "update") {
      expect(hunks[0].path).toBe("src/foo.ts")
      expect(hunks[0].chunks).toHaveLength(1)
      expect(hunks[0].chunks[0].old_lines).toEqual(["  return 1"])
      expect(hunks[0].chunks[0].new_lines).toEqual(["  return 2"])
      expect(hunks[0].chunks[0].change_context).toBe("function bar()")
    }
  })

  test("parses an Update File with keep lines", () => {
    const patch = `*** Begin Patch
*** Update File: src/foo.ts
@@
 const a = 1
-const b = 2
+const b = 3
 const c = 4
*** End Patch`
    const { hunks } = parsePatch(patch)
    if (hunks[0].type === "update") {
      const chunk = hunks[0].chunks[0]
      expect(chunk.old_lines).toEqual(["const a = 1", "const b = 2", "const c = 4"])
      expect(chunk.new_lines).toEqual(["const a = 1", "const b = 3", "const c = 4"])
    }
  })

  test("parses Move directive", () => {
    const patch = `*** Begin Patch
*** Update File: old/path.ts
*** Move to: new/path.ts
@@
-old content
+new content
*** End Patch`
    const { hunks } = parsePatch(patch)
    expect(hunks[0].type).toBe("update")
    if (hunks[0].type === "update") {
      expect(hunks[0].path).toBe("old/path.ts")
      expect(hunks[0].move_path).toBe("new/path.ts")
    }
  })

  test("parses multiple hunks in one patch", () => {
    const patch = `*** Begin Patch
*** Add File: new.ts
+hello
*** Delete File: old.ts
*** Update File: keep.ts
@@
-old
+new
*** End Patch`
    const { hunks } = parsePatch(patch)
    expect(hunks).toHaveLength(3)
    expect(hunks[0].type).toBe("add")
    expect(hunks[1].type).toBe("delete")
    expect(hunks[2].type).toBe("update")
  })

  test("throws on missing Begin marker", () => {
    expect(() => parsePatch("*** End Patch")).toThrow("missing Begin/End markers")
  })

  test("throws on missing End marker", () => {
    expect(() => parsePatch("*** Begin Patch\n*** Add File: foo.ts")).toThrow("missing Begin/End markers")
  })

  test("handles *** End of File as a chunk boundary (treated as *** prefix)", () => {
    // Note: the parser's inner while loop exits on any "***" prefix,
    // so "*** End of File" terminates the chunk but does NOT set is_end_of_file.
    // This documents actual behavior.
    const patch = `*** Begin Patch
*** Update File: src/foo.ts
@@
-old last line
+new last line
*** End of File
*** End Patch`
    const { hunks } = parsePatch(patch)
    expect(hunks).toHaveLength(1)
    if (hunks[0].type === "update") {
      expect(hunks[0].chunks).toHaveLength(1)
      expect(hunks[0].chunks[0].old_lines).toEqual(["old last line"])
      expect(hunks[0].chunks[0].new_lines).toEqual(["new last line"])
    }
  })

  test("strips heredoc wrapper before parsing", () => {
    const patch = `cat <<'EOF'
*** Begin Patch
*** Add File: test.ts
+content
*** End Patch
EOF`
    const { hunks } = parsePatch(patch)
    expect(hunks).toHaveLength(1)
    expect(hunks[0].type).toBe("add")
  })

  test("handles multiple chunks in a single update", () => {
    const patch = `*** Begin Patch
*** Update File: src/foo.ts
@@ function first
-old1
+new1
@@ function second
-old2
+new2
*** End Patch`
    const { hunks } = parsePatch(patch)
    if (hunks[0].type === "update") {
      expect(hunks[0].chunks).toHaveLength(2)
      expect(hunks[0].chunks[0].change_context).toBe("function first")
      expect(hunks[0].chunks[1].change_context).toBe("function second")
    }
  })

  test("handles empty add file content", () => {
    const patch = `*** Begin Patch
*** Add File: empty.ts
*** End Patch`
    const { hunks } = parsePatch(patch)
    expect(hunks[0].type).toBe("add")
    if (hunks[0].type === "add") {
      expect(hunks[0].contents).toBe("")
    }
  })
})

// ─── deriveNewContentsFromChunks ────────────────────────────────────────────

describe("deriveNewContentsFromChunks", () => {
  test("replaces a single line", () => {
    const original = "line one\nline two\nline three\n"
    const chunks: UpdateFileChunk[] = [
      { old_lines: ["line two"], new_lines: ["line TWO"] },
    ]
    const result = deriveNewContentsFromChunks("test.ts", chunks, original)
    expect(result.content).toContain("line TWO")
    expect(result.content).not.toContain("line two")
  })

  test("handles multi-line replacement", () => {
    const original = "a\nb\nc\nd\n"
    const chunks: UpdateFileChunk[] = [
      { old_lines: ["b", "c"], new_lines: ["B", "C", "C2"] },
    ]
    const result = deriveNewContentsFromChunks("test.ts", chunks, original)
    const lines = result.content.split("\n")
    expect(lines).toContain("B")
    expect(lines).toContain("C")
    expect(lines).toContain("C2")
  })

  test("handles pure addition (empty old_lines)", () => {
    const original = "existing\n"
    const chunks: UpdateFileChunk[] = [
      { old_lines: [], new_lines: ["added line"] },
    ]
    const result = deriveNewContentsFromChunks("test.ts", chunks, original)
    expect(result.content).toContain("added line")
    expect(result.content).toContain("existing")
  })

  test("context-based seeking finds the right location", () => {
    const original = "function foo() {\n  return 1\n}\nfunction bar() {\n  return 2\n}\n"
    const chunks: UpdateFileChunk[] = [
      {
        old_lines: ["  return 2"],
        new_lines: ["  return 42"],
        change_context: "function bar() {",
      },
    ]
    const result = deriveNewContentsFromChunks("test.ts", chunks, original)
    expect(result.content).toContain("return 42")
    expect(result.content).toContain("return 1") // foo's return unchanged
  })

  test("throws when context is not found", () => {
    const original = "line one\nline two\n"
    const chunks: UpdateFileChunk[] = [
      {
        old_lines: ["line two"],
        new_lines: ["line TWO"],
        change_context: "nonexistent context",
      },
    ]
    expect(() => deriveNewContentsFromChunks("test.ts", chunks, original)).toThrow("Failed to find context")
  })

  test("throws when old lines are not found", () => {
    const original = "line one\nline two\n"
    const chunks: UpdateFileChunk[] = [
      { old_lines: ["not in file"], new_lines: ["replacement"] },
    ]
    expect(() => deriveNewContentsFromChunks("test.ts", chunks, original)).toThrow("Failed to find expected lines")
  })

  test("handles deletion (empty new_lines)", () => {
    const original = "keep\nremove\nalso keep\n"
    const chunks: UpdateFileChunk[] = [
      { old_lines: ["remove"], new_lines: [] },
    ]
    const result = deriveNewContentsFromChunks("test.ts", chunks, original)
    expect(result.content).not.toContain("remove")
    expect(result.content).toContain("keep")
    expect(result.content).toContain("also keep")
  })

  test("preserves BOM flag", () => {
    const bom = "\uFEFF"
    const original = bom + "content\n"
    const chunks: UpdateFileChunk[] = [
      { old_lines: ["content"], new_lines: ["updated"] },
    ]
    const result = deriveNewContentsFromChunks("test.ts", chunks, original)
    expect(result.bom).toBe(true)
  })

  test("generates unified diff", () => {
    const original = "old line\n"
    const chunks: UpdateFileChunk[] = [
      { old_lines: ["old line"], new_lines: ["new line"] },
    ]
    const result = deriveNewContentsFromChunks("test.ts", chunks, original)
    expect(result.unified_diff).toContain("-old line")
    expect(result.unified_diff).toContain("+new line")
  })

  test("matches with trailing whitespace differences", () => {
    const original = "line one  \nline two\n"
    const chunks: UpdateFileChunk[] = [
      { old_lines: ["line one"], new_lines: ["line ONE"] },
    ]
    // seekSequence uses rstrip fallback
    const result = deriveNewContentsFromChunks("test.ts", chunks, original)
    expect(result.content).toContain("line ONE")
  })
})

// ─── maybeParseApplyPatch ───────────────────────────────────────────────────

describe("maybeParseApplyPatch", () => {
  test("recognizes direct apply_patch invocation", () => {
    const patch = `*** Begin Patch
*** Add File: test.ts
+hello
*** End Patch`
    const result = maybeParseApplyPatch(["apply_patch", patch])
    expect(result.type).toBe(MaybeApplyPatch.Body)
    if (result.type === MaybeApplyPatch.Body) {
      expect(result.args.hunks).toHaveLength(1)
    }
  })

  test("recognizes applypatch alias", () => {
    const patch = `*** Begin Patch
*** Add File: test.ts
+hello
*** End Patch`
    const result = maybeParseApplyPatch(["applypatch", patch])
    expect(result.type).toBe(MaybeApplyPatch.Body)
  })

  test("returns NotApplyPatch for unrelated commands", () => {
    const result = maybeParseApplyPatch(["ls", "-la"])
    expect(result.type).toBe(MaybeApplyPatch.NotApplyPatch)
  })

  test("returns PatchParseError for malformed patches", () => {
    const result = maybeParseApplyPatch(["apply_patch", "not a valid patch"])
    expect(result.type).toBe(MaybeApplyPatch.PatchParseError)
  })

  test("parses bash heredoc form", () => {
    const script = `apply_patch <<'EOF'
*** Begin Patch
*** Add File: test.ts
+hello
*** End Patch
EOF`
    const result = maybeParseApplyPatch(["bash", "-lc", script])
    expect(result.type).toBe(MaybeApplyPatch.Body)
  })

  test("returns NotApplyPatch for empty args", () => {
    const result = maybeParseApplyPatch([])
    expect(result.type).toBe(MaybeApplyPatch.NotApplyPatch)
  })

  test("returns NotApplyPatch for single non-patch arg", () => {
    const result = maybeParseApplyPatch(["apply_patch"])
    expect(result.type).toBe(MaybeApplyPatch.NotApplyPatch)
  })
})
