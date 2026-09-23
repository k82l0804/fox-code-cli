import { describe, expect, test, beforeAll, afterAll } from "bun:test"
import { Effect, Layer } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import { MessageV2 } from "@/session/message-v2"
import { SessionTable, MessageTable, PartTable } from "@opencode-ai/core/session/sql"
import { ProjectTable } from "@opencode-ai/core/project/sql"
import { SessionID, MessageID, PartID } from "@/session/schema"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("Paginated Message Loading", () => {
  let tempDir: string
  let dbLayer: Layer.Layer<Database.Service>
  let dbInstance: any

  const testSessionID = "session_test_100" as SessionID
  const emptySessionID = "session_test_empty" as SessionID
  const partsSessionID = "session_test_parts" as SessionID

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "fox-pagination-test-"))
    const dbFile = join(tempDir, "test.db")
    dbLayer = Database.layerFromPath(dbFile)

    await Effect.runPromise(
      Effect.gen(function* () {
        const { db } = yield* Database.Service
        dbInstance = db

        // 1. Create a project
        yield* db.insert(ProjectTable).values({
          id: "proj_test" as any,
          worktree: "/test" as any,
          sandboxes: [] as any,
          time_created: 1000,
          time_updated: 1000,
        }).pipe(Effect.orDie)

        // 2. Create test sessions
        yield* db.insert(SessionTable).values([
          {
            id: testSessionID,
            project_id: "proj_test" as any,
            slug: "test-session-100",
            directory: "/test" as any,
            title: "100 Messages Session",
            version: "1.0",
            time_created: 1000,
            time_updated: 1000,
          },
          {
            id: emptySessionID,
            project_id: "proj_test" as any,
            slug: "test-session-empty",
            directory: "/test" as any,
            title: "Empty Session",
            version: "1.0",
            time_created: 1000,
            time_updated: 1000,
          },
          {
            id: partsSessionID,
            project_id: "proj_test" as any,
            slug: "test-session-parts",
            directory: "/test" as any,
            title: "Parts Session",
            version: "1.0",
            time_created: 1000,
            time_updated: 1000,
          },
        ]).pipe(Effect.orDie)

        // 3. Populate 100 messages in testSessionID
        // Created with monotonic timestamps: time_created = 1000 + i (i = 0..99)
        const messagesToInsert = []
        for (let i = 0; i < 100; i++) {
          const id = `msg_${String(i).padStart(3, "0")}` as MessageID
          const time = 1000 + i
          messagesToInsert.push({
            id,
            session_id: testSessionID,
            time_created: time,
            time_updated: time,
            data: {
              role: i % 2 === 0 ? "user" : "assistant",
              time: { created: time },
            } as any,
          })
        }
        yield* db.insert(MessageTable).values(messagesToInsert).pipe(Effect.orDie)

        // 4. Populate 3 messages with 5 parts each in partsSessionID
        for (let m = 0; m < 3; m++) {
          const msgId = `msg_parts_${m}` as MessageID
          const time = 2000 + m
          yield* db.insert(MessageTable).values({
            id: msgId,
            session_id: partsSessionID,
            time_created: time,
            time_updated: time,
            data: {
              role: "assistant",
              time: { created: time },
            } as any,
          }).pipe(Effect.orDie)

          const partsToInsert = []
          for (let p = 0; p < 5; p++) {
            partsToInsert.push({
              id: `part_${m}_${p}` as PartID,
              message_id: msgId,
              session_id: partsSessionID,
              time_created: time,
              time_updated: time,
              data: {
                type: "text",
                text: `Part ${p} of message ${m}`,
              } as any,
            })
          }
          yield* db.insert(PartTable).values(partsToInsert).pipe(Effect.orDie)
        }
      }).pipe(Effect.provide(dbLayer)),
    )
  })

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test("first page loads latest N messages", async () => {
    const page = await Effect.runPromise(
      MessageV2.pageForSession(testSessionID, { pageSize: 20 }).pipe(Effect.provide(dbLayer)),
    )

    expect(page.messages.length).toBe(20)
    expect(page.hasMore).toBe(true)
    expect(page.cursor).toBeDefined()
    // First message should be the latest message (msg_099)
    expect(page.messages[0]!.info.id).toBe("msg_099")
    // 20th message should be msg_080
    expect(page.messages[19]!.info.id).toBe("msg_080")
    // Cursor points to oldest message in page (msg_080)
    expect(page.cursor?.id).toBe("msg_080")
    expect(page.cursor?.time).toBe(1080)
  })

  test("cursor navigation loads next page", async () => {
    const page1 = await Effect.runPromise(
      MessageV2.pageForSession(testSessionID, { pageSize: 20 }).pipe(Effect.provide(dbLayer)),
    )

    const page2 = await Effect.runPromise(
      MessageV2.pageForSession(testSessionID, { pageSize: 20, before: page1.cursor }).pipe(
        Effect.provide(dbLayer),
      ),
    )

    expect(page2.messages.length).toBe(20)
    expect(page2.hasMore).toBe(true)
    expect(page2.cursor).toBeDefined()
    expect(page2.messages[0]!.info.id).toBe("msg_079")
    expect(page2.messages[19]!.info.id).toBe("msg_060")
    expect(page2.cursor?.id).toBe("msg_060")
    expect(page2.cursor?.time).toBe(1060)
  })

  test("last page has hasMore=false", async () => {
    let currentCursor: MessageV2.Cursor | undefined
    let pageCount = 0
    let lastPage: MessageV2.MessagePage | undefined

    while (true) {
      const page: MessageV2.MessagePage = await Effect.runPromise(
        MessageV2.pageForSession(testSessionID, { pageSize: 20, before: currentCursor }).pipe(
          Effect.provide(dbLayer),
        ),
      )
      pageCount++
      lastPage = page
      if (!page.hasMore) break
      currentCursor = page.cursor
    }

    expect(pageCount).toBe(5) // 100 / 20 = 5 pages
    expect(lastPage).toBeDefined()
    expect(lastPage!.hasMore).toBe(false)
    expect(lastPage!.cursor).toBeUndefined()
    expect(lastPage!.messages.length).toBe(20)
    expect(lastPage!.messages[19]!.info.id).toBe("msg_000")
  })

  test("parts are hydrated per page", async () => {
    // 1. With hydrateParts: true (default)
    const pageWithParts = await Effect.runPromise(
      MessageV2.pageForSession(partsSessionID, { pageSize: 1 }).pipe(Effect.provide(dbLayer)),
    )
    expect(pageWithParts.messages.length).toBe(1)
    expect(pageWithParts.messages[0]!.parts.length).toBe(5)
    expect(pageWithParts.messages[0]!.parts[0]!.type).toBe("text")

    // 2. With hydrateParts: false
    const pageWithoutParts = await Effect.runPromise(
      MessageV2.pageForSession(partsSessionID, { pageSize: 3, hydrateParts: false }).pipe(
        Effect.provide(dbLayer),
      ),
    )
    expect(pageWithoutParts.messages.length).toBe(3)
    expect(pageWithoutParts.messages[0]!.parts.length).toBe(0)
    expect(pageWithoutParts.messages[1]!.parts.length).toBe(0)
    expect(pageWithoutParts.messages[2]!.parts.length).toBe(0)
  })

  test("empty session returns empty page", async () => {
    const page = await Effect.runPromise(
      MessageV2.pageForSession(emptySessionID, { pageSize: 20 }).pipe(Effect.provide(dbLayer)),
    )

    expect(page.messages).toEqual([])
    expect(page.hasMore).toBe(false)
    expect(page.cursor).toBeUndefined()
  })

  test("backward compat: listForSession unchanged", async () => {
    const all = await Effect.runPromise(
      MessageV2.listForSession(testSessionID).pipe(Effect.provide(dbLayer)),
    )

    expect(all.length).toBe(100)
    // Should be returned in chronological order (oldest to newest)
    expect(all[0]!.info.id).toBe("msg_000")
    expect(all[99]!.info.id).toBe("msg_099")
  })

  test("pageSize=1 works", async () => {
    let currentCursor: MessageV2.Cursor | undefined
    const retrievedIds: string[] = []

    for (let step = 0; step < 5; step++) {
      const page: MessageV2.MessagePage = await Effect.runPromise(
        MessageV2.pageForSession(testSessionID, { pageSize: 1, before: currentCursor }).pipe(
          Effect.provide(dbLayer),
        ),
      )
      expect(page.messages.length).toBe(1)
      expect(page.hasMore).toBe(true)
      expect(page.cursor).toBeDefined()
      retrievedIds.push(page.messages[0]!.info.id)
      currentCursor = page.cursor
    }

    expect(retrievedIds).toEqual(["msg_099", "msg_098", "msg_097", "msg_096", "msg_095"])
  })

  test("throws NotFoundError on non-existent session", async () => {
    const nonExistent = "session_does_not_exist" as SessionID
    expect(
      Effect.runPromise(
        MessageV2.pageForSession(nonExistent, { pageSize: 10 }).pipe(Effect.provide(dbLayer)),
      ),
    ).rejects.toThrow("Session not found")
  })

  test("accepts encoded string before cursor", async () => {
    const page1 = await Effect.runPromise(
      MessageV2.pageForSession(testSessionID, { pageSize: 10 }).pipe(Effect.provide(dbLayer)),
    )
    const encodedCursor = MessageV2.cursor.encode(page1.cursor!)

    const page2 = await Effect.runPromise(
      MessageV2.pageForSession(testSessionID, { pageSize: 10, before: encodedCursor }).pipe(
        Effect.provide(dbLayer),
      ),
    )

    expect(page2.messages.length).toBe(10)
    expect(page2.messages[0]!.info.id).toBe("msg_089")
  })
})
