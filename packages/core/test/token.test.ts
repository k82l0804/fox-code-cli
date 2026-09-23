import { describe, expect, test } from "bun:test"
import { Token } from "../src/util/token"

describe("Token utility & JSON bypass", () => {
  test("estimate computes token count from string length", () => {
    expect(Token.estimate("")).toBe(0)
    expect(Token.estimate("1234")).toBe(1)
    expect(Token.estimate("12345678")).toBe(2)
  })

  test("estimateObject handles both strings and complex objects", () => {
    expect(Token.estimateObject("hello world")).toBe(Token.estimate("hello world"))
    const obj = { role: "user", text: "hello world" }
    expect(Token.estimateObject(obj)).toBe(Token.estimate(JSON.stringify(obj)))
  })

  test("estimateMessage caches token estimates for objects", () => {
    const msg = {
      role: "assistant",
      content: [{ type: "text", text: "Some generated response from LLM" }],
    }
    const first = Token.estimateMessage(msg)
    const expected = Token.estimate(JSON.stringify(msg))
    expect(first).toBe(expected)

    // Second call should return cached value
    const second = Token.estimateMessage(msg)
    expect(second).toBe(first)
  })

  test("estimateMessage handles string messages", () => {
    const str = "hello user message"
    expect(Token.estimateMessage(str)).toBe(Token.estimate(str))
  })
})
