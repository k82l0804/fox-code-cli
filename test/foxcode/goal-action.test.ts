import { describe, expect, test } from "bun:test"
import { Goal } from "@/foxcode/session/goal/runner"
import type { SessionV1 } from "@opencode-ai/core/v1/session"

describe("Goal.action classification", () => {
  function makePart(
    tool: string,
    status: "completed" | "error" | "pending" | "running" = "completed",
    metadata: Record<string, unknown> = {},
  ): typeof SessionV1.ToolPart.Type {
    return {
      id: "part-1",
      type: "tool",
      tool,
      callID: "call-1",
      state: {
        status,
        input: {},
        output: "out",
        time: { start: 1, end: 2 },
        metadata,
      } as any,
    } as any
  }

  test("classifies dismissed, interrupted, or denied parts as blocked", () => {
    expect(Goal.action(makePart("bash", "completed", { dismissed: true }))).toBe("blocked")
    expect(Goal.action(makePart("bash", "completed", { interrupted: true }))).toBe("blocked")
    expect(
      Goal.action(
        makePart("edit", "completed", { approval: { rule: { action: "deny" } } }),
      ),
    ).toBe("blocked")
    expect(Goal.action(makePart("plan_exit", "completed"))).toBe("blocked")
  })

  test("classifies non-terminal tool calls as none", () => {
    expect(Goal.action(makePart("bash", "pending"))).toBe("none")
    expect(Goal.action(makePart("bash", "running"))).toBe("none")
  })

  test("classifies errored tool calls or non-zero exit as failed", () => {
    expect(Goal.action(makePart("bash", "error"))).toBe("failed")
    expect(Goal.action(makePart("bash", "completed", { exit: 1 }))).toBe("failed")
    expect(Goal.action(makePart("edit", "completed", { error: true }))).toBe("failed")
  })

  test("classifies informational tools as none", () => {
    expect(Goal.action(makePart("question", "completed"))).toBe("none")
    expect(Goal.action(makePart("suggest", "completed"))).toBe("none")
    expect(Goal.action(makePart("todowrite", "completed"))).toBe("none")
    expect(Goal.action(makePart("board_post", "completed"))).toBe("none")
    expect(Goal.action(makePart("board_read", "completed"))).toBe("none")
    expect(Goal.action(makePart("goal_report", "completed"))).toBe("none")
    expect(Goal.action(makePart("task", "completed", { background: true }))).toBe("none")
  })

  test("classifies normal completed tool executions as success", () => {
    expect(Goal.action(makePart("read", "completed"))).toBe("success")
    expect(Goal.action(makePart("edit", "completed"))).toBe("success")
    expect(Goal.action(makePart("write", "completed"))).toBe("success")
    expect(Goal.action(makePart("bash", "completed", { exit: 0 }))).toBe("success")
  })
})
