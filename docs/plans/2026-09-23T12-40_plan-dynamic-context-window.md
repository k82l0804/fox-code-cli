# Plan: Dynamic Context Window Discovery

> **Task**: Phase 2A #3 from [`current-tasks.md`](../master-plan/current-tasks.md)
> **Goal**: Query `/v1/models` (or provider-specific endpoints) for actual context window limits, feeding into compaction thresholds.

## Background

Today, context window limits are configured **statically** via:

1. **Model route defaults** in [`packages/llm/src/schema/options.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/llm/src/schema/options.ts#L124-L127):
   ```typescript
   export class ModelLimits extends Schema.Class<ModelLimits>("LLM.ModelLimits")({
     context: Schema.optional(Schema.Number),
     output: Schema.optional(Schema.Number),
   }) {}
   ```

2. **Compaction** in [`packages/core/src/session/compaction.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/session/compaction.ts#L172-L174):
   ```typescript
   const context = input.model.route.defaults.limits?.context
   if (context === undefined || context <= 0) return false
   ```

3. **App-level compaction** in [`src/session/compaction.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/compaction.ts) (706 lines) uses the same model limits.

The problem: when `limits.context` is undefined (which it is for many provider/model combinations), compaction **never triggers**, and the session overflows reactively.

## Proposed Changes

### 1. [NEW] `packages/llm/src/discovery.ts` (~80 lines)

New module for runtime model discovery:

```typescript
export interface DiscoveredModelLimits {
  readonly context?: number
  readonly output?: number
  readonly source: "api" | "static"
}

/**
 * Query a provider's /v1/models endpoint and extract context window limits.
 * Falls back to static limits if the endpoint is unavailable or doesn't
 * report limits.
 *
 * OpenAI format: model.context_window or model.max_tokens
 * Anthropic format: model.max_tokens (context), model.max_output_tokens
 * Google format: model.inputTokenLimit, model.outputTokenLimit
 */
export async function discoverModelLimits(
  baseUrl: string,
  modelId: string,
  apiKey?: string,
  staticLimits?: { context?: number; output?: number },
): Promise<DiscoveredModelLimits>
```

Implementation:
- `GET ${baseUrl}/models/${modelId}` with auth header
- Parse response for known limit fields (OpenAI, Anthropic, Google formats)
- Timeout: 5 seconds (this is a startup-time call, not per-request)
- Cache result for the session lifetime (no re-querying)
- If API fails or returns no limits, fall back to `staticLimits`

### 2. [NEW] `packages/llm/src/discovery-cache.ts` (~40 lines)

Simple in-memory cache keyed by `${baseUrl}:${modelId}`:

```typescript
const cache = new Map<string, DiscoveredModelLimits>()
export function getCached(key: string): DiscoveredModelLimits | undefined
export function setCached(key: string, limits: DiscoveredModelLimits): void
```

### 3. [MODIFY] [`packages/core/src/session/runner/model.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/session/runner/model.ts) (217 lines)

This is where the model is selected for a session. After resolving the model route, inject the discovered limits:

```typescript
// After resolving model route and before returning:
if (model.route.defaults.limits?.context === undefined) {
  const discovered = await discoverModelLimits(
    model.route.url,
    model.route.model,
    /* apiKey from provider */,
    { context: model.route.defaults.limits?.context },
  )
  if (discovered.context) {
    // Merge discovered limits into model defaults
    model = { ...model, route: { ...model.route, defaults: {
      ...model.route.defaults,
      limits: ModelLimits.make({ 
        context: discovered.context,
        output: discovered.output ?? model.route.defaults.limits?.output,
      }),
    }}}
  }
}
```

### 4. [MODIFY] [`packages/core/src/v1/config/config.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/v1/config/config.ts)

Add config option to disable discovery:

```typescript
// In the experimental section or top-level
discover_context_window: Schema.optional(Schema.Boolean).annotate({
  description: "Query /v1/models for context window limits at session start. Defaults to true.",
}),
```

### 5. [NEW] `packages/llm/test/discovery.test.ts` (~100 lines)

| Test | Scenario | Expected |
|------|----------|----------|
| `parses OpenAI format` | `{ context_window: 128000 }` | `{ context: 128000, source: "api" }` |
| `parses Anthropic format` | `{ max_tokens: 200000, max_output_tokens: 4096 }` | `{ context: 200000, output: 4096 }` |
| `parses Google format` | `{ inputTokenLimit: 1048576 }` | `{ context: 1048576 }` |
| `falls back on 404` | HTTP 404 | Returns static limits |
| `falls back on timeout` | No response within 5s | Returns static limits |
| `caches results` | Call twice for same model | Only 1 HTTP request |
| `no cache cross-talk` | Different models | Separate cache entries |

## Verification

```bash
# Run discovery tests
CI=true timeout 30s bun test packages/llm/test/discovery.test.ts --timeout 30000

# Typecheck
timeout 45s bun run typecheck

# Smoke
timeout 60s bun run test:smoke
```

## Architecture Notes

- Discovery is a **startup-time optimization**, not per-request. Call once when the session model is resolved.
- The LLM package (`packages/llm/`) has no Effect dependency — use plain `async/await` and `fetch`.
- Never fail the session if discovery fails — always fall back to static limits.
- LiteLLM proxy (our local setup) exposes `/v1/models` and includes context window info.
- The existing `model-profiles.json` static limits remain as the last-resort fallback.
