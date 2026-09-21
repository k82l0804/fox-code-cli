import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { makeShellRunner, type ShellContext } from "@/session/prompt/shell"
import { SessionID } from "@/session/schema"

describe("Prompt Shell Module", () => {
  it("makeShellRunner creates shell and shellImpl functions", () => {
    const fakeCtx: any = {
      sessions: {},
      agents: {},
      events: {},
      flags: { experimentalEventSystem: false },
      revert: {},
      config: {},
      plugin: {},
      spawner: {},
      state: {},
      goals: { pause: () => Effect.void },
      currentModel: () => Effect.succeed({ providerID: "test" as any, modelID: "test" as any }),
      lastAssistant: () => Effect.succeed({ info: {} as any, parts: [] }),
    }

    const runner = makeShellRunner(fakeCtx)
    expect(runner).toBeDefined()
    expect(typeof runner.shell).toBe("function")
    expect(typeof runner.shellImpl).toBe("function")
  })
})
