import { describe, expect, test } from "bun:test"
import { split, join } from "../src/util/bom"

const BOM = "\uFEFF"

describe("BOM split", () => {
  test("detects BOM and strips it", () => {
    const result = split(BOM + "hello")
    expect(result.bom).toBe(true)
    expect(result.text).toBe("hello")
  })

  test("returns false for text without BOM", () => {
    const result = split("hello")
    expect(result.bom).toBe(false)
    expect(result.text).toBe("hello")
  })

  test("handles empty string", () => {
    const result = split("")
    expect(result.bom).toBe(false)
    expect(result.text).toBe("")
  })

  test("handles BOM-only string", () => {
    const result = split(BOM)
    expect(result.bom).toBe(true)
    expect(result.text).toBe("")
  })
})

describe("BOM join", () => {
  test("adds BOM when requested", () => {
    const result = join("hello", true)
    expect(result.charCodeAt(0)).toBe(0xfeff)
    expect(result.slice(1)).toBe("hello")
  })

  test("does not add BOM when not requested", () => {
    const result = join("hello", false)
    expect(result).toBe("hello")
  })

  test("strips existing BOM before re-joining without BOM", () => {
    const result = join(BOM + "hello", false)
    expect(result).toBe("hello")
  })

  test("does not double-BOM", () => {
    const result = join(BOM + "hello", true)
    expect(result).toBe(BOM + "hello")
    // Ensure only one BOM
    expect(result.charCodeAt(0)).toBe(0xfeff)
    expect(result.charCodeAt(1)).not.toBe(0xfeff)
  })
})
