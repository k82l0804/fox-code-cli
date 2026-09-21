import { describe, expect, test } from "bun:test"
import { deepEqual, isDoomLoop, DOOM_LOOP_THRESHOLD } from "@/session/processor"
import type { SessionV1 } from "@opencode-ai/core/v1/session"

describe("deepEqual", () => {
  test("compares primitives correctly", () => {
    expect(deepEqual(1, 1)).toBe(true)
    expect(deepEqual(1, 2)).toBe(false)
    expect(deepEqual("foo", "foo")).toBe(true)
    expect(deepEqual("foo", "bar")).toBe(false)
    expect(deepEqual(true, true)).toBe(true)
    expect(deepEqual(true, false)).toBe(false)
    expect(deepEqual(null, null)).toBe(true)
    expect(deepEqual(undefined, undefined)).toBe(true)
    expect(deepEqual(null, undefined)).toBe(false)
  })

  test("compares arrays with deep elements", () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true)
    expect(deepEqual([1, [2, 3]], [1, [2, 3]])).toBe(true)
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false)
    expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false)
    expect(deepEqual([], [])).toBe(true)
  })

  test("compares objects irrespective of key order", () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    expect(deepEqual({ x: { y: "z", w: 10 } }, { x: { w: 10, y: "z" } })).toBe(true)
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
  })
})

describe("isDoomLoop", () => {
  function makeToolPart(tool: string, input: unknown, status: "completed" | "error" | "pending" = "completed"): SessionV1.ToolPart {
    return {
      id: "part-" + Math.random().toString(36).slice(2),
      type: "tool",
      tool,
      callID: "call-" + Math.random().toString(36).slice(2),
      state: {
        status,
        input,
        output: "some output",
        time: { start: 1, end: 2 },
      } as any,
    }
  }

  test("returns false when parts count is less than threshold", () => {
    const parts = [
      makeToolPart("read", { path: "foo.ts" }),
      makeToolPart("read", { path: "foo.ts" }),
    ]
    expect(isDoomLoop(parts, "read", { path: "foo.ts" })).toBe(false)
  })

  test("returns false when recent tool is different", () => {
    const parts = [
      makeToolPart("read", { path: "foo.ts" }),
      makeToolPart("write", { path: "foo.ts" }),
      makeToolPart("read", { path: "foo.ts" }),
    ]
    expect(isDoomLoop(parts, "read", { path: "foo.ts" })).toBe(false)
  })

  test("returns false when inputs differ", () => {
    const parts = [
      makeToolPart("read", { path: "foo.ts" }),
      makeToolPart("read", { path: "bar.ts" }),
      makeToolPart("read", { path: "foo.ts" }),
    ]
    expect(isDoomLoop(parts, "read", { path: "foo.ts" })).toBe(false)
  })

  test("returns false if any recent tool call is pending", () => {
    const parts = [
      makeToolPart("read", { path: "foo.ts" }),
      makeToolPart("read", { path: "foo.ts" }),
      makeToolPart("read", { path: "foo.ts" }, "pending"),
    ]
    expect(isDoomLoop(parts, "read", { path: "foo.ts" })).toBe(false)
  })

  test("returns true when exactly matching repeated tool calls reach threshold", () => {
    const parts = [
      makeToolPart("bash", { command: "npm test" }),
      makeToolPart("bash", { command: "npm test" }),
      makeToolPart("bash", { command: "npm test" }),
    ]
    expect(isDoomLoop(parts, "bash", { command: "npm test" })).toBe(true)
  })

  test("returns true even with different object key ordering in input", () => {
    const parts = [
      makeToolPart("edit", { path: "a.ts", oldText: "foo", newText: "bar" }),
      makeToolPart("edit", { newText: "bar", path: "a.ts", oldText: "foo" }),
      makeToolPart("edit", { oldText: "foo", newText: "bar", path: "a.ts" }),
    ]
    expect(
      isDoomLoop(parts, "edit", { path: "a.ts", oldText: "foo", newText: "bar" }),
    ).toBe(true)
  })
})
