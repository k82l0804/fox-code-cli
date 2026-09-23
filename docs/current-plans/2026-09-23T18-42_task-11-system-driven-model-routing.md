# Task 11: System-Driven Model Routing

> **Status**: Ready for implementation
> **Implementer**: Gemini Flash 3.8 High
> **Depends on**: Task 9 (runtime tier reclassification), Task 10 (specialized subagents)
> **Estimated scope**: Medium — new function + integration into task tool model resolution chain

## Background

Currently, model selection for subagents is either user-explicit (via `agent_manager_models`) or inherited from the parent session. The system never autonomously picks a cheaper model even when the task clearly doesn't require frontier capabilities. This wastes tokens and money on trivial research or summarization subtasks.

### Existing Model Selection Chain

The current model resolution for subagents lives in [`src/foxcode/tool/task.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/tool/task.ts#L201-L264) (`FoxTask.defaults` → `FoxTask.resolveModel`):

1. `workflow` override (direct — agent config says use this model)
2. `saved` sticky state (TUI model picker persists to `agent-manager.json`)
3. `agent.model` (agent definition pins a model)
4. `subagent_model` (fox.jsonc `subagent_model` field)
5. Fallback: inherit parent's model

**None of these layers considers what the task actually *does*.** A research subtask and a multi-file implementation subtask both get the same model.

### Tier System Foundation

[`src/foxcode/model-tier.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/model-tier.ts) already provides:
- `ModelTier` types (S/A/B/C/D) with `TierInfo` metadata
- `TIER_META` with `codingReliable` and `maxSteps` per tier
- `resolveTier()` cascade for determining a model's tier
- `filterToolsByTier()` for capability gating

### Agent Workflow Types

[`packages/schema/src/workflow.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/schema/src/workflow.ts) defines `Workflow = "swe" | "data" | "research" | "shell" | "none" | "auto"`. Agents already declare their workflow:
- `scout`: `workflow: "research"` — read-only codebase exploration
- `runner`: `workflow: "research"` — execute tests, builds, diagnostics
- `scribe`: `workflow: "swe"` — file writes
- `explore`: `workflow: "research"` — codebase exploration (legacy)
- `code` (primary): no workflow (defaults to "swe"-like behavior)

### Small Model Selection

[`src/provider/provider.ts:1167`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/provider/provider.ts#L1167-L1209) provides `getSmallModel()` which finds the cheapest model from a provider using `smallModelFamilyPriority` (gemini-flash, gpt-nano, claude-haiku). This is already used for commit messages, branch names, enhanced prompts, and project copying.

## Proposed Changes

### New Function: `recommendModelForTask`

#### [NEW] `src/foxcode/model-routing.ts`

Create a new module that provides system-driven model recommendations based on task characteristics.

```typescript
import { type ModelTier, type TierInfo, TIER_META } from "./model-tier"

/** Minimum tier required for each workflow type */
export const WORKFLOW_TIER_REQUIREMENTS: Record<string, ModelTier> = {
  research: "C",   // Read-only exploration — any model works
  shell: "C",      // Command execution — minimal reasoning needed
  data: "B",       // Data analysis — moderate reasoning
  swe: "B",        // Code editing — needs reliable tool use
  none: "C",       // No workflow — minimal
  auto: "B",       // Auto-detect — assume moderate
}

export interface ModelRoutingInput {
  /** The workflow type of the target agent */
  readonly workflow: string | undefined
  /** Available models from the provider, with their resolved tiers */
  readonly availableModels: ReadonlyArray<{
    readonly providerID: string
    readonly modelID: string
    readonly tier: ModelTier
    readonly tierInfo: TierInfo
  }>
  /** The parent session's current model (fallback) */
  readonly parentModel: {
    readonly providerID: string
    readonly modelID: string
    readonly tier: ModelTier
  }
}

export interface ModelRoutingResult {
  /** The recommended model */
  readonly model: { providerID: string; modelID: string }
  /** Whether the system overrode the parent model */
  readonly routed: boolean
  /** Reason for the routing decision */
  readonly reason: string
}

/**
 * Recommend the cheapest viable model for a task based on workflow type.
 *
 * Rules:
 * 1. Determine the minimum tier needed for the agent's workflow
 * 2. If parent model's tier is at or below minimum, use parent (no savings)
 * 3. Otherwise, find the cheapest model at or above the minimum tier
 * 4. Prefer models from the same provider as the parent (avoid cross-provider)
 * 5. If no cheaper model found, fall back to parent
 */
export function recommendModelForTask(input: ModelRoutingInput): ModelRoutingResult {
  const minTier = WORKFLOW_TIER_REQUIREMENTS[input.workflow ?? "auto"] ?? "B"
  const minTierOrder = tierOrder(minTier)
  const parentTierOrder = tierOrder(input.parentModel.tier)

  // If the parent is already at or below the minimum tier, no savings possible
  if (parentTierOrder <= minTierOrder) {
    return {
      model: { providerID: input.parentModel.providerID, modelID: input.parentModel.modelID },
      routed: false,
      reason: `parent model (${input.parentModel.tier}) already at minimum tier (${minTier})`,
    }
  }

  // Find cheapest viable model, preferring same provider
  const viable = input.availableModels
    .filter((m) => tierOrder(m.tier) >= minTierOrder)
    .sort((a, b) => {
      // Sort by tier ascending (cheapest first)
      const tierDiff = tierOrder(a.tier) - tierOrder(b.tier)
      if (tierDiff !== 0) return tierDiff
      // Prefer same provider as parent
      const aMatch = a.providerID === input.parentModel.providerID ? 0 : 1
      const bMatch = b.providerID === input.parentModel.providerID ? 0 : 1
      return aMatch - bMatch
    })

  const cheapest = viable[0]
  if (!cheapest || tierOrder(cheapest.tier) >= parentTierOrder) {
    return {
      model: { providerID: input.parentModel.providerID, modelID: input.parentModel.modelID },
      routed: false,
      reason: `no cheaper model at tier ${minTier}+ available`,
    }
  }

  return {
    model: { providerID: cheapest.providerID, modelID: cheapest.modelID },
    routed: true,
    reason: `routed ${input.parentModel.tier} → ${cheapest.tier} for workflow "${input.workflow}"`,
  }
}

/** Numeric ordering: D=1, C=2, B=3, A=4, S=5 */
function tierOrder(tier: ModelTier): number {
  const ORDER: Record<ModelTier, number> = { D: 1, C: 2, B: 3, A: 4, S: 5 }
  return ORDER[tier] ?? 3
}
```

**Key design decisions**:
- Pure function, no Effect dependencies — can be tested in isolation
- `WORKFLOW_TIER_REQUIREMENTS` is a const map, easily adjustable without code changes
- Same-provider preference avoids cross-provider auth/routing issues
- Never routes *up* — only routes down (cheaper) or stays the same

### Integration Point

#### [MODIFY] [`src/foxcode/tool/task.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/tool/task.ts)

