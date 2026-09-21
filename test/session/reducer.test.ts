import { describe, expect, test } from "bun:test"
import { createSessionData, reduceSessionData } from "@/cli/cmd/run/session-data"
import {
  createSyntheticContext,
  makeMessageUpdatedEvent,
  makeTextPartEvents,
  makeReasoningPartEvents,
  makeToolEvents,
} from "../fixtures/synthetic-events"

describe("SessionData Reducer", () => {
  test("processes message.updated and sets assistant role", () => {
    const ctx = createSyntheticContext("sess-1")
    const data = createSessionData()
    const { event, messageID } = makeMessageUpdatedEvent(ctx, "msg-1")

    const output = reduceSessionData({
      data,
      event,
      sessionID: "sess-1",
      thinking: true,
      limits: {},
    })

    expect(output.data.role.get(messageID)).toBe("assistant")
  })

  test("accumulates text deltas and emits text commits", () => {
    const ctx = createSyntheticContext("sess-1")
    const data = createSessionData()
    const { event: msgEvent, messageID } = makeMessageUpdatedEvent(ctx, "msg-1")

    // Initialize message
    reduceSessionData({
      data,
      event: msgEvent,
      sessionID: "sess-1",
      thinking: true,
      limits: {},
    })

    const textFixture = makeTextPartEvents(ctx, messageID, "Hello, world!")

    // Start text part
    const startOutput = reduceSessionData({
      data,
      event: textFixture.start,
      sessionID: "sess-1",
      thinking: true,
      limits: {},
    })
    expect(data.part.get(textFixture.partID)).toBe("assistant")

    // Delta text part
    const deltaOutput = reduceSessionData({
      data,
      event: textFixture.deltas[0],
      sessionID: "sess-1",
      thinking: true,
      limits: {},
    })
    expect(data.text.get(textFixture.partID)).toBe("Hello, world!")

    // End text part
    const endOutput = reduceSessionData({
      data,
      event: textFixture.end,
      sessionID: "sess-1",
      thinking: true,
      limits: {},
    })
    expect(data.ids.has(textFixture.partID)).toBe(true)
  })

  test("processes reasoning parts when thinking is enabled", () => {
    const ctx = createSyntheticContext("sess-1")
    const data = createSessionData()
    const { event: msgEvent, messageID } = makeMessageUpdatedEvent(ctx, "msg-1")

    reduceSessionData({
      data,
      event: msgEvent,
      sessionID: "sess-1",
      thinking: true,
      limits: {},
    })

    const rsnFixture = makeReasoningPartEvents(ctx, messageID, "Pondering the solution...")

    reduceSessionData({
      data,
      event: rsnFixture.start,
      sessionID: "sess-1",
      thinking: true,
      limits: {},
    })
    expect(data.part.get(rsnFixture.partID)).toBe("reasoning")

    reduceSessionData({
      data,
      event: rsnFixture.deltas[0],
      sessionID: "sess-1",
      thinking: true,
      limits: {},
    })
    expect(data.text.get(rsnFixture.partID)).toBe("Pondering the solution...")
  })

  test("tracks running tools and handles completion", () => {
    const ctx = createSyntheticContext("sess-1")
    const data = createSessionData()
    const { event: msgEvent, messageID } = makeMessageUpdatedEvent(ctx, "msg-1")

    reduceSessionData({
      data,
      event: msgEvent,
      sessionID: "sess-1",
      thinking: true,
      limits: {},
    })

    const toolFixture = makeToolEvents(
      ctx,
      messageID,
      "read",
      { path: "src/index.ts" },
      { title: "read", output: "export const x = 1;" },
    )

    // Start tool
    const startOutput = reduceSessionData({
      data,
      event: toolFixture.start,
      sessionID: "sess-1",
      thinking: true,
      limits: {},
    })
    expect(data.tools.has(toolFixture.partID)).toBe(true)

    // Finish tool
    const doneOutput = reduceSessionData({
      data,
      event: toolFixture.done,
      sessionID: "sess-1",
      thinking: true,
      limits: {},
    })
    expect(data.tools.has(toolFixture.partID)).toBe(false)
  })
})
