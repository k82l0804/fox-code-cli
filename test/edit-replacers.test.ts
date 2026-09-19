import { describe, expect, test } from "bun:test"
import {
  replace,
  trimDiff,
  buildFileDiff,
  SimpleReplacer,
  LineTrimmedReplacer,
  BlockAnchorReplacer,
  WhitespaceNormalizedReplacer,
  IndentationFlexibleReplacer,
  EscapeNormalizedReplacer,
  MultiOccurrenceReplacer,
  TrimmedBoundaryReplacer,
  ContextAwareReplacer,
  type Replacer,
} from "../src/tool/edit"

/** Collect all yields from a replacer generator. */
function collect(replacer: Replacer, content: string, find: string): string[] {
  return [...replacer(content, find)]
}

// ─── SimpleReplacer ─────────────────────────────────────────────────────────

describe("SimpleReplacer", () => {
  test("yields the exact find string", () => {
    expect(collect(SimpleReplacer, "anything", "hello")).toEqual(["hello"])
  })
})

// ─── LineTrimmedReplacer ────────────────────────────────────────────────────

describe("LineTrimmedReplacer", () => {
  test("matches lines with extra leading/trailing whitespace", () => {
    const content = "  function foo()  \n    return 1\n  }"
    const find = "function foo()\n  return 1\n}"
    const results = collect(LineTrimmedReplacer, content, find)
    expect(results).toHaveLength(1)
    // Should yield the actual content from the file, not the find string
    expect(results[0]).toContain("  function foo()  ")
  })

  test("returns nothing when no trimmed match exists", () => {
    const content = "completely different content"
    const find = "nothing matching"
    expect(collect(LineTrimmedReplacer, content, find)).toHaveLength(0)
  })

  test("strips trailing empty line from search", () => {
    const content = "hello world"
    const find = "hello world\n"
    const results = collect(LineTrimmedReplacer, content, find)
    expect(results).toHaveLength(1)
  })
})

// ─── BlockAnchorReplacer ────────────────────────────────────────────────────

describe("BlockAnchorReplacer", () => {
  test("matches block by first and last line anchors", () => {
    const content = "function foo() {\n  const a = 1\n  return a\n}"
    const find = "function foo() {\n  const a = 1\n  return a\n}"
    const results = collect(BlockAnchorReplacer, content, find)
    expect(results).toHaveLength(1)
  })

  test("requires at least 3 lines", () => {
    const content = "line one\nline two"
    const find = "line one\nline two"
    expect(collect(BlockAnchorReplacer, content, find)).toHaveLength(0)
  })

  test("tolerates minor differences in middle lines", () => {
    const content = "function foo() {\n  const a = 1\n  const b = 2\n  return a + b\n}"
    // Middle lines slightly different (extra space)
    const find = "function foo() {\n  const a =  1\n  const b =  2\n  return a + b\n}"
    const results = collect(BlockAnchorReplacer, content, find)
    expect(results).toHaveLength(1)
  })

  test("returns nothing when anchors don't match", () => {
    const content = "AAA\nBBB\nCCC"
    const find = "XXX\nBBB\nYYY"
    expect(collect(BlockAnchorReplacer, content, find)).toHaveLength(0)
  })
})

// ─── WhitespaceNormalizedReplacer ───────────────────────────────────────────

describe("WhitespaceNormalizedReplacer", () => {
  test("matches single line with different whitespace", () => {
    const content = "const   a   =   1"
    const find = "const a = 1"
    const results = collect(WhitespaceNormalizedReplacer, content, find)
    expect(results.length).toBeGreaterThan(0)
  })

  test("matches multi-line with collapsed whitespace", () => {
    const content = "if  (true)\n  do  something"
    const find = "if (true)\ndo something"
    const results = collect(WhitespaceNormalizedReplacer, content, find)
    expect(results.length).toBeGreaterThan(0)
  })

  test("returns nothing when content differs beyond whitespace", () => {
    const content = "hello world"
    const find = "goodbye world"
    expect(collect(WhitespaceNormalizedReplacer, content, find)).toHaveLength(0)
  })
})

// ─── IndentationFlexibleReplacer ────────────────────────────────────────────

describe("IndentationFlexibleReplacer", () => {
  test("matches blocks with different indentation levels", () => {
    const content = "    if (true) {\n        return 1\n    }"
    const find = "if (true) {\n    return 1\n}"
    const results = collect(IndentationFlexibleReplacer, content, find)
    expect(results).toHaveLength(1)
    // Should yield the original indented content
    expect(results[0]).toContain("    if (true) {")
  })

  test("returns nothing when structure differs", () => {
    const content = "if (false) {\n  return 2\n}"
    const find = "if (true) {\n  return 1\n}"
    expect(collect(IndentationFlexibleReplacer, content, find)).toHaveLength(0)
  })
})

// ─── EscapeNormalizedReplacer ───────────────────────────────────────────────

