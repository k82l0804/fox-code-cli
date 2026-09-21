import { describe, expect, test } from "bun:test"
import {
  createSubagentData,
  bootstrapSubagentData,
  listSubagentTabs,
  snapshotSubagentData,
  reduceSubagentData,
} from "@/cli/cmd/run/subagent-data"
import {
  createSyntheticContext,
  makeMessageUpdatedEvent,
  makeSubagentPart,
  makeTextPartEvents,
} from "../fixtures/synthetic-events"

describe("Subagent Data Management", () => {
  test("createSubagentData initializes empty state", () => {
    const data = createSubagentData()
    expect(data.tabs.size).toBe(0)
    expect(data.details.size).toBe(0)
    expect(listSubagentTabs(data)).toEqual([])
  })

  test("bootstrapSubagentData populates child sessions and creates tabs", () => {
    const data = createSubagentData()
    const messages = [
      { parts: [makeSubagentPart("sub-1", "call-1")] },
      { parts: [makeSubagentPart("sub-2", "call-2")] },
    ]
    bootstrapSubagentData({
      data,
      messages,
      children: [
        { id: "sub-1", title: "Subtask 1" },
        { id: "sub-2", title: "Subtask 2" },
      ],
      permissions: [],
      questions: [],
    })

    const tabs = listSubagentTabs(data)
    expect(tabs.length).toBe(2)
    expect(tabs[0].sessionID).toBe("sub-1")
    expect(tabs[1].sessionID).toBe("sub-2")

    const snapshot = snapshotSubagentData(data)
    expect(snapshot.tabs.length).toBe(2)
  })

  test("reduceSubagentData updates tab state when subagent message arrives", () => {
    const data = createSubagentData()
    const messages = [
      { parts: [makeSubagentPart("child-sess", "call-c1")] },
    ]
    bootstrapSubagentData({
      data,
      messages,
      children: [{ id: "child-sess", title: "Worker" }],
      permissions: [],
      questions: [],
    })

    const ctx = createSyntheticContext("child-sess")
    const { event: msgEvent } = makeMessageUpdatedEvent(ctx, "msg-child-1")

    reduceSubagentData({
      data,
      event: msgEvent,
      sessionID: "parent-sess",
      thinking: true,
      limits: {},
    })

    const detail = data.details.get("child-sess")
    expect(detail).toBeDefined()
    expect(detail?.data.role.get("msg-child-1")).toBe("assistant")

    // Deliver text part
    const { start, end } = makeTextPartEvents(ctx, "msg-child-1", "Subagent task output")
    reduceSubagentData({
      data,
      event: start,
      sessionID: "parent-sess",
      thinking: true,
      limits: {},
    })
    const changed = reduceSubagentData({
      data,
      event: end,
      sessionID: "parent-sess",
      thinking: true,
      limits: {},
    })
    expect(changed).toBe(true)
    expect(detail?.frames.length).toBeGreaterThan(0)
  })
})
