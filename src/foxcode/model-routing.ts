import { type ModelTier, type TierInfo } from "./model-tier"

/** Minimum tier required for each workflow type */
export const WORKFLOW_TIER_REQUIREMENTS: Record<string, ModelTier> = {
  research: "C", // Read-only exploration — any model works
  shell: "C", // Command execution — minimal reasoning needed
  data: "B", // Data analysis — moderate reasoning
  swe: "B", // Code editing — needs reliable tool use
  none: "C", // No workflow — minimal
  auto: "B", // Auto-detect — assume moderate
}

export interface ModelRoutingInput {
  /** The workflow type of the target agent */
  readonly workflow: string | undefined
  /** Optional suggested minimum tier from intent detection */
  readonly suggestedMinTier?: ModelTier
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

/** Numeric ordering: D=1, C=2, B=3, A=4, S=5 */
function tierOrder(tier: ModelTier): number {
  const ORDER: Record<ModelTier, number> = { D: 1, C: 2, B: 3, A: 4, S: 5 }
  return ORDER[tier] ?? 3
}

/**
 * Recommend the cheapest viable model for a task based on workflow type and intent.
 *
 * Rules:
 * 1. Determine the minimum tier needed for the agent's workflow (or suggested from intent)
 * 2. If parent model's tier is at or below minimum, use parent (no savings)
 * 3. Otherwise, find the cheapest model at or above the minimum tier
 * 4. Prefer models from the same provider as the parent (avoid cross-provider)
 * 5. If no cheaper model found, fall back to parent
 */
export function recommendModelForTask(input: ModelRoutingInput): ModelRoutingResult {
  const workflowMin = (input.workflow ? WORKFLOW_TIER_REQUIREMENTS[input.workflow] : undefined) ?? WORKFLOW_TIER_REQUIREMENTS["auto"] ?? "B"
  const minTier = input.suggestedMinTier && tierOrder(input.suggestedMinTier) > tierOrder(workflowMin)
    ? input.suggestedMinTier
    : workflowMin
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
      if (aMatch !== bMatch) return aMatch - bMatch
      return a.modelID.localeCompare(b.modelID)
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
