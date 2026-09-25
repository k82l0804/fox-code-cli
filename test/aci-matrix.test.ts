import { describe, expect, test } from "bun:test"
import {
  resolveTier,
  filterToolsByTier,
  TIER_TOOL_SURFACE,
  EXCLUDED_FROM_ALL_TIERS,
  KNOWN_BUILTIN_TOOLS,
  type ModelTier,
} from "@/foxcode/model-tier"

describe("ACI Tool Surface Matrix (Phase 2E Task 2E-4)", () => {
  const ALL_BUILTINS: string[] = Array.from(KNOWN_BUILTIN_TOOLS)
  const mockTools = (ids: string[]): Array<{ id: string; description: string }> =>
    ids.map((id) => ({ id, description: `Tool ${id}` }))

  test("Tier S sees canonical 8 tools", () => {
    const tier = resolveTier({ overrideTier: "S" })
    const filtered = filterToolsByTier(mockTools(ALL_BUILTINS), tier)
    const ids = new Set(filtered.map((t) => t.id))
    expect(ids).toEqual(
      new Set(["edit", "rewrite_file", "read", "grep", "glob", "lsp", "bash", "lookup_symbols"]),
    )
  })

  test("Tier A sees canonical 8 tools", () => {
    const tier = resolveTier({ overrideTier: "A" })
    const filtered = filterToolsByTier(mockTools(ALL_BUILTINS), tier)
    const ids = new Set(filtered.map((t) => t.id))
    expect(ids).toEqual(
      new Set(["edit", "rewrite_file", "read", "grep", "glob", "lsp", "bash", "lookup_symbols"]),
    )
  })

  test("Tier B sees canonical 7 tools (no lookup_symbols)", () => {
    const tier = resolveTier({ overrideTier: "B" })
    const filtered = filterToolsByTier(mockTools(ALL_BUILTINS), tier)
    const ids = new Set(filtered.map((t) => t.id))
    expect(ids).toEqual(
      new Set(["edit", "rewrite_file", "read", "grep", "glob", "lsp", "bash"]),
    )
    expect(ids.has("lookup_symbols")).toBe(false)
  })

  test("Tier C sees only grep and bash", () => {
    const tier = resolveTier({ overrideTier: "C" })
    const filtered = filterToolsByTier(mockTools(ALL_BUILTINS), tier)
    const ids = new Set(filtered.map((t) => t.id))
    expect(ids).toEqual(new Set(["grep", "bash"]))
  })

  test("Tier D sees only grep and bash", () => {
    const tier = resolveTier({ overrideTier: "D" })
    const filtered = filterToolsByTier(mockTools(ALL_BUILTINS), tier)
    const ids = new Set(filtered.map((t) => t.id))
    expect(ids).toEqual(new Set(["grep", "bash"]))
  })

  test("apply_patch, write, commit, fetch_repo_map are excluded from ALL tiers", () => {
    const tiers: ModelTier[] = ["S", "A", "B", "C", "D"]
    for (const t of tiers) {
      const tier = resolveTier({ overrideTier: t })
      const filtered = filterToolsByTier(mockTools(ALL_BUILTINS), tier)
      const ids = new Set(filtered.map((tool) => tool.id))
      for (const excluded of EXCLUDED_FROM_ALL_TIERS) {
        expect(ids.has(excluded)).toBe(false)
      }
    }
  })

  test("Custom plugin tools pass through filter for all tiers", () => {
    const custom = mockTools(["my_company_linter", "custom_deploy"])
    const tier = resolveTier({ overrideTier: "C" })
    const filtered = filterToolsByTier(custom, tier)
    expect(filtered.map((t) => t.id)).toEqual(["my_company_linter", "custom_deploy"])
  })

  test("Tier-routing prompt serialization: LLM tool payload exact tool name set matches TIER_TOOL_SURFACE[tier]", () => {
    const tiers: ModelTier[] = ["S", "A", "B", "C", "D"]
    for (const t of tiers) {
      const tierInfo = resolveTier({ overrideTier: t })
      const filtered = filterToolsByTier(mockTools(ALL_BUILTINS), tierInfo)
      // Simulate serializing to LLM request tool payload format
      const serializedPayload = {
        tools: filtered.map((item) => ({
          type: "function",
          function: {
            name: item.id,
            description: item.description,
          },
        })),
      }

      const parsedToolNames = new Set(serializedPayload.tools.map((entry) => entry.function.name))
      expect(parsedToolNames).toEqual(TIER_TOOL_SURFACE[t])
    }
  })
})
