import path from "path"
import type { Event, ToolPart } from "@foxcode/sdk/v2"

export const SAMPLE_MARKDOWN = [
  "# Test Markdown",
  "",
  "This is a realistic assistant response for formatting checks.",
  "It mixes **bold**, _italic_, `inline code`, links, code fences, and tables.",
  "",
  "## Status",
  "",
  "| Area | Before | After | Notes |",
  "| --- | --- | --- | --- |",
  "| Direct mode | Missing final rows | Stable | Final markdown block flushes |",
  "| Tables | Dropped in streaming | Visible | Block-based commits match |",
  "",
  "```ts",
  "const result = { markdown: true, tables: 2, stable: true }",
  "```",
].join("\n")

export const SAMPLE_TABLE = [
  "# Table Sample",
  "",
  "| Kind | Example | Notes |",
  "| --- | --- | --- |",
  "| Pipe | `A\\|B` | Escaped pipes should stay in one cell |",
  "| Unicode | `漢字` | Wide characters should remain aligned |",
  "| Status | done | Final row should still appear |",
].join("\n")

export interface SyntheticEventContext {
  sessionID: string
  msgCounter: number
  partCounter: number
  callCounter: number
  permCounter: number
  askCounter: number
}

export function createSyntheticContext(sessionID = "test_session_1"): SyntheticEventContext {
  return {
    sessionID,
    msgCounter: 0,
    partCounter: 0,
    callCounter: 0,
    permCounter: 0,
    askCounter: 0,
  }
}

export function makeMessageUpdatedEvent(ctx: SyntheticEventContext, messageID?: string): { event: Event; messageID: string } {
  ctx.msgCounter += 1
  const id = messageID || `msg_${ctx.msgCounter}`
  const event: Event = {
    type: "message.updated",
    properties: {
      sessionID: ctx.sessionID,
      info: {
        id,
        sessionID: ctx.sessionID,
        role: "assistant",
        time: {
          created: Date.now(),
        },
        parentID: `user_${id}`,
        modelID: "local-model",
        providerID: "local",
        mode: "general",
        agent: "fox",
        path: {
          cwd: process.cwd(),
          root: process.cwd(),
        },
        cost: 0.001,
        tokens: {
          input: 100,
          output: 250,
          reasoning: 50,
          cache: {
            read: 0,
            write: 0,
          },
        },
      },
    },
  } as Event
  return { event, messageID: id }
}

export function makeTextPartEvents(
  ctx: SyntheticEventContext,
  messageID: string,
  text: string,
): { start: Event; deltas: Event[]; end: Event; partID: string } {
  ctx.partCounter += 1
  const partID = `part_text_${ctx.partCounter}`
  const start = Date.now()

  const startEvent: Event = {
    type: "message.part.updated",
    properties: {
      sessionID: ctx.sessionID,
      time: start,
      part: {
        id: partID,
        sessionID: ctx.sessionID,
        messageID,
        type: "text",
        text: "",
        time: { start },
      },
    },
  } as Event

  const deltas: Event[] = [
    {
      type: "message.part.delta",
      properties: {
        sessionID: ctx.sessionID,
        messageID,
        partID,
        field: "text",
        delta: text,
      },
    } as Event,
  ]

  const endEvent: Event = {
    type: "message.part.updated",
    properties: {
      sessionID: ctx.sessionID,
      time: Date.now(),
      part: {
        id: partID,
        sessionID: ctx.sessionID,
        messageID,
        type: "text",
        text,
        time: {
          start,
          end: Date.now(),
        },
      },
    },
  } as Event

  return { start: startEvent, deltas, end: endEvent, partID }
}

export function makeReasoningPartEvents(
  ctx: SyntheticEventContext,
  messageID: string,
  text: string,
): { start: Event; deltas: Event[]; end: Event; partID: string } {
  ctx.partCounter += 1
  const partID = `part_reasoning_${ctx.partCounter}`
  const start = Date.now()

  const startEvent: Event = {
    type: "message.part.updated",
    properties: {
      sessionID: ctx.sessionID,
      time: start,
      part: {
        id: partID,
        sessionID: ctx.sessionID,
        messageID,
        type: "reasoning",
        text: "",
        time: { start },
      },
    },
  } as Event

  const deltas: Event[] = [
    {
      type: "message.part.delta",
      properties: {
        sessionID: ctx.sessionID,
        messageID,
        partID,
        field: "text",
        delta: text,
      },
    } as Event,
  ]

  const endEvent: Event = {
    type: "message.part.updated",
    properties: {
      sessionID: ctx.sessionID,
      time: Date.now(),
      part: {
        id: partID,
        sessionID: ctx.sessionID,
        messageID,
        type: "reasoning",
        text,
        time: {
          start,
          end: Date.now(),
        },
      },
    },
  } as Event

  return { start: startEvent, deltas, end: endEvent, partID }
}

