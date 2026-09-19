import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { Tool } from "../src/tool/tool"

// ─── validateName ───────────────────────────────────────────────────────────

describe("Tool.validateName", () => {
  test("accepts valid tool names", async () => {
    await Effect.runPromise(Tool.validateName("my_tool"))
    await Effect.runPromise(Tool.validateName("MyTool"))
    await Effect.runPromise(Tool.validateName("tool-name"))
    await Effect.runPromise(Tool.validateName("a"))
    await Effect.runPromise(Tool.validateName("Tool123"))
  })

  test("rejects empty name", async () => {
    const result = await Effect.runPromise(Tool.validateName("").pipe(Effect.flip))
    expect(result._tag).toBe("Tool.RegistrationError")
  })

  test("rejects name starting with digit", async () => {
    const result = await Effect.runPromise(Tool.validateName("1tool").pipe(Effect.flip))
    expect(result._tag).toBe("Tool.RegistrationError")
  })

  test("rejects name with special characters", async () => {
    const result = await Effect.runPromise(Tool.validateName("tool.name").pipe(Effect.flip))
    expect(result._tag).toBe("Tool.RegistrationError")
  })

  test("rejects name longer than 64 characters", async () => {
    const longName = "a" + "b".repeat(64) // 65 chars
    const result = await Effect.runPromise(Tool.validateName(longName).pipe(Effect.flip))
    expect(result._tag).toBe("Tool.RegistrationError")
  })

  test("accepts name exactly 64 characters", async () => {
    const name = "a" + "b".repeat(63) // 64 chars
    await Effect.runPromise(Tool.validateName(name))
  })

  test("rejects name starting with underscore", async () => {
    const result = await Effect.runPromise(Tool.validateName("_tool").pipe(Effect.flip))
    expect(result._tag).toBe("Tool.RegistrationError")
  })

  test("rejects name starting with hyphen", async () => {
    const result = await Effect.runPromise(Tool.validateName("-tool").pipe(Effect.flip))
    expect(result._tag).toBe("Tool.RegistrationError")
  })

  test("rejects name with spaces", async () => {
    const result = await Effect.runPromise(Tool.validateName("my tool").pipe(Effect.flip))
    expect(result._tag).toBe("Tool.RegistrationError")
  })
})

// ─── Tool.make ──────────────────────────────────────────────────────────────

describe("Tool.make", () => {
  const TestInput = Schema.Struct({
    message: Schema.String,
  })

  const TestOutput = Schema.String

  const testTool = Tool.make({
    description: "A test tool",
    input: TestInput,
    output: TestOutput,
    execute: (input) => Effect.succeed(`echo: ${input.message}`),
  })

  test("creates a tool definition with correct schema", () => {
    const def = Tool.definition("test_tool", testTool)
    expect(def.name).toBe("test_tool")
    expect(def.description).toBe("A test tool")
    expect(def.inputSchema).toBeDefined()
  })

  test("caches definitions by name", () => {
    const def1 = Tool.definition("cached_tool", testTool)
    const def2 = Tool.definition("cached_tool", testTool)
    expect(def1).toBe(def2) // Same reference
  })

  test("creates different definitions for different names", () => {
    const def1 = Tool.definition("tool_a", testTool)
    const def2 = Tool.definition("tool_b", testTool)
    expect(def1.name).toBe("tool_a")
    expect(def2.name).toBe("tool_b")
  })

  test("settle validates input schema and fails on invalid input", async () => {
    const call = {
      type: "tool-call" as const,
      id: "call_1",
      name: "test_tool",
      input: { invalid: true }, // Missing required 'message' field
    }
    const ctx: Tool.Context = {
      sessionID: "sess_1" as any,
      agent: "test" as any,
      assistantMessageID: "msg_1" as any,
      toolCallID: "call_1",
    }
    const result = await Effect.runPromise(Tool.settle(testTool, call as any, ctx).pipe(Effect.flip))
    expect(result.message).toContain("Invalid tool input")
  })

  test("settle executes and returns output for valid input", async () => {
    const call = {
      type: "tool-call" as const,
      id: "call_1",
      name: "test_tool",
      input: { message: "hello" },
    }
    const ctx: Tool.Context = {
      sessionID: "sess_1" as any,
      agent: "test" as any,
      assistantMessageID: "msg_1" as any,
      toolCallID: "call_1",
    }
    const result = await Effect.runPromise(Tool.settle(testTool, call as any, ctx))
    expect(result.content).toEqual([{ type: "text", text: "echo: hello" }])
  })
})

// ─── Tool.withPermission ────────────────────────────────────────────────────

describe("Tool.withPermission", () => {
  const baseTool = Tool.make({
    description: "base",
    input: Schema.Struct({ x: Schema.Number }),
    output: Schema.String,
    execute: () => Effect.succeed("ok"),
  })

  test("returns the custom permission", () => {
    const decorated = Tool.withPermission(baseTool, "custom_perm")
    expect(Tool.permission(decorated, "fallback")).toBe("custom_perm")
  })

  test("base tool returns the fallback name as permission", () => {
    expect(Tool.permission(baseTool, "fallback")).toBe("fallback")
  })
})
