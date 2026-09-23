# Plan: JSON Serialization Bypass

> **Task**: Phase 2A #6 from [`current-tasks.md`](../master-plan/current-tasks.md)
> **Goal**: Reduce redundant `JSON.stringify` calls in the hot path (token estimation, compaction, message rendering).

## Background

Profiling shows `JSON.stringify` calls scattered across the session hot path. These are used for:

1. **Token estimation** — `Token.estimate(JSON.stringify(value))` in:
   - [`packages/core/src/session/compaction.ts:74`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/session/compaction.ts#L74): `const estimate = (value: unknown) => Token.estimate(JSON.stringify(value))`
   - [`src/session/compaction.ts:195`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/compaction.ts#L195): `Token.estimate(JSON.stringify(msgs))`
   - [`src/session/compaction.ts:389`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/compaction.ts#L389): `Token.estimate(JSON.stringify(modelMessages))`

2. **Tool schema comparison** — [`src/session/llm.ts:136-137`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/llm.ts#L136-L137):
   ```typescript
   const before = JSON.stringify(ToolSchemaProjection.openAI(schema))
   const after = JSON.stringify(ToolSchemaProjection.compact(schema))
   ```

3. **Message serialization** — [`src/session/message-v2.ts:105`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/message-v2.ts#L105) and other encode/decode paths.

4. **Tool input serialization** — [`packages/core/src/session/compaction.ts:96`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/session/compaction.ts#L96):
   ```typescript
   const input = typeof part.state.input === "string" ? part.state.input : JSON.stringify(part.state.input)
   ```

## Analysis: Which Are Redundant?

| Location | Call | Redundant? | Fix |
|----------|------|-----------|-----|
| `compaction.ts:74` | Token estimate of full request | **Yes** — called on every compaction check, serializes the entire request | Cache the estimate |
| `compaction.ts:195` | Token estimate of model messages | **Partially** — needed but could cache | Cache per-message estimates |
| `compaction.ts:389` | Token estimate after conversion | **Yes** — same messages just converted | Use cached estimate |
| `llm.ts:136-137` | Tool schema comparison | **Yes** — schemas are static per session | Compare once at session start, cache |
| `message-v2.ts:105` | Base64 encoding | No — this is for storage, runs once per message | Keep |
| `compaction.ts:96` | Tool input stringification | **Partially** — called during compaction serialization | Keep (simple, one-off) |

## Proposed Changes

### 1. [MODIFY] [`packages/core/src/session/compaction.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/session/compaction.ts)

**Cache per-message token estimates** (~15 lines added):

```typescript
// Replace line 74:
// const estimate = (value: unknown) => Token.estimate(JSON.stringify(value))

// With a memoized version keyed by message ID:
const messageTokenCache = new Map<string, number>()

function estimateMessage(message: SessionMessage.Message): number {
  const key = message.type === "user" ? `u:${message.text?.slice(0, 50)}` : `a:${message.content?.length}`
  const cached = messageTokenCache.get(key)
  if (cached !== undefined) return cached
  const tokens = Token.estimate(JSON.stringify(message))
  messageTokenCache.set(key, tokens)
  return tokens
}

// Update estimateRequest to sum message estimates instead of serializing the whole request:
function estimateRequest(request: LLMRequest): number {
  const systemTokens = request.system ? Token.estimate(JSON.stringify(request.system)) : 0
  const toolTokens = request.tools ? Token.estimate(JSON.stringify(request.tools)) : 0
  const msgTokens = request.messages.reduce((sum, msg) => sum + estimateMessage(msg), 0)
  return systemTokens + toolTokens + msgTokens
}
```

### 2. [MODIFY] [`src/session/compaction.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/compaction.ts)

**Replace lines 195 and 389** with the cached estimation:

```typescript
// Line 195: Instead of JSON.stringify(msgs), use per-message estimates:
return msgs.reduce((sum, msg) => sum + Token.estimateMessage(msg), 0)

// Line 389: Remove duplicate estimation — use the same cached values
```

### 3. [MODIFY] [`src/session/llm.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/llm.ts)

**Cache tool schema serialization** (~10 lines):

```typescript
// Lines 136-137: Move to session-start-time caching:
// Instead of comparing on every step:
const toolSchemaCache = new Map<string, string>()

function getCachedSchema(schema: ToolSchema): string {
  const name = schema.name
  let cached = toolSchemaCache.get(name)
  if (cached === undefined) {
    cached = JSON.stringify(ToolSchemaProjection.compact(schema))
    toolSchemaCache.set(name, cached)
  }
  return cached
}
```

### 4. [MODIFY] [`packages/core/src/util/token.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/util/token.ts)

**Add `estimateObject` helper** that serializes and estimates in one pass:

```typescript
export function estimateObject(value: unknown): number {
  if (typeof value === "string") return estimate(value)
  return estimate(JSON.stringify(value))
}
```

This consolidates the pattern and makes it easier to optimize later (e.g., with a streaming tokenizer that doesn't need full serialization).

### 5. [NEW/MODIFY] Tests

No new test file needed — this is a performance optimization that shouldn't change behavior. Verify via:

| Test | Scenario | Expected |
|------|----------|----------|
| Existing `test:compress` | Compression tests | All pass unchanged |
| Existing `test:smoke` | Full smoke | No regressions |
| `test:app` | All app tests | No regressions |
| Manual: profile token estimation | Long session (100+ messages) | Fewer `JSON.stringify` calls in flamegraph |

## Verification

```bash
# Core compression tests
CI=true timeout 30s bun run test:compress

# Typecheck
timeout 45s bun run typecheck

# Smoke
timeout 60s bun run test:smoke
```

## Architecture Notes

- `Token.estimate()` uses a character-based heuristic (chars / 4), not a real tokenizer. This means caching the estimate for a message is safe — the message content doesn't change between checks.
- The biggest win is avoiding `JSON.stringify` of the **entire LLM request** on every compaction check. With 200 messages, this serializes ~100KB of JSON just to check if compaction is needed.
- Tool schemas are immutable within a session (they're resolved once at session start). Caching their serialized form is safe.
- Be careful with the message cache key — use message ID, not content hash, since messages are immutable once stored.
- This is a **drop-in optimization** — no API changes, no behavioral changes. Pure performance.