Add the routing step into the `FoxTask.defaults` function. The routing should act as an additional layer *after* all existing resolution but *before* returning the result, only when:
1. No user-explicit model override was provided
2. The `system_model_routing` config flag is enabled (default: `true`)
3. The agent has a declared `workflow`

In `FoxTask.defaults` (line ~201), after the fallback chain resolves a model, add:

```typescript
// After resolving the default model but before returning:
if (input.config.system_model_routing !== false && input.workflow) {
  // Build available models list from the provider
  const providerList = yield* input.provider.list()
  // ... build availableModels with tier info from resolveTier()
  const recommendation = recommendModelForTask({
    workflow: input.workflow,
    availableModels,
    parentModel: { ...resolvedModel, tier: resolveTier({ modelId: resolvedModel.modelID, providerId: resolvedModel.providerID }).tier },
  })
  if (recommendation.routed) {
    return { model: recommendation.model, variant: undefined }
  }
}
```

**Important**: The routing must yield to any explicit user override (model field in the task tool schema, subagent_model config, agent.model config, or saved sticky state). It should only activate when the model was inherited from the parent via fallback.

### Config Schema

#### [MODIFY] [`packages/core/src/v1/config/config.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/v1/config/config.ts)

Add a new config field:

```typescript
system_model_routing: Schema.optional(Schema.Boolean).annotate({
  description:
    "Enable system-driven model routing: automatically select cheaper models for research and diagnostic subtasks. Defaults to true.",
}),
```

Place it alongside the existing `subagent_model` / `subagent_variant` fields.

### Tests

#### [NEW] `test/model-routing.test.ts`

Unit tests for `recommendModelForTask`:

1. **Research workflow routes to cheapest viable model** — given parent=S model and available C/B/A models, recommends the C model
2. **SWE workflow requires at least B** — given parent=S and available C/B models, picks B not C
3. **No downgrade when parent already at minimum** — parent=C for research workflow → no routing
4. **Same-provider preference** — given two B-tier models from different providers, prefers the one matching parent
5. **No viable model → fallback** — no models at or above minimum tier → returns parent
6. **Unknown workflow defaults to B** — custom workflow name falls back to `"auto"` → tier B
7. **Config flag disabled → no routing** (integration-level test in task.ts)

### Edge Cases

1. **`getSmallModel` overlap**: `getSmallModel()` is a separate, simpler system. `recommendModelForTask` is richer (considers workflow requirements, available models, tier constraints). They should not conflict — `getSmallModel` is used for non-subagent auxiliary calls (commit messages, titles), while `recommendModelForTask` routes subagent tasks. If both are present, the task tool resolution chain naturally handles priority.

2. **Reclassification interaction**: If a model is reclassified C→B at runtime (Task 9), the routing decision should use the *original* resolved tier, not the reclassified one, to avoid feedback loops.

3. **Single-provider users**: Users with only one model available won't see any routing effect — the function correctly returns the parent model when no cheaper option exists.

## Verification Plan

### Automated Tests
```bash
timeout 30s CI=true bun test test/model-routing.test.ts
timeout 45s bun run typecheck
```

### Manual Verification
- Verify the routing function is pure and has no side effects
- Check that the task tool resolution chain correctly prioritizes explicit overrides over system routing

> **Refinement pass**: Completed 2026-09-23. Audit: WORKFLOW_TIER_REQUIREMENTS covers all 6 Workflow literals (swe, data, research, shell, none, auto). getSmallModel callers (commit-message, branch-name, enhance-prompt, title, project-copy) are all non-subagent — no overlap with task routing. No renames, no state-transition rules. No issues found.
