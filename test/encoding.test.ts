import { describe, expect, test } from "bun:test"
import {
  normalizeLineEndings,
  detectLineEnding,
  convertToLineEnding,
  isDisproportionateMatch,
} from "../src/tool/edit"

// ─── normalizeLineEndings ───────────────────────────────────────────────────

describe("normalizeLineEndings", () => {
  test("converts CRLF to LF", () => {
    expect(normalizeLineEndings("hello\r\nworld")).toBe("hello\nworld")
  })

  test("leaves LF-only text unchanged", () => {
    expect(normalizeLineEndings("hello\nworld")).toBe("hello\nworld")
  })

  test("handles mixed line endings", () => {
    expect(normalizeLineEndings("a\r\nb\nc\r\n")).toBe("a\nb\nc\n")
  })

  test("handles empty string", () => {
    expect(normalizeLineEndings("")).toBe("")
  })
})

// ─── detectLineEnding ───────────────────────────────────────────────────────

describe("detectLineEnding", () => {
  test("detects CRLF", () => {
    expect(detectLineEnding("hello\r\nworld")).toBe("\r\n")
  })

  test("detects LF", () => {
    expect(detectLineEnding("hello\nworld")).toBe("\n")
  })

  test("defaults to LF for no line endings", () => {
    expect(detectLineEnding("no newlines")).toBe("\n")
  })
})

// ─── convertToLineEnding ────────────────────────────────────────────────────

describe("convertToLineEnding", () => {
  test("converts LF to CRLF", () => {
    expect(convertToLineEnding("a\nb\n", "\r\n")).toBe("a\r\nb\r\n")
  })

  test("returns text unchanged for LF target", () => {
    expect(convertToLineEnding("a\nb\n", "\n")).toBe("a\nb\n")
  })
})

// ─── isDisproportionateMatch ────────────────────────────────────────────────

describe("isDisproportionateMatch", () => {
  test("rejects when search has way more lines than oldString", () => {
    const search = "line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8"
    const oldString = "line1\nline2"
    expect(isDisproportionateMatch(search, oldString)).toBe(true)
  })

  test("accepts when search and oldString are similar size", () => {
    const search = "line1\nline2\nline3"
    const oldString = "line1\nline2\nline3"
    expect(isDisproportionateMatch(search, oldString)).toBe(false)
  })

  test("accepts single-line matches regardless of length", () => {
    const search = "const x = 1"
    const oldString = "const x = 1"
    expect(isDisproportionateMatch(search, oldString)).toBe(false)
  })
})
