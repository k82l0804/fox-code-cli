import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { makePromptLoop } from "@/session/prompt/loop"

describe("Prompt Loop Module", () => {
  it("makePromptLoop initializes loop, runLoop, and closeReasons map", () => {
    const fakeDeps: any = {
      sessions: {},
      status: {},
      agents: {},
      provider: {},
      processor: {},
      compaction: {},
      plugin: {},
      config: {},
      permission: {},
      question: {},
      fsys: {},
      mcp: {},
      registry: {},
      truncate: {},
      scope: {},
      instruction: {},
      state: {},
      summary: {},
      sys: {},
      events: {},
      flags: {},
      database: {},
      control: {},
      ops: () => Effect.succeed({} as any),
      getModel: () => Effect.succeed({} as any),
      handleSubtask: () => Effect.void,
      title: () => Effect.void,
      lastAssistant: () => Effect.succeed({ info: {} as any, parts: [] }),
    }

    const result = makePromptLoop(fakeDeps)
    expect(result).toBeDefined()
    expect(typeof result.loop).toBe("function")
    expect(typeof result.runLoop).toBe("function")
    expect(result.closeReasons).toBeInstanceOf(Map)
  })
})
