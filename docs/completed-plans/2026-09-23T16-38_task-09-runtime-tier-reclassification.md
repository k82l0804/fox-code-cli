# Task 9: Runtime Tier Reclassification

> **Status**: Ready for implementation
> **Implementer**: Gemini Flash 3.8 High
> **Depends on**: Task 8 (tool surface filtering wired), Model Capability Tier System (Phase 1)
> **Estimated scope**: Medium — pure functions exist and are tested, but wiring into the session loop requires careful placement

## Background

The reclassification functions are **fully implemented and tested** in [`src/foxcode/model-tier.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/model-tier.ts#L306-L369):

- [`TierReclassState`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/model-tier.ts#L314-L323) — state interface tracking current tier, original tier, consecutive failures, and reclassification status
- [`createReclassState(initial)`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/model-tier.ts#L328-L335) — creates initial state from resolved tier
- [`reclassifyOnSuccess(state)`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/model-tier.ts#L345-L352) — promotes C→B on first success, resets failure counter
- [`reclassifyOnFailure(state)`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/model-tier.ts#L362-L369) — demotes B→C after 2 consecutive failures

These are **imported but not called** in [`src/session/prompt/loop.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt/loop.ts#L67):
```typescript
import { ..., createReclassState, reclassifyOnSuccess, reclassifyOnFailure } from "@/foxcode/model-tier"
```

The config field [`dynamic_tier_reclassification`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/v1/config/config.ts#L118-L121) is already in the schema.

**What remains**: Wire the reclassification state into the session loop so that:
1. A `TierReclassState` is created at session start from the resolved `tierInfo`
2. After each tool call, `reclassifyOnSuccess` or `reclassifyOnFailure` is called
3. When reclassification changes the tier, the tool definition cache is invalidated (so `filterToolsByTier` runs with the new tier)
4. The `dynamic_tier_reclassification` config flag gates the entire mechanism

## Proposed Changes

### Session Loop Wiring

#### [MODIFY] [`src/session/prompt/loop.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt/loop.ts)

**Step 1: Initialize reclassification state outside the loop.**

Find the area where `tierInfo` is resolved (around line 299-305). After the `tierInfo` resolution, add state initialization. The state should be scoped to the session loop, not per-step:

```typescript
// After tierInfo is resolved (line 305):
let reclassState = createReclassState(tierInfo)
```

Wait — `tierInfo` is resolved _inside_ the loop on each step (it's after the `for (;;)` loop). So the reclassification state needs to be declared _outside_ the loop but initialized on the first iteration. Here's the precise wiring:

1. **Declare `reclassState`** outside the main `for (;;)` loop (near line 262 where other loop-scoped state like `toolDefCache` is declared):
   ```typescript
   let reclassState: import("@/foxcode/model-tier").TierReclassState | undefined
   ```

2. **Initialize on first iteration** inside the loop, right after `tierInfo` is resolved (line 305):
   ```typescript
   if (!reclassState) {
     reclassState = createReclassState(tierInfo)
   }
   ```

3. **Use `reclassState.current` instead of `tierInfo`** for:
   - The tool cache key (line 393): change `tierInfo.tier` to `reclassState.current.tier`
   - The `resolveDefinitions` call (line 400): change `tierInfo` to `reclassState.current`
   - The `computeMaxSteps` call (line 324): change `tierInfo` to `reclassState.current`
   - Keep the original `tierInfo` for `shouldRefuseCoding` and `shouldWarnCoding` — those should use the _original_ tier, not the reclassified one

**Step 2: Detect tool call success/failure and update state.**

The loop processes the LLM response and tool calls. After each tool call completes, determine success or failure.

Look for where tool call results are processed in the loop. The AI SDK `generateText`/`streamText` result contains tool call results. The key integration point is after `handle.completeToolCall` or within the `finish` callback in `SessionTools.bindExecutionContext`.

The cleanest integration point is in the main loop's step processing, after all tool calls for a step have completed. Look for where `step++` happens or where the loop decides to continue:

- If any tool call in the step threw an error → `reclassifyOnFailure`
- If all tool calls in the step succeeded → `reclassifyOnSuccess`

Check `cfg.dynamic_tier_reclassification !== false` before applying reclassification (default: enabled).

```typescript
// After tool calls are processed, before the next loop iteration:
if (cfg.dynamic_tier_reclassification !== false && reclassState) {
  const oldTier = reclassState.current.tier
  reclassState = toolCallFailed
    ? reclassifyOnFailure(reclassState)
    : reclassifyOnSuccess(reclassState)
  if (reclassState.current.tier !== oldTier) {
    // Invalidate tool cache so filterToolsByTier re-runs with new tier
    toolDefCache = undefined
  }
}
```

**Step 3: Determine `toolCallFailed`.**

The loop already tracks whether a tool call failed. Look at how the outcome is determined in the step processing. The typical pattern is:

- The `streamText`/`generateText` call returns
- Tool results are checked for errors
- If a tool threw, the error is caught and reported

The simplest approach: track a boolean `toolCallFailed` per-step. Set it to `true` if any tool call's execution threw an error. The error handling in `bindExecutionContext` already catches tool errors — the question is whether the error surfaces to the loop.

**Implementation note for the implementer**: Search for where tool call errors are caught in the loop (look for `Effect.orDie`, `Effect.catchAll`, or error handling near tool execution). The reclassification check should go _after_ the step's tool results are finalized but _before_ the loop continues. If the exact error-tracking mechanism is unclear, add a `let stepHadToolFailure = false` flag and set it in the tool execution error handler.

### Tests

#### [MODIFY] `test/model-tier.test.ts`

The pure functions (`createReclassState`, `reclassifyOnSuccess`, `reclassifyOnFailure`) already have 14 tests. Add integration-level tests:

1. **Reclassification state uses current tier for tool cache key** — verify that when reclassState changes from C→B, a new tool cache key is generated (different from the original)
2. **Config flag disables reclassification** — verify that `dynamic_tier_reclassification: false` prevents any state changes
3. **Multiple successes don't double-promote** — C→B on first success, B stays B on subsequent successes
4. **Demotion requires exactly 2 failures** — B stays B after 1 failure, demotes to C after 2
5. **Success after 1 failure resets counter** — B with 1 failure, then success → counter resets to 0, stays B

**Minimum required: 5 new tests.** (Some may overlap with existing tests — check before adding duplicates.)

### Documentation

#### [MODIFY] `src/foxcode/skills/fox-config.md`

Add `dynamic_tier_reclassification` to the "Other Top-Level Fields" table:

| Field | Type | Description |
|---|---|---|
| `dynamic_tier_reclassification` | `boolean` | Runtime C↔B tier promotion/demotion. Default: `true` |

## Key Architectural Decisions

1. **Reclassification state is per-session, not persisted.** A new session always starts with the resolved tier. This prevents a bad reclassification from permanently affecting future sessions.

2. **Only C↔B transitions.** S, A, and D tiers are never changed. S/A models don't need reclassification; D models are too limited to promote.

3. **Tool cache invalidation on tier change.** When reclassification changes the tier, `toolDefCache` must be set to `undefined` so that `resolveDefinitions` runs again with the new tier, producing a different tool set.

4. **Original tier for safety checks.** `shouldRefuseCoding` and `shouldWarnCoding` use the _original_ tier, not the reclassified one. A C model that got promoted to B should still show the coding warning.

## Verification Plan

### Automated Tests

```bash
timeout 30s CI=true bun test test/model-tier.test.ts
timeout 45s bun run typecheck
timeout 60s bun run test:smoke
```

### Manual Verification

None required for pure function wiring — the existing test suite validates behavior. Full integration testing (running a Tier C model and observing promotion) is deferred to manual QA.
