import { describe, expect, it } from "bun:test"
import { isOrphanedInterruptedTool } from "../../src/session/prompt/orphan"
import type { SessionV1 } from "@opencode-ai/core/v1/session"

describe("isOrphanedInterruptedTool", () => {
  it("returns true for error status with interrupted metadata", () => {
    const part = {
      id: "part-1",
      messageID: "msg-1",
      sessionID: "sess-1",
      type: "tool",
      tool: "bash",
      callID: "call-1",
      state: {
        status: "error",
        error: "Interrupted",
        metadata: { interrupted: true },
      },
    } as unknown as SessionV1.ToolPart

    expect(isOrphanedInterruptedTool(part)).toBe(true)
  })

  it("returns false for error status without interrupted metadata", () => {
    const part = {
      id: "part-1",
      messageID: "msg-1",
      sessionID: "sess-1",
      type: "tool",
      tool: "bash",
      callID: "call-1",
      state: {
        status: "error",
        error: "Command failed",
      },
    } as unknown as SessionV1.ToolPart

    expect(isOrphanedInterruptedTool(part)).toBe(false)
  })

  it("returns false for completed or running status", () => {
    const part = {
      id: "part-1",
      messageID: "msg-1",
      sessionID: "sess-1",
      type: "tool",
      tool: "bash",
      callID: "call-1",
      state: {
        status: "completed",
        output: "ok",
      },
    } as unknown as SessionV1.ToolPart

    expect(isOrphanedInterruptedTool(part)).toBe(false)
  })
})