export function makeToolEvents(
  ctx: SyntheticEventContext,
  messageID: string,
  tool: string,
  input: Record<string, unknown>,
  output: { title: string; output: string; metadata?: Record<string, unknown> },
): { start: Event; done: Event; partID: string; callID: string } {
  ctx.partCounter += 1
  ctx.callCounter += 1
  const partID = `part_tool_${ctx.partCounter}`
  const callID = `call_${ctx.callCounter}`
  const start = Date.now()

  const startEvent: Event = {
    type: "message.part.updated",
    properties: {
      sessionID: ctx.sessionID,
      time: start,
      part: {
        id: partID,
        sessionID: ctx.sessionID,
        messageID,
        type: "tool",
        callID,
        tool,
        state: {
          status: "running",
          input,
          metadata: {},
          time: { start },
        },
      },
    },
  } as Event

  const doneEvent: Event = {
    type: "message.part.updated",
    properties: {
      sessionID: ctx.sessionID,
      time: Date.now(),
      part: {
        id: partID,
        sessionID: ctx.sessionID,
        messageID,
        type: "tool",
        callID,
        tool,
        state: {
          status: "completed",
          input,
          output: output.output,
          title: output.title,
          metadata: output.metadata ?? {},
          time: {
            start,
            end: Date.now(),
          },
        },
      },
    },
  } as Event

  return { start: startEvent, done: doneEvent, partID, callID }
}

export function makePermissionEvents(
  ctx: SyntheticEventContext,
  messageID: string,
  tool: string,
  permission: string,
  patterns: string[],
): {
  partID: string
  callID: string
  requestID: string
  toolRunning: Event
  permissionAsked: Event
  makeReply: (reply: "allow" | "reject", message?: string) => { replied: Event; toolFinished: Event }
} {
  ctx.partCounter += 1
  ctx.callCounter += 1
  ctx.permCounter += 1
  const partID = `part_perm_${ctx.partCounter}`
  const callID = `call_perm_${ctx.callCounter}`
  const requestID = `perm_${ctx.permCounter}`
  const start = Date.now()

  const toolRunning: Event = {
    type: "message.part.updated",
    properties: {
      sessionID: ctx.sessionID,
      time: start,
      part: {
        id: partID,
        sessionID: ctx.sessionID,
        messageID,
        type: "tool",
        callID,
        tool,
        state: {
          status: "running",
          input: {},
          metadata: {},
          time: { start },
        },
      },
    },
  } as Event

  const permissionAsked: Event = {
    type: "permission.asked",
    properties: {
      id: requestID,
      sessionID: ctx.sessionID,
      permission,
      patterns,
      metadata: {},
      always: patterns,
      tool: {
        messageID,
        callID,
      },
    },
  } as Event

  const makeReply = (reply: "allow" | "reject", message?: string) => {
    const replied: Event = {
      type: "permission.replied",
      properties: {
        sessionID: ctx.sessionID,
        requestID,
        reply,
      },
    } as Event

    const toolFinished: Event = {
      type: "message.part.updated",
      properties: {
        sessionID: ctx.sessionID,
        time: Date.now(),
        part: {
          id: partID,
          sessionID: ctx.sessionID,
          messageID,
          type: "tool",
          callID,
          tool,
          state:
            reply === "allow"
              ? {
                  status: "completed",
                  input: {},
                  output: "Permission granted",
                  title: tool,
                  metadata: {},
                  time: { start, end: Date.now() },
                }
              : {
                  status: "error",
                  input: {},
                  error: message || "permission rejected",
                  metadata: {},
                  time: { start, end: Date.now() },
                },
        },
      },
    } as Event

    return { replied, toolFinished }
  }

  return { partID, callID, requestID, toolRunning, permissionAsked, makeReply }
}

export function makeSubagentPart(childSessionID: string, callID: string, parentSessionID = "parent_sess"): ToolPart {
  return {
    id: `sub_tool_${callID}`,
    type: "tool",
    sessionID: parentSessionID,
    messageID: `sub_msg_${callID}`,
    callID,
    tool: "task",
    state: {
      status: "running",
      input: { description: "Subagent task" },
      time: { start: Date.now() },
      metadata: { sessionID: childSessionID },
    },
    metadata: { sessionID: childSessionID },
  }
}