describe("EscapeNormalizedReplacer", () => {
  test("matches content when find has escape sequences", () => {
    // Content has a literal tab character, find uses \\t escape sequence
    const content = "line with\ttab"
    const find = "line with\\ttab"
    const results = collect(EscapeNormalizedReplacer, content, find)
    expect(results.length).toBeGreaterThan(0)
  })

  test("matches escaped quotes in find against literal quotes in content", () => {
    const content = `const s = "hello"`
    const find = `const s = \\"hello\\"`
    const results = collect(EscapeNormalizedReplacer, content, find)
    expect(results.length).toBeGreaterThan(0)
  })
})

// ─── MultiOccurrenceReplacer ────────────────────────────────────────────────

describe("MultiOccurrenceReplacer", () => {
  test("yields all occurrences of exact match", () => {
    const content = "foo bar foo baz foo"
    const find = "foo"
    const results = collect(MultiOccurrenceReplacer, content, find)
    expect(results).toHaveLength(3)
  })

  test("yields nothing when no match", () => {
    expect(collect(MultiOccurrenceReplacer, "abc", "xyz")).toHaveLength(0)
  })
})

// ─── TrimmedBoundaryReplacer ────────────────────────────────────────────────

describe("TrimmedBoundaryReplacer", () => {
  test("matches when find has extra leading/trailing whitespace", () => {
    const content = "const x = 1"
    const find = "  const x = 1  "
    const results = collect(TrimmedBoundaryReplacer, content, find)
    expect(results.length).toBeGreaterThan(0)
  })

  test("skips when find is already trimmed", () => {
    const content = "const x = 1"
    const find = "const x = 1"
    expect(collect(TrimmedBoundaryReplacer, content, find)).toHaveLength(0)
  })
})

// ─── ContextAwareReplacer ───────────────────────────────────────────────────

describe("ContextAwareReplacer", () => {
  test("matches block by context anchors with same line count", () => {
    const content = "function foo() {\n  const a = 1\n  return a\n}"
    const find = "function foo() {\n  const a = 1\n  return a\n}"
    const results = collect(ContextAwareReplacer, content, find)
    expect(results).toHaveLength(1)
  })

  test("requires at least 3 lines", () => {
    const content = "line one\nline two"
    const find = "line one\nline two"
    expect(collect(ContextAwareReplacer, content, find)).toHaveLength(0)
  })
})

// ─── replace() orchestrator ─────────────────────────────────────────────────

describe("replace", () => {
  test("replaces exact match", () => {
    expect(replace("hello world", "hello", "goodbye")).toBe("goodbye world")
  })

  test("replaces with whitespace tolerance", () => {
    const content = "  const x  =  1  "
    const result = replace(content, "const x = 1", "const x = 2")
    expect(result).toContain("const x = 2")
  })

  test("throws on identical oldString and newString", () => {
    expect(() => replace("content", "same", "same")).toThrow("identical")
  })

  test("throws on empty oldString", () => {
    expect(() => replace("content", "", "new")).toThrow("oldString cannot be empty")
  })

  test("throws when oldString is not found", () => {
    expect(() => replace("hello", "missing", "new")).toThrow("Could not find oldString")
  })

  test("throws when multiple matches exist (non-replaceAll)", () => {
    expect(() => replace("foo foo", "foo", "bar")).toThrow("multiple matches")
  })

  test("replaceAll replaces all occurrences", () => {
    expect(replace("foo bar foo", "foo", "baz", true)).toBe("baz bar baz")
  })

  test("handles multi-line replacements", () => {
    const content = "line 1\nline 2\nline 3"
    const result = replace(content, "line 2", "LINE TWO")
    expect(result).toBe("line 1\nLINE TWO\nline 3")
  })

  test("handles line-trimmed fallback for indented code", () => {
    const content = "    if (true) {\n      return 1\n    }"
    const result = replace(content, "if (true) {\n  return 1\n}", "if (false) {\n  return 0\n}")
    expect(result).toContain("if (false)")
  })
})

// ─── trimDiff ───────────────────────────────────────────────────────────────

describe("trimDiff", () => {
  test("trims common leading whitespace from diff lines", () => {
    const diff = "--- a/file\n+++ b/file\n     +    added line\n     -    removed line"
    const trimmed = trimDiff(diff)
    expect(trimmed).toContain("+")
    expect(trimmed).toContain("-")
  })

  test("leaves already-trimmed diffs unchanged", () => {
    const diff = "+no indent\n-no indent"
    expect(trimDiff(diff)).toBe(diff)
  })

  test("returns empty diff unchanged", () => {
    expect(trimDiff("")).toBe("")
  })
})

// ─── buildFileDiff ──────────────────────────────────────────────────────────

describe("buildFileDiff", () => {
  test("counts additions and deletions", () => {
    const result = buildFileDiff("test.ts", "old line\n", "new line\n")
    expect(result.additions).toBeGreaterThan(0)
    expect(result.deletions).toBeGreaterThan(0)
    expect(result.file).toBe("test.ts")
  })

  test("reports zero changes for identical content", () => {
    const result = buildFileDiff("test.ts", "same\n", "same\n")
    expect(result.additions).toBe(0)
    expect(result.deletions).toBe(0)
  })

  test("generates a unified patch string", () => {
    const result = buildFileDiff("test.ts", "old\n", "new\n")
    expect(result.patch).toContain("-old")
    expect(result.patch).toContain("+new")
  })
})
