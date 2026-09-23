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
    const result = buildSupersededSet(msgs, { enabled: false })
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

  // ─── Git Command Supersession Tests ────────────────────────────────────────

  function bashPart(callID: string, command: string, output = "ok"): any {
    return {
      id: callID,
      messageID: `msg-${callID}`,
      sessionID: "test-session",
      type: "tool",
      tool: "bash",
      callID,
      state: {
        status: "completed",
        input: { command },
        output,
        title: "",
        metadata: {},
        time: { start: Date.now(), end: Date.now() },
      },
    }
  }

  test("supersedes earlier git status when subsequent git status runs", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [bashPart("status-1", "git status")]),
      assistantMsg("a2", [editPart("edit-1", "src/foo.ts")]),
      assistantMsg("a3", [bashPart("status-2", "git status -sb")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.has("status-1")).toBe(true)
    expect(result.has("status-2")).toBe(false)
    expect(result.get("status-1")).toContain("subsequent status check")
  })

  test("supersedes git status when followed by git commit", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [bashPart("status-1", "git status")]),
      assistantMsg("a2", [bashPart("commit-1", "git commit -m 'feat: update'")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.has("status-1")).toBe(true)
    expect(result.get("status-1")).toContain("git commit")
  })

  test("does not supersede latest git status when no mutation follows", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [bashPart("status-1", "git status")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.has("status-1")).toBe(false)
  })

  test("supersedes earlier repo-wide git diff when subsequent git diff runs", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [bashPart("diff-1", "git diff")]),
      assistantMsg("a2", [editPart("edit-1", "src/foo.ts")]),
      assistantMsg("a3", [bashPart("diff-2", "git diff -U1")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.has("diff-1")).toBe(true)
    expect(result.has("diff-2")).toBe(false)
    expect(result.get("diff-1")).toContain("subsequent diff")
  })

  test("supersedes git diff on a specific file when file is subsequently edited", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [bashPart("diff-file-1", "git diff src/foo.ts")]),
      assistantMsg("a2", [editPart("edit-1", "src/foo.ts")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.has("diff-file-1")).toBe(true)
    expect(result.get("diff-file-1")).toContain("src/foo.ts modified by edit")
  })

  test("supersedes git diff when followed by git commit", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [bashPart("diff-1", "git diff")]),
      assistantMsg("a2", [bashPart("commit-1", "git add . && git commit -m 'done'")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.has("diff-1")).toBe(true)
    expect(result.get("diff-1")).toContain("committed by git commit")
  })

  test("supersedes earlier git branch when subsequent git branch runs", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [bashPart("branch-1", "git branch -a")]),
      assistantMsg("a2", [bashPart("branch-2", "git branch")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.has("branch-1")).toBe(true)
    expect(result.has("branch-2")).toBe(false)
  })

  // ─── Pattern 1: Grep Supersession Tests ────────────────────────────────────

  function grepPart(callID: string, pattern: string, path?: string, output = "matches..."): any {
    return {
      id: callID,
      messageID: `msg-${callID}`,
      sessionID: "test-session",
      type: "tool",
      tool: "grep",
      callID,
      state: {
        status: "completed",
        input: { pattern, ...(path ? { path } : {}) },
        output,
        title: "",
        metadata: {},
        time: { start: Date.now(), end: Date.now() },
      },
    }
  }

  test("grep supersession: same query replaces earlier", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [grepPart("grep-1", "foo", "src/")]),
      assistantMsg("a2", [grepPart("grep-2", "foo", "src/")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.has("grep-1")).toBe(true)
    expect(result.has("grep-2")).toBe(false)
    expect(result.get("grep-1")).toContain("Grep results superseded")
  })

  test("grep supersession: different query preserved", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [grepPart("grep-1", "foo", "src/")]),
      assistantMsg("a2", [grepPart("grep-2", "bar", "src/")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.has("grep-1")).toBe(false)
    expect(result.has("grep-2")).toBe(false)
  })

  test("grep supersession: same query different path preserved", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [grepPart("grep-1", "foo", "src/")]),
      assistantMsg("a2", [grepPart("grep-2", "foo", "test/")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.has("grep-1")).toBe(false)
    expect(result.has("grep-2")).toBe(false)
  })

  // ─── Pattern 2: Glob Supersession Tests ────────────────────────────────────

  function globPart(callID: string, pattern: string, path?: string, output = "files..."): any {
    return {
      id: callID,
      messageID: `msg-${callID}`,
      sessionID: "test-session",
      type: "tool",
      tool: "glob",
      callID,
      state: {
        status: "completed",
        input: { pattern, ...(path ? { path } : {}) },
        output,
        title: "",
        metadata: {},
        time: { start: Date.now(), end: Date.now() },
      },
    }
  }

  test("glob supersession: same pattern replaces earlier", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [globPart("glob-1", "*.ts")]),
      assistantMsg("a2", [globPart("glob-2", "*.ts")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.has("glob-1")).toBe(true)
    expect(result.has("glob-2")).toBe(false)
    expect(result.get("glob-1")).toContain("Glob results superseded")
  })

  test("glob supersession: different pattern preserved", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [globPart("glob-1", "*.ts")]),
      assistantMsg("a2", [globPart("glob-2", "*.json")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.has("glob-1")).toBe(false)
    expect(result.has("glob-2")).toBe(false)
  })

  // ─── Pattern 3: Directory Listing (ls/find) Supersession Tests ──────────────

  test("directory listing: superseded by subsequent ls on same directory", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [bashPart("ls-1", "ls -la src/")]),
      assistantMsg("a2", [bashPart("ls-2", "ls src/")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.has("ls-1")).toBe(true)
    expect(result.has("ls-2")).toBe(false)
    expect(result.get("ls-1")).toContain("subsequent directory listing")
  })

  test("directory listing: superseded when file in directory is modified", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [bashPart("ls-1", "ls src/")]),
      assistantMsg("a2", [writePart("write-1", "src/foo.ts")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.has("ls-1")).toBe(true)
    expect(result.get("ls-1")).toContain("files modified in src")
  })

  test("directory listing: not superseded when file in different directory is modified", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [bashPart("ls-1", "ls src/")]),
      assistantMsg("a2", [writePart("write-1", "test/bar.ts")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.has("ls-1")).toBe(false)
  })

  test("directory listing: find superseded on git commit", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [bashPart("find-1", "find . -name '*.ts'")]),
      assistantMsg("a2", [bashPart("commit-1", "git commit -m 'feat: test'")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.has("find-1")).toBe(true)
    expect(result.get("find-1")).toContain("files modified by git commit")
  })

  // ─── Pattern 4: Verification Output Supersession Tests ─────────────────────

  function verifyPart(callID: string, output?: string): any {
    const defaultOutput =
      "─── Auto-Verification Pipeline ❌ FAILED ───\nTests: 1 failed\n─── End Auto-Verification Pipeline ───"
    return {
      id: callID,
      messageID: `msg-${callID}`,
      sessionID: "test-session",
      type: "tool",
      tool: "bash",
      callID,
      state: {
        status: "completed",
        input: { command: "bun test" },
        output: output ?? defaultOutput,
        title: "",
        metadata: {},
        time: { start: Date.now(), end: Date.now() },
      },
    }
  }

  test("verification supersession: earlier verification outputs superseded", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [verifyPart("verify-1")]),
      assistantMsg("a2", [editPart("edit-1", "src/foo.ts")]),
      assistantMsg("a3", [verifyPart("verify-2", "─── Auto-Verification Pipeline ✅ PASSED ───\nTests: pass\n─── End Auto-Verification Pipeline ───")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.has("verify-1")).toBe(true)
    expect(result.has("verify-2")).toBe(false)
    expect(result.get("verify-1")).toContain("Auto-verification output superseded")
  })

  test("verification supersession: preserves edit prefix when stripping verification", () => {
    const editWithVerify: any = {
      id: "edit-v-1",
      messageID: "msg-1",
      sessionID: "test-session",
      type: "tool",
      tool: "edit",
      callID: "edit-v-1",
      state: {
        status: "completed",
        input: { path: "src/foo.ts", oldString: "a", newString: "b" },
        output:
          "Edited file successfully: src/foo.ts\nReplacements: 1\n\n─── Auto-Verification Pipeline ❌ FAILED ───\nFailure\n─── End Auto-Verification Pipeline ───",
        title: "",
        metadata: {},
        time: { start: Date.now(), end: Date.now() },
      },
    }
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [editWithVerify]),
      assistantMsg("a2", [verifyPart("verify-2")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.has("edit-v-1")).toBe(true)
    const marker = result.get("edit-v-1")!
    expect(marker).toContain("Edited file successfully: src/foo.ts")
    expect(marker).toContain("Auto-verification output superseded")
    expect(marker).not.toContain("─── Auto-Verification Pipeline ❌ FAILED ───")
  })

  // ─── Pattern 5: Read Supersession on Re-Read Tests ─────────────────────────

  test("read supersession: re-read without mutation", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [readPart("read-1", "src/a.ts")]),
      assistantMsg("a2", [readPart("read-2", "src/a.ts")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.has("read-1")).toBe(true)
    expect(result.has("read-2")).toBe(false)
    expect(result.get("read-1")).toContain("subsequent read of src/a.ts")
  })

  test("read supersession: re-read without mutation across intermediate unrelated edit", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [readPart("read-1", "src/a.ts")]),
      assistantMsg("a2", [editPart("edit-1", "src/b.ts")]),
      assistantMsg("a3", [readPart("read-2", "src/a.ts")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.has("read-1")).toBe(true)
    expect(result.has("read-2")).toBe(false)
  })

  test("no false positives on different files", () => {
    const msgs: SessionV1.WithParts[] = [
      assistantMsg("a1", [readPart("read-1", "src/a.ts")]),
      assistantMsg("a2", [readPart("read-2", "src/b.ts")]),
    ]
    const result = buildSupersededSet(msgs, ENABLED)
    expect(result.size).toBe(0)
  })
})
