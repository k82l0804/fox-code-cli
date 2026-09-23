# Plan: Paginated Message Loading

> **Task**: Phase 2A #5 from [`current-tasks.md`](../master-plan/current-tasks.md)
> **Goal**: Improve performance of loading large sessions by implementing cursor-based pagination.

## Background

Currently, [`message-v2.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/message-v2.ts) (848 lines) loads **all messages and all parts for a session in a single query** via the `hydrate()` function (line 210):

```typescript
function hydrate(db, rows: MessageTable[]) {
  const ids = rows.map(row => row.id)
  // One query loads ALL parts for ALL messages:
  const partRows = yield* db.select().from(PartTable)
    .where(inArray(PartTable.message_id, ids))
    .orderBy(PartTable.message_id, PartTable.id)
    .all()
}
```

For a long session with 200+ messages and 500+ parts, this loads everything into memory at once. The TUI and ACP client both feel this on session resume.

The cursor type already exists (line 95-99):
```typescript
const Cursor = Schema.Struct({
  id: MessageID,
  time: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
})
```

And cursor-based comparison is already implemented (line 207-208):
```typescript
const older = (row: Cursor) =>
  or(lt(MessageTable.time_created, row.time), ...)
```

**The infrastructure is half-built.** The cursor and comparison exist but aren't used for paginated loading.

## Proposed Changes

### 1. [MODIFY] [`src/session/message-v2.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/message-v2.ts)

**Add paginated loading function** (~40 lines):

```typescript
export interface PageOptions {
  /** Maximum messages to load per page. Default: 50 */
  readonly pageSize?: number
  /** Cursor to load messages before (exclusive). Omit for latest. */
  readonly before?: Cursor
  /** If true, also load parts for each message. Default: true */
  readonly hydrateParts?: boolean
}

export interface MessagePage {
  readonly messages: WithParts[]
  readonly cursor: Cursor | undefined  // undefined = no more pages
  readonly hasMore: boolean
}
```

Add to `MessageV2.Service`:
```typescript
pageForSession: (sessionID: SessionID, options?: PageOptions) => Effect.Effect<MessagePage>
```

Implementation:
- Query `MessageTable` with `WHERE session_id = ? AND older(cursor)` 
- `ORDER BY time_created DESC, id DESC`
- `LIMIT pageSize + 1` (extra row to check `hasMore`)
- Hydrate parts for the returned messages only
- Return cursor from the oldest message in the page

**Modify existing `listForSession`** to use the new paginated function internally but still return all messages (backward compat):
```typescript
// Existing call sites still work unchanged:
listForSession: (sessionID) => {
  // Load all pages by following cursors
  let all: WithParts[] = []
  let cursor: Cursor | undefined
  do {
    const page = yield* pageForSession(sessionID, { before: cursor })
    all.push(...page.messages)
    cursor = page.cursor
  } while (cursor)
  return all.reverse() // chronological order
}
```

### 2. [MODIFY] [`src/server/routes/instance/httpapi/handlers/session.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/server/routes/instance/httpapi/handlers/session.ts)

Add pagination query parameters to the messages endpoint:
```typescript
// Existing: GET /sessions/:id/messages
// New: GET /sessions/:id/messages?pageSize=50&beforeId=xxx&beforeTime=yyy
```

This lets the TUI and ACP client load messages incrementally.

### 3. [MODIFY] Session resume path

The session processor's resume flow (in `processor.ts` and `compaction.ts`) currently calls `listForSession` which loads everything. For the LLM request, we need all messages (the model needs full context), so this stays unchanged. But for UI rendering, the paginated endpoint is used.

### 4. [NEW] `test/session/pagination.test.ts` (~100 lines)

| Test | Scenario | Expected |
|------|----------|----------|
| `first page loads latest N messages` | 100 messages, pageSize=20 | 20 latest messages |
| `cursor navigation loads next page` | Follow cursor | Next 20 messages |
| `last page has hasMore=false` | Reach end | `hasMore: false, cursor: undefined` |
| `parts are hydrated per page` | 3 messages with 5 parts each | Parts loaded only for page |
| `empty session returns empty page` | No messages | `{ messages: [], hasMore: false }` |
| `backward compat: listForSession unchanged` | 100 messages | All 100 returned in order |
| `pageSize=1 works` | Single message pages | Correct cursor chaining |

## Verification

```bash
# Run pagination tests
CI=true timeout 30s bun test test/session/pagination.test.ts --timeout 30000

# Typecheck
timeout 45s bun run typecheck

# Full test suite (ensure nothing regresses)
timeout 180s bun run test
```

## Architecture Notes

- The database uses `drizzle-orm` with `SqlClient` (Effect). All queries are in `Effect.gen` blocks.
- Cursor-based pagination is better than offset-based because messages can be inserted mid-page.
- The `toModelMessagesEffect` function (line 243) needs ALL messages — it builds the full LLM request. This is not paginated — only UI loading is paginated.
- The existing `older()` function (line 207) is the exact cursor comparison needed.
- The `hydrate()` function already handles subset hydration — just pass fewer message IDs.
- SQLite `LIMIT` + `ORDER BY` is efficient with the existing indexes on `session_id` and `time_created`.
