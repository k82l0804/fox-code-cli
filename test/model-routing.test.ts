import { describe, expect, test } from "bun:test"
import { recommendModelForTask, WORKFLOW_TIER_REQUIREMENTS, type ModelRoutingInput } from "@/foxcode/model-routing"
import { TIER_META } from "@/foxcode/model-tier"

describe("model-routing", () => {
  const makeModel = (providerID: string, modelID: string, tier: "S" | "A" | "B" | "C" | "D") => ({
    providerID,
    modelID,
    tier,
    tierInfo: {
      tier,
      ...TIER_META[tier],
      source: "profile" as const,
    },
  })

  test("workflow tier requirements covers expected workflows", () => {
    expect(WORKFLOW_TIER_REQUIREMENTS.research).toBe("C")
    expect(WORKFLOW_TIER_REQUIREMENTS.shell).toBe("C")
    expect(WORKFLOW_TIER_REQUIREMENTS.data).toBe("B")
    expect(WORKFLOW_TIER_REQUIREMENTS.swe).toBe("B")
    expect(WORKFLOW_TIER_REQUIREMENTS.none).toBe("C")
    expect(WORKFLOW_TIER_REQUIREMENTS.auto).toBe("B")
  })

  test("1. research workflow routes to cheapest viable model (Tier C)", () => {
    const input: ModelRoutingInput = {
      workflow: "research",
      parentModel: { providerID: "openai", modelID: "gpt-4o", tier: "S" },
      availableModels: [
        makeModel("openai", "gpt-4o", "S"),
        makeModel("openai", "gpt-4o-mini", "B"),
        makeModel("openai", "gpt-3.5-turbo", "C"),
      ],
    }

    const result = recommendModelForTask(input)
    expect(result.routed).toBe(true)
    expect(result.model.providerID).toBe("openai")
    expect(result.model.modelID).toBe("gpt-3.5-turbo")
    expect(result.reason).toContain("routed S → C")
  })

  test("2. swe workflow requires at least B (picks B not C)", () => {
    const input: ModelRoutingInput = {
      workflow: "swe",
      parentModel: { providerID: "anthropic", modelID: "claude-3-5-sonnet", tier: "S" },
      availableModels: [
        makeModel("anthropic", "claude-3-5-sonnet", "S"),
        makeModel("anthropic", "claude-3-5-haiku", "B"),
        makeModel("anthropic", "claude-legacy-basic", "C"),
      ],
    }

    const result = recommendModelForTask(input)
    expect(result.routed).toBe(true)
    expect(result.model.providerID).toBe("anthropic")
    expect(result.model.modelID).toBe("claude-3-5-haiku")
    expect(result.reason).toContain("routed S → B")
  })

  test("3. no downgrade when parent already at minimum tier", () => {
    const input: ModelRoutingInput = {
      workflow: "research",
      parentModel: { providerID: "openai", modelID: "gpt-3.5-turbo", tier: "C" },
      availableModels: [
        makeModel("openai", "gpt-4o", "S"),
        makeModel("openai", "gpt-3.5-turbo", "C"),
      ],
    }

    const result = recommendModelForTask(input)
    expect(result.routed).toBe(false)
    expect(result.model.modelID).toBe("gpt-3.5-turbo")
    expect(result.reason).toContain("already at minimum tier")
  })

  test("4. same-provider preference among same-tier models", () => {
    const input: ModelRoutingInput = {
      workflow: "swe",
      parentModel: { providerID: "google", modelID: "gemini-1.5-pro", tier: "S" },
      availableModels: [
        makeModel("openai", "gpt-4o-mini", "B"),
        makeModel("google", "gemini-1.5-flash", "B"),
      ],
    }

    const result = recommendModelForTask(input)
    expect(result.routed).toBe(true)
    expect(result.model.providerID).toBe("google")
    expect(result.model.modelID).toBe("gemini-1.5-flash")
  })

  test("5. fallback to parent when no viable cheaper model available", () => {
    const input: ModelRoutingInput = {
      workflow: "swe",
      parentModel: { providerID: "openai", modelID: "gpt-4o", tier: "A" },
      availableModels: [
        makeModel("openai", "gpt-4o", "A"),
        // Only C tier available, but swe requires B+
        makeModel("openai", "gpt-3.5-turbo", "C"),
      ],
    }

    const result = recommendModelForTask(input)
    expect(result.routed).toBe(false)
    expect(result.model.modelID).toBe("gpt-4o")
    expect(result.reason).toContain("no cheaper model")
  })

  test("6. unknown workflow defaults to auto (tier B)", () => {
    const input: ModelRoutingInput = {
      workflow: "unknown-custom-workflow",
      parentModel: { providerID: "anthropic", modelID: "claude-opus", tier: "S" },
      availableModels: [
        makeModel("anthropic", "claude-haiku", "B"),
        makeModel("anthropic", "claude-nano", "C"),
      ],
    }

    const result = recommendModelForTask(input)
    expect(result.routed).toBe(true)
    expect(result.model.modelID).toBe("claude-haiku")
    expect(result.reason).toContain("routed S → B")
  })

  test("7. empty available models falls back to parent", () => {
    const input: ModelRoutingInput = {
      workflow: "research",
      parentModel: { providerID: "openai", modelID: "gpt-4o", tier: "S" },
      availableModels: [],
    }

    const result = recommendModelForTask(input)
    expect(result.routed).toBe(false)
    expect(result.model.modelID).toBe("gpt-4o")
  })

  test("8. suggestedMinTier overrides workflow minimum when higher", () => {
    const input: ModelRoutingInput = {
      workflow: "research", // research min is C
      suggestedMinTier: "A", // intent suggests A (higher than C)
      parentModel: { providerID: "openai", modelID: "gpt-4o", tier: "S" },
      availableModels: [
        makeModel("openai", "gpt-4o", "S"),
        makeModel("openai", "gpt-4o-mini", "A"),
        makeModel("openai", "gpt-3.5-turbo", "C"),
      ],
    }

    const result = recommendModelForTask(input)
    expect(result.routed).toBe(true)
    expect(result.model.providerID).toBe("openai")
    expect(result.model.modelID).toBe("gpt-4o-mini")
    expect(result.reason).toContain("routed S → A")
  })

  test("9. suggestedMinTier ignored when lower than workflow minimum", () => {
    const input: ModelRoutingInput = {
      workflow: "swe", // swe min is B
      suggestedMinTier: "C", // intent suggests C (lower than B)
      parentModel: { providerID: "openai", modelID: "gpt-4o", tier: "S" },
      availableModels: [
        makeModel("openai", "gpt-4o", "S"),
        makeModel("openai", "gpt-4o-mini", "B"),
        makeModel("openai", "gpt-3.5-turbo", "C"),
      ],
    }

    const result = recommendModelForTask(input)
    expect(result.routed).toBe(true)
    expect(result.model.providerID).toBe("openai")
    expect(result.model.modelID).toBe("gpt-4o-mini")
    expect(result.reason).toContain("routed S → B")
  })
})

