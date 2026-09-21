import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { adapterState, toLLMEvents } from "@/session/llm/ai-sdk"
import { LLMEvent } from "@opencode-ai/llm"

describe("AI SDK toLLMEvents adapter", () => {
  test("handles start event with empty array", async () => {
    const state = adapterState()
    const events = await Effect.runPromise(toLLMEvents(state, { type: "start" } as any))
    expect(events).toEqual([])
  })

  test("handles start-step with stepStart LLMEvent", async () => {
    const state = adapterState()
    const events = await Effect.runPromise(toLLMEvents(state, { type: "start-step" } as any))
    expect(events.length).toBe(1)
    expect(events[0].type).toBe("step-start")
    expect((events[0] as any).index).toBe(0)
  })

  test("handles text-start, text-delta, and text-end sequence", async () => {
    const state = adapterState()
    // text-start
    const startEvents = await Effect.runPromise(
      toLLMEvents(state, { type: "text-start", id: "txt-1" } as any),
    )
    expect(startEvents.length).toBe(1)
    expect(startEvents[0].type).toBe("text-start")
    expect((startEvents[0] as any).id).toBe("txt-1")
    expect(state.currentTextID).toBe("txt-1")

    // text-delta
    const deltaEvents = await Effect.runPromise(
      toLLMEvents(state, { type: "text-delta", id: "txt-1", text: "Hello" } as any),
    )
    expect(deltaEvents.length).toBe(1)
    expect(deltaEvents[0].type).toBe("text-delta")
    expect((deltaEvents[0] as any).text).toBe("Hello")

    // text-end
    const endEvents = await Effect.runPromise(
      toLLMEvents(state, { type: "text-end", id: "txt-1" } as any),
    )
    expect(endEvents.length).toBe(1)
    expect(endEvents[0].type).toBe("text-end")
    expect(state.currentTextID).toBeUndefined()
  })

  test("handles reasoning stream sequence", async () => {
    const state = adapterState()
    const startEvents = await Effect.runPromise(
      toLLMEvents(state, { type: "reasoning-start", id: "rsn-1" } as any),
    )
    expect(startEvents.length).toBe(1)
    expect(startEvents[0].type).toBe("reasoning-start")
    expect(state.currentReasoningID).toBe("rsn-1")

    const deltaEvents = await Effect.runPromise(
      toLLMEvents(state, { type: "reasoning-delta", id: "rsn-1", text: "Thinking..." } as any),
    )
    expect(deltaEvents.length).toBe(1)
    expect(deltaEvents[0].type).toBe("reasoning-delta")
    expect((deltaEvents[0] as any).text).toBe("Thinking...")

    const endEvents = await Effect.runPromise(
      toLLMEvents(state, { type: "reasoning-end", id: "rsn-1" } as any),
    )
    expect(endEvents.length).toBe(1)
    expect(endEvents[0].type).toBe("reasoning-end")
    expect(state.currentReasoningID).toBeUndefined()
  })

  test("handles finish-step and increments state.step", async () => {
    const state = adapterState()
    expect(state.step).toBe(0)
    const events = await Effect.runPromise(
      toLLMEvents(state, {
        type: "finish-step",
        finishReason: "stop",
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      } as any),
    )
    expect(events.length).toBe(1)
    expect(events[0].type).toBe("step-finish")
    expect((events[0] as any).index).toBe(0)
    expect((events[0] as any).reason).toBe("stop")
    expect(state.step).toBe(1)
  })

  test("handles finish event and resets adapter state", async () => {
    const state = adapterState()
    state.step = 3
    state.text = 5
    const events = await Effect.runPromise(
      toLLMEvents(state, {
        type: "finish",
        finishReason: "stop",
        totalUsage: { inputTokens: 500, outputTokens: 200, totalTokens: 700 },
      } as any),
    )
    expect(events.length).toBe(1)
    expect(events[0].type).toBe("finish")
    expect((events[0] as any).reason).toBe("stop")
    // Adapter state reset
    expect(state.step).toBe(0)
    expect(state.text).toBe(0)
  })
})
