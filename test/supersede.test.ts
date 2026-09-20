/**
 * Unit tests for tool output supersession (Strategy 4.4)
 *
 * Tests the buildSupersededSet function which identifies stale read outputs
 * that have been invalidated by later edit/write/apply_patch operations.
 */
import { describe, test, expect } from "bun:test"
import { buildSupersededSet } from "@/session/supersede"
import type { SessionV1 } from "@opencode-ai/core/v1/session"

const ENABLED = { enabled: true }

// Helper to create a minimal WithParts message with tool parts
function assistantMsg(id: string, parts: any[]): SessionV1.WithParts {
  return {
    info: {
      id,
      sessionID: "test-session",
      role: "assistant",
      time: { created: Date.now() },
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      modelID: "test-model",
      providerID: "test-provider",
    } as any,
    parts,
  }
}

function readPart(callID: string, path: string): any {
  return {
    id: callID,
    messageID: "msg-1",
    sessionID: "test-session",
    type: "tool",
    tool: "read",
    callID,
    state: {
      status: "completed",
      input: { path },
      output: `Contents of ${path}...`,
      title: "",
      metadata: {},
      time: { start: Date.now(), end: Date.now() },
    },
  }
}

function editPart(callID: string, path: string): any {
  return {
    id: callID,
    messageID: "msg-2",
    sessionID: "test-session",
    type: "tool",
    tool: "edit",
    callID,
    state: {
      status: "completed",
      input: { path, oldString: "foo", newString: "bar" },
      output: `Edited file successfully: ${path}\nReplacements: 1`,
      title: "",
      metadata: {},
      time: { start: Date.now(), end: Date.now() },
    },
  }
}

function writePart(callID: string, path: string): any {
  return {
    id: callID,
    messageID: "msg-3",
    sessionID: "test-session",
    type: "tool",
    tool: "write",
    callID,
    state: {
      status: "completed",
      input: { path, content: "new content" },
      output: `Wrote file successfully: ${path}`,
      title: "",
      metadata: {},
      time: { start: Date.now(), end: Date.now() },
    },
  }
}

function patchPart(callID: string, paths: string[]): any {
  return {
    id: callID,
    messageID: "msg-4",
    sessionID: "test-session",
    type: "tool",
    tool: "apply_patch",
    callID,
    state: {
      status: "completed",
      input: { patchText: "..." },
      output: ["Applied patch sequentially:", ...paths.map((p) => `M ${p}`)].join("\n"),
      title: "",
      metadata: {},
      time: { start: Date.now(), end: Date.now() },
    },
  }
}

describe("buildSupersededSet", () => {
  test("returns empty map when flag is disabled", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [readPart("read-1", "src/foo.ts")]),
      assistantMsg("a2", [editPart("edit-1", "src/foo.ts")]),
      assistantMsg("a3", [readPart("read-2", "src/foo.ts")]),
    ]
    const result = buildSupersededSet(msgs) // no options = uses Flag (default false)
    expect(result.size).toBe(0)
  })

  test("does not supersede the only read (no re-read after mutation)", () => {
    // Single read followed by edit — the read is the "latest" so it's kept
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [readPart("read-1", "src/foo.ts")]),
      assistantMsg("a2", [editPart("edit-1", "src/foo.ts")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.size).toBe(0)
  })

  test("supersedes earlier read when a later read exists after edit", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [readPart("read-1", "src/foo.ts")]),
      assistantMsg("a2", [editPart("edit-1", "src/foo.ts")]),
      assistantMsg("a3", [readPart("read-2", "src/foo.ts")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    // read-1 should be superseded (it's stale), read-2 is fresh
    expect(result.has("read-1")).toBe(true)
    expect(result.has("read-2")).toBe(false)
    expect(result.get("read-1")).toContain("superseded")
    expect(result.get("read-1")).toContain("edit")
  })

  test("supersedes read when write targets same file", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [readPart("read-1", "src/bar.ts")]),
      assistantMsg("a2", [writePart("write-1", "src/bar.ts")]),
      assistantMsg("a3", [readPart("read-2", "src/bar.ts")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.has("read-1")).toBe(true)
    expect(result.has("read-2")).toBe(false)
    expect(result.get("read-1")).toContain("write")
  })

  test("supersedes read when apply_patch targets same file", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [readPart("read-1", "src/main.ts")]),
      assistantMsg("a2", [patchPart("patch-1", ["src/main.ts", "src/other.ts"])]),
      assistantMsg("a3", [readPart("read-2", "src/main.ts")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.has("read-1")).toBe(true)
    expect(result.get("read-1")).toContain("apply_patch")
  })

  test("does not supersede reads for files that were never mutated", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [readPart("read-1", "src/safe.ts")]),
      assistantMsg("a2", [editPart("edit-1", "src/other.ts")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.size).toBe(0)
  })

  test("handles multiple reads of different files", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [
        readPart("read-1", "src/a.ts"),
        readPart("read-2", "src/b.ts"),
      ]),
      assistantMsg("a2", [editPart("edit-1", "src/a.ts")]),
      assistantMsg("a3", [readPart("read-3", "src/a.ts")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    // read-1 is superseded (a.ts was edited), read-2 is safe (b.ts wasn't)
    expect(result.has("read-1")).toBe(true)
    expect(result.has("read-2")).toBe(false)
    expect(result.has("read-3")).toBe(false)
  })

  test("returns empty map when no read tools are present", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [editPart("edit-1", "src/foo.ts")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.size).toBe(0)
  })

  test("handles multiple edits to the same file", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [readPart("read-1", "src/foo.ts")]),
      assistantMsg("a2", [editPart("edit-1", "src/foo.ts")]),
      assistantMsg("a3", [readPart("read-2", "src/foo.ts")]),
      assistantMsg("a4", [editPart("edit-2", "src/foo.ts")]),
      assistantMsg("a5", [readPart("read-3", "src/foo.ts")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    // read-1 and read-2 are stale, read-3 is the latest
    expect(result.has("read-1")).toBe(true)
    expect(result.has("read-2")).toBe(true)
    expect(result.has("read-3")).toBe(false)
  })

  test("matches paths with relative vs absolute prefix", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [readPart("read-1", "src/foo.ts")]),
      assistantMsg("a2", [editPart("edit-1", "./src/foo.ts")]),
      assistantMsg("a3", [readPart("read-2", "src/foo.ts")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.has("read-1")).toBe(true)
  })

  test("marker text includes file path and tool name", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [readPart("read-1", "src/config.ts")]),
      assistantMsg("a2", [editPart("edit-1", "src/config.ts")]),
      assistantMsg("a3", [readPart("read-2", "src/config.ts")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    const marker = result.get("read-1")!
    expect(marker).toContain("src/config.ts")
    expect(marker).toContain("edit")
    expect(marker).toContain("superseded")
  })

  test("does not supersede non-read tools", () => {
    // grep outputs should not be superseded even if the file was edited
    const grepPart: any = {
      id: "grep-1",
      messageID: "msg-1",
      sessionID: "test-session",
      type: "tool",
      tool: "grep",
      callID: "grep-1",
      state: {
        status: "completed",
        input: { pattern: "foo", path: "src/foo.ts" },
        output: "match found",
        title: "",
        metadata: {},
        time: { start: Date.now(), end: Date.now() },
      },
    }
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [grepPart]),
      assistantMsg("a2", [editPart("edit-1", "src/foo.ts")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.size).toBe(0)
  })
})
