import { describe, expect, test } from "bun:test"
import { createJournal } from "../src/session/mutation-journal"

describe("MutationJournal", () => {
  test("starts empty", () => {
    const journal = createJournal()
    expect(journal.isEmpty()).toBe(true)
    expect(journal.hasEntries()).toBe(false)
    expect(journal.fileCount()).toBe(0)
    expect(journal.entries).toEqual([])
    expect(journal.lastEntry()).toBeUndefined()
  })

  test("records mutation entries from standard mutation tools", () => {
    const journal = createJournal()
    journal.record({
      tool: "edit",
      file: "/path/to/fileA.ts",
      timestamp: 1000,
      messageId: "msg_1",
    })

    expect(journal.isEmpty()).toBe(false)
    expect(journal.hasEntries()).toBe(true)
    expect(journal.fileCount()).toBe(1)
    expect(journal.entries.length).toBe(1)
    expect(journal.lastEntry()?.tool).toBe("edit")
    expect(journal.lastEntry()?.file).toBe("/path/to/fileA.ts")

    // Record apply_patch
    journal.record({
      tool: "apply_patch",
      file: "/path/to/fileB.ts",
      timestamp: 1010,
      messageId: "msg_1",
    })
    expect(journal.fileCount()).toBe(2)
    expect(journal.entries.length).toBe(2)

    // Record write
    journal.record({
      tool: "write",
      file: "/path/to/fileC.ts",
      timestamp: 1020,
      messageId: "msg_2",
    })
    expect(journal.fileCount()).toBe(3)
    expect(journal.entries.length).toBe(3)
  })

  test("accepts fence-parse tool sources (rewrite_file)", () => {
    const journal = createJournal()
    journal.record({
      tool: "rewrite_file",
      file: "/path/to/model.ts",
      timestamp: 2000,
      messageId: "msg_fence",
    })
    expect(journal.isEmpty()).toBe(false)
    expect(journal.fileCount()).toBe(1)
    expect(journal.entries[0].tool).toBe("rewrite_file")
  })

  test("commit tool is explicitly excluded and does NOT count as mutation", () => {
    const journal = createJournal()
    journal.record({
      tool: "commit",
      file: "/path/to/git-metadata",
      timestamp: 3000,
      messageId: "msg_commit",
    })
    expect(journal.isEmpty()).toBe(true)
    expect(journal.hasEntries()).toBe(false)
    expect(journal.fileCount()).toBe(0)
    expect(journal.entries.length).toBe(0)
  })

  test("fileCount computes unique files", () => {
    const journal = createJournal()
    journal.record({ tool: "edit", file: "/src/index.ts", timestamp: 1, messageId: "m1" })
    journal.record({ tool: "edit", file: "/src/index.ts", timestamp: 2, messageId: "m2" })
    journal.record({ tool: "apply_patch", file: "/src/index.ts", timestamp: 3, messageId: "m3" })
    journal.record({ tool: "write", file: "/src/util.ts", timestamp: 4, messageId: "m4" })

    expect(journal.entries.length).toBe(4)
    expect(journal.fileCount()).toBe(2)
  })

  test("reset clears all entries", () => {
    const journal = createJournal()
    journal.record({ tool: "edit", file: "/src/index.ts", timestamp: 1, messageId: "m1" })
    expect(journal.isEmpty()).toBe(false)

    journal.reset()
    expect(journal.isEmpty()).toBe(true)
    expect(journal.hasEntries()).toBe(false)
    expect(journal.fileCount()).toBe(0)
    expect(journal.entries.length).toBe(0)
    expect(journal.lastEntry()).toBeUndefined()
  })

  test("ignores invalid entries without file path", () => {
    const journal = createJournal()
    journal.record({ tool: "edit", file: "", timestamp: 1, messageId: "m1" })
    expect(journal.isEmpty()).toBe(true)
  })
})
