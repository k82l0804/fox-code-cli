import { describe, expect, test } from "bun:test"
import { createSessionData, reduceSessionData } from "@/cli/cmd/run/session-data"
import {
  createSyntheticContext,
  makeMessageUpdatedEvent,
  makePermissionEvents,
} from "../fixtures/synthetic-events"

describe("Permission Flow Integration", () => {
  test("permission request queues into data.permissions and updates footer", () => {
    const ctx = createSyntheticContext("sess-perm-1")
    const data = createSessionData()
    const { event: msgEvent, messageID } = makeMessageUpdatedEvent(ctx, "msg-perm-1")

    reduceSessionData({
      data,
      event: msgEvent,
      sessionID: "sess-perm-1",
      thinking: true,
      limits: {},
    })

    const permFixture = makePermissionEvents(ctx, messageID, "bash", "execute", ["git status"])

    // Tool starts running
    reduceSessionData({
      data,
      event: permFixture.toolRunning,
      sessionID: "sess-perm-1",
      thinking: true,
      limits: {},
    })
    expect(data.tools.has(permFixture.partID)).toBe(true)

    // Permission asked
    const askedOutput = reduceSessionData({
      data,
      event: permFixture.permissionAsked,
      sessionID: "sess-perm-1",
      thinking: true,
      limits: {},
    })

    expect(data.permissions.length).toBe(1)
    expect(data.permissions[0].id).toBe(permFixture.requestID)
    expect(askedOutput.footer?.view?.type).toBe("permission")
  })

  test("approving permission clears queue and completes tool part", () => {
    const ctx = createSyntheticContext("sess-perm-2")
    const data = createSessionData()
    const { event: msgEvent, messageID } = makeMessageUpdatedEvent(ctx, "msg-perm-2")

    reduceSessionData({
      data,
      event: msgEvent,
      sessionID: "sess-perm-2",
      thinking: true,
      limits: {},
    })

    const permFixture = makePermissionEvents(ctx, messageID, "bash", "execute", ["git pull"])

    reduceSessionData({
      data,
      event: permFixture.toolRunning,
      sessionID: "sess-perm-2",
      thinking: true,
      limits: {},
    })

    reduceSessionData({
      data,
      event: permFixture.permissionAsked,
      sessionID: "sess-perm-2",
      thinking: true,
      limits: {},
    })
    expect(data.permissions.length).toBe(1)

    // User approves
    const { replied, toolFinished } = permFixture.makeReply("allow")
    const replyOutput = reduceSessionData({
      data,
      event: replied,
      sessionID: "sess-perm-2",
      thinking: true,
      limits: {},
    })
    expect(data.permissions.length).toBe(0)

    // Tool finishes
    reduceSessionData({
      data,
      event: toolFinished,
      sessionID: "sess-perm-2",
      thinking: true,
      limits: {},
    })
    expect(data.tools.has(permFixture.partID)).toBe(false)
  })

  test("rejecting permission clears queue and marks tool with error", () => {
    const ctx = createSyntheticContext("sess-perm-3")
    const data = createSessionData()
    const { event: msgEvent, messageID } = makeMessageUpdatedEvent(ctx, "msg-perm-3")

    reduceSessionData({
      data,
      event: msgEvent,
      sessionID: "sess-perm-3",
      thinking: true,
      limits: {},
    })

    const permFixture = makePermissionEvents(ctx, messageID, "bash", "execute", ["rm -rf /"])

    reduceSessionData({
      data,
      event: permFixture.toolRunning,
      sessionID: "sess-perm-3",
      thinking: true,
      limits: {},
    })

    reduceSessionData({
      data,
      event: permFixture.permissionAsked,
      sessionID: "sess-perm-3",
      thinking: true,
      limits: {},
    })

    const { replied, toolFinished } = permFixture.makeReply("reject", "Denied by user")
    reduceSessionData({
      data,
      event: replied,
      sessionID: "sess-perm-3",
      thinking: true,
      limits: {},
    })
    expect(data.permissions.length).toBe(0)

    reduceSessionData({
      data,
      event: toolFinished,
      sessionID: "sess-perm-3",
      thinking: true,
      limits: {},
    })
    expect(data.tools.has(permFixture.partID)).toBe(false)
  })
})
