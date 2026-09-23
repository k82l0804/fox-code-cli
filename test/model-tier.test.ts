import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import {
  extractParamCount,
  tierFromParams,
  TIER_META,
  FRONTIER_PROVIDERS,
  resolveTier,
  computeMaxSteps,
  shouldWarnCoding,
  shouldRefuseCoding,
  filterToolsByTier,
  createReclassState,
  reclassifyOnSuccess,
  reclassifyOnFailure,
  TIER_SAFE_TOOLS,
  TIER_COMPLEX_TOOLS,
  type ModelTier,
} from "@/foxcode/model-tier"
import MODEL_PROFILES_DATA from "@/session/prompt/model-profiles.json"
import { listProfiles, getProfile } from "@/session/prompt/model-profile"

describe("Model Capability Tier System", () => {
  // -------------------------------------------------------------------------
  // Category 1: Parameter Extraction (extractParamCount)
  // -------------------------------------------------------------------------
  describe("Category 1: Parameter Extraction (extractParamCount)", () => {
    test("extracts standard suffix: llama-3.1-8b-instruct", () => {
      expect(extractParamCount("llama-3.1-8b-instruct")).toBe(8)
    })

    test("extracts large model: llama-3.3-70b-instruct", () => {
      expect(extractParamCount("llama-3.3-70b-instruct")).toBe(70)
    })

    test("extracts Gemma family: gemma-4-27b", () => {
      expect(extractParamCount("gemma-4-27b")).toBe(27)
    })

    test("extracts decimal params: phi-4-mini-3.8b", () => {
      expect(extractParamCount("phi-4-mini-3.8b")).toBe(3.8)
    })

    test("extracts Ollama colon tag: llama3.1:8b", () => {
      expect(extractParamCount("llama3.1:8b")).toBe(8)
    })

    test("extracts Ollama with quant: llama3.1:70b-instruct-q4_K_M", () => {
      expect(extractParamCount("llama3.1:70b-instruct-q4_K_M")).toBe(70)
    })

    test("extracts MoE notation: mixtral-8x7b", () => {
      expect(extractParamCount("mixtral-8x7b")).toBe(56)
    })

    test("extracts OpenRouter path: meta-llama/llama-3.1-8b-instruct", () => {
      expect(extractParamCount("meta-llama/llama-3.1-8b-instruct")).toBe(8)
    })

    test("extracts GPT-OSS explicit: gpt-oss-120b", () => {
      expect(extractParamCount("gpt-oss-120b")).toBe(120)
    })

    test("extracts Qwen family: qwen2.5-72b-instruct", () => {
      expect(extractParamCount("qwen2.5-72b-instruct")).toBe(72)
    })

    test("returns undefined for no params (frontier): gpt-5", () => {
      expect(extractParamCount("gpt-5")).toBeUndefined()
    })

    test("returns undefined for no params (API): claude-sonnet-4-20250514", () => {
      expect(extractParamCount("claude-sonnet-4-20250514")).toBeUndefined()
    })

    test("returns undefined for no params (unknown): my-custom-model", () => {
      expect(extractParamCount("my-custom-model")).toBeUndefined()
    })

    test("returns undefined for version-like false positive: llama-3.1", () => {
      expect(extractParamCount("llama-3.1")).toBeUndefined()
    })

    test("extracts edge: 1B model: tinyllama-1b", () => {
      expect(extractParamCount("tinyllama-1b")).toBe(1)
    })
  })

  // -------------------------------------------------------------------------
  // Category 2: Tier Classification (tierFromParams)
  // -------------------------------------------------------------------------
  describe("Category 2: Tier Classification (tierFromParams)", () => {
    test("classifies frontier large 405B as Tier S", () => {
      expect(tierFromParams(405)).toBe("S")
    })

    test("classifies exact boundary 70B as Tier S", () => {
      expect(tierFromParams(70)).toBe("S")
    })

    test("classifies just below S (69B) as Tier A", () => {
      expect(tierFromParams(69)).toBe("A")
    })

    test("classifies mid A (35B) as Tier A", () => {
      expect(tierFromParams(35)).toBe("A")
    })

    test("classifies exact boundary 30B as Tier A", () => {
      expect(tierFromParams(30)).toBe("A")
    })

    test("classifies just below A (29B) as Tier B", () => {
      expect(tierFromParams(29)).toBe("B")
    })

    test("classifies mid B (14B) as Tier B", () => {
      expect(tierFromParams(14)).toBe("B")
    })

    test("classifies exact boundary 13B as Tier B", () => {
      expect(tierFromParams(13)).toBe("B")
    })

    test("classifies just below B (12B) as Tier C", () => {
      expect(tierFromParams(12)).toBe("C")
    })

    test("classifies mid C (8B) as Tier C", () => {
      expect(tierFromParams(8)).toBe("C")
    })

    test("classifies exact boundary 7B as Tier C", () => {
      expect(tierFromParams(7)).toBe("C")
    })

    test("classifies just below C (6B) as Tier D", () => {
      expect(tierFromParams(6)).toBe("D")
    })

    test("classifies tiny model (1.5B) as Tier D", () => {
      expect(tierFromParams(1.5)).toBe("D")
    })
  })

  // -------------------------------------------------------------------------
  // Category 3: Tier Metadata (TIER_META)
  // -------------------------------------------------------------------------
  describe("Category 3: Tier Metadata (TIER_META)", () => {
    test("contains all 5 tiers (S, A, B, C, D)", () => {
      const keys = Object.keys(TIER_META) as ModelTier[]
      expect(keys.sort()).toEqual(["A", "B", "C", "D", "S"])
    })

    test("has correct maxSteps per tier", () => {
      expect(TIER_META.S.maxSteps).toBe(Infinity)
      expect(TIER_META.A.maxSteps).toBe(Infinity)
      expect(TIER_META.B.maxSteps).toBe(5)
      expect(TIER_META.C.maxSteps).toBe(3)
      expect(TIER_META.D.maxSteps).toBe(1)
    })

    test("has correct codingReliable per tier", () => {
      expect(TIER_META.S.codingReliable).toBe(true)
      expect(TIER_META.A.codingReliable).toBe(true)
      expect(TIER_META.B.codingReliable).toBe(true)
      expect(TIER_META.C.codingReliable).toBe(false)
      expect(TIER_META.D.codingReliable).toBe(false)
    })

    test("has correct warnOnCoding per tier", () => {
      expect(TIER_META.S.warnOnCoding).toBe(false)
      expect(TIER_META.A.warnOnCoding).toBe(false)
      expect(TIER_META.B.warnOnCoding).toBe(false)
      expect(TIER_META.C.warnOnCoding).toBe(true)
      expect(TIER_META.D.warnOnCoding).toBe(true)
    })

    test("each tier has a non-empty label string", () => {
      for (const tier of ["S", "A", "B", "C", "D"] as const) {
        expect(typeof TIER_META[tier].label).toBe("string")
        expect(TIER_META[tier].label.length).toBeGreaterThan(0)
      }
    })
  })

  // -------------------------------------------------------------------------
  // Category 4: Resolution Priority Chain (resolveTier)
  // -------------------------------------------------------------------------
  describe("Category 4: Resolution Priority Chain (resolveTier)", () => {
    const origEnv = process.env.FOX_MODEL_TIER

    afterEach(() => {
      if (origEnv === undefined) {
        delete process.env.FOX_MODEL_TIER
      } else {
        process.env.FOX_MODEL_TIER = origEnv
      }
    })

    // 4a. Override (highest priority)
    describe("4a. Override (highest priority)", () => {
      test("config override forces S", () => {
        const res = resolveTier({ overrideTier: "S", modelId: "llama-3.1-8b" })
        expect(res.tier).toBe("S")
        expect(res.source).toBe("override")
      })

      test("env var override forces A", () => {
        process.env.FOX_MODEL_TIER = "A"
        const res = resolveTier({ modelId: "phi-4-mini-3.8b" })
        expect(res.tier).toBe("A")
        expect(res.source).toBe("override")
      })

      test("config override wins over env var", () => {
        process.env.FOX_MODEL_TIER = "S"
        const res = resolveTier({ overrideTier: "B", modelId: "llama-3.1-8b" })
        expect(res.tier).toBe("B")
        expect(res.source).toBe("override")
      })

      test("invalid override is ignored and falls through to pattern", () => {
        delete process.env.FOX_MODEL_TIER
        const res = resolveTier({ overrideTier: "X", modelId: "qwen2.5-32b-instruct" })
        expect(res.tier).toBe("A")
        expect(res.source).toBe("pattern")
      })
    })

    // 4b. Profile tier (second priority)
    describe("4b. Profile tier (second priority)", () => {
      test("profiled model with tier resolves from profile", () => {
        delete process.env.FOX_MODEL_TIER
        const res = resolveTier({ profileTier: "S", modelId: "nemotron" })
        expect(res.tier).toBe("S")
        expect(res.source).toBe("profile")
      })

      test("profile tier overrides pattern extraction", () => {
        delete process.env.FOX_MODEL_TIER
        const res = resolveTier({ profileTier: "A", modelId: "some-8b-model" })
        expect(res.tier).toBe("A")
        expect(res.source).toBe("profile")
      })
    })

    // 4c. Pattern extraction (third priority)
    describe("4c. Pattern extraction (third priority)", () => {
      beforeEach(() => {
        delete process.env.FOX_MODEL_TIER
      })

      test("8B model -> Tier C", () => {
        const res = resolveTier({ modelId: "llama-3.1-8b-instruct" })
        expect(res.tier).toBe("C")
        expect(res.source).toBe("pattern")
      })

      test("70B model -> Tier S", () => {
        const res = resolveTier({ modelId: "llama-3.3-70b-instruct" })
        expect(res.tier).toBe("S")
        expect(res.source).toBe("pattern")
      })

      test("32B model -> Tier A", () => {
        const res = resolveTier({ modelId: "qwen2.5-32b-instruct" })
        expect(res.tier).toBe("A")
        expect(res.source).toBe("pattern")
      })

      test("14B model -> Tier B", () => {
        const res = resolveTier({ modelId: "qwen2.5-14b-instruct" })
        expect(res.tier).toBe("B")
        expect(res.source).toBe("pattern")
      })

      test("3.8B model -> Tier D", () => {
        const res = resolveTier({ modelId: "phi-4-mini-3.8b" })
        expect(res.tier).toBe("D")
        expect(res.source).toBe("pattern")
      })
    })

    // 4d. Frontier provider heuristic (fallback)
    describe("4d. Frontier provider heuristic (fallback)", () => {
      beforeEach(() => {
        delete process.env.FOX_MODEL_TIER
      })

      test("OpenAI defaults to Tier S", () => {
        const res = resolveTier({ modelId: "gpt-5", providerId: "openai" })
        expect(res.tier).toBe("S")
        expect(res.source).toBe("heuristic")
      })

      test("Anthropic defaults to Tier S", () => {
        const res = resolveTier({ modelId: "claude-sonnet-4", providerId: "anthropic" })
        expect(res.tier).toBe("S")
        expect(res.source).toBe("heuristic")
      })

      test("Google defaults to Tier S", () => {
        const res = resolveTier({ modelId: "gemini-3-pro", providerId: "google" })
        expect(res.tier).toBe("S")
        expect(res.source).toBe("heuristic")
      })

      test("unknown provider defaults to Tier B", () => {
        const res = resolveTier({ modelId: "my-model", providerId: "my-host" })
        expect(res.tier).toBe("B")
        expect(res.source).toBe("heuristic")
      })

      test("local with no ID hint defaults to Tier B", () => {
        const res = resolveTier({ modelId: "custom-local", providerId: "local" })
        expect(res.tier).toBe("B")
        expect(res.source).toBe("heuristic")
      })
    })
  })

  // -------------------------------------------------------------------------
  // Category 5: Profile JSON Validation
  // -------------------------------------------------------------------------
  describe("Category 5: Profile JSON Validation", () => {
    const rawProfiles = (MODEL_PROFILES_DATA as any).profiles as any[]

    test("all profiles load without parse errors", () => {
      expect(Array.isArray(rawProfiles)).toBe(true)
      expect(rawProfiles.length).toBeGreaterThanOrEqual(9)
    })

    test("all profiles have required fields", () => {
      const requiredFields = [
        "id",
        "name",
        "patterns",
        "contextWindow",
        "toolCalling",
        "temperature",
        "topP",
        "promptFile",
      ]
      for (const p of rawProfiles) {
        for (const f of requiredFields) {
          expect(p[f]).toBeDefined()
        }
      }
    })

    test("tier field, when present, is one of S, A, B, C, D", () => {
      const validTiers = new Set(["S", "A", "B", "C", "D"])
      for (const p of rawProfiles) {
        if (p.tier !== undefined) {
          expect(validTiers.has(p.tier)).toBe(true)
        }
      }
    })

    test("parameterHint field, when present, is a positive number", () => {
      for (const p of rawProfiles) {
        if (p.parameterHint !== undefined) {
          expect(typeof p.parameterHint).toBe("number")
          expect(p.parameterHint).toBeGreaterThan(0)
        }
      }
    })

    test("tier is consistent with parameterHint", () => {
      for (const p of rawProfiles) {
        if (p.tier !== undefined && p.parameterHint !== undefined) {
          const expectedTier = tierFromParams(p.parameterHint)
          expect(p.tier).toBe(expectedTier)
        }
      }
    })

    test("no duplicate profile IDs", () => {
      const ids = rawProfiles.map((p) => p.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    test("no duplicate patterns across profiles", () => {
      const allPatterns: string[] = []
      for (const p of rawProfiles) {
        for (const pattern of p.patterns) {
          expect(allPatterns).not.toContain(pattern)
          allPatterns.push(pattern)
        }
      }
    })

    test("llama-3.1 profile intentionally omits tier", () => {
      const llama31 = rawProfiles.find((p) => p.id === "llama-3.1")
      expect(llama31).toBeDefined()
      expect(llama31.tier).toBeUndefined()
    })
  })

  // -------------------------------------------------------------------------
  // Category 6: Behavioral Integration Tests (Per-Tier)
  // -------------------------------------------------------------------------
  describe("Category 6: Behavioral Integration Tests (Per-Tier)", () => {
    // 6a. Step cap integration
    describe("6a. Step cap integration (computeMaxSteps)", () => {
      test("Tier S with no agent cap gives Infinity", () => {
        const tierInfo = resolveTier({ overrideTier: "S" })
        expect(computeMaxSteps(undefined, tierInfo)).toBe(Infinity)
      })

      test("Tier C with no agent cap gives 3", () => {
        const tierInfo = resolveTier({ overrideTier: "C" })
        expect(computeMaxSteps(undefined, tierInfo)).toBe(3)
      })

      test("Tier D with no agent cap gives 1", () => {
        const tierInfo = resolveTier({ overrideTier: "D" })
        expect(computeMaxSteps(undefined, tierInfo)).toBe(1)
      })

      test("Tier C with agent cap 10 gives 10 (agent wins)", () => {
        const tierInfo = resolveTier({ overrideTier: "C" })
        expect(computeMaxSteps(10, tierInfo)).toBe(10)
      })

      test("Tier S with agent cap 5 gives 5 (agent wins)", () => {
        const tierInfo = resolveTier({ overrideTier: "S" })
        expect(computeMaxSteps(5, tierInfo)).toBe(5)
      })
    })

    // 6b. Warning trigger
    describe("6b. Warning trigger (shouldWarnCoding)", () => {
      test("code agent with Tier S does not warn", () => {
        const tierInfo = resolveTier({ overrideTier: "S" })
        expect(shouldWarnCoding(tierInfo, "code")).toBe(false)
      })

      test("code agent with Tier C warns", () => {
        const tierInfo = resolveTier({ overrideTier: "C" })
        expect(shouldWarnCoding(tierInfo, "code")).toBe(true)
      })

      test("code agent with Tier D warns", () => {
        const tierInfo = resolveTier({ overrideTier: "D" })
        expect(shouldWarnCoding(tierInfo, "code")).toBe(true)
      })

      test("debug agent with Tier C warns", () => {
        const tierInfo = resolveTier({ overrideTier: "C" })
        expect(shouldWarnCoding(tierInfo, "debug")).toBe(true)
      })

      test("ask agent with Tier C does not warn (not a coding agent)", () => {
        const tierInfo = resolveTier({ overrideTier: "C" })
        expect(shouldWarnCoding(tierInfo, "ask")).toBe(false)
      })

      test("explore agent with Tier D does not warn (not a coding agent)", () => {
        const tierInfo = resolveTier({ overrideTier: "D" })
        expect(shouldWarnCoding(tierInfo, "explore")).toBe(false)
      })
    })

    // 6c. Refusal flag
    describe("6c. Refusal flag (shouldRefuseCoding)", () => {
      test("Tier C + code + refuse=true triggers refusal", () => {
        const tierInfo = resolveTier({ overrideTier: "C" })
        expect(
          shouldRefuseCoding({
            tierInfo,
            agentName: "code",
            refuseSmallModelCoding: true,
          }),
        ).toBe(true)
      })

      test("Tier D + debug + refuse=true triggers refusal", () => {
        const tierInfo = resolveTier({ overrideTier: "D" })
        expect(
          shouldRefuseCoding({
            tierInfo,
            agentName: "debug",
            refuseSmallModelCoding: true,
          }),
        ).toBe(true)
      })

      test("Tier S + code + refuse=true allows execution (no refusal)", () => {
        const tierInfo = resolveTier({ overrideTier: "S" })
        expect(
          shouldRefuseCoding({
            tierInfo,
            agentName: "code",
            refuseSmallModelCoding: true,
          }),
        ).toBe(false)
      })

      test("Tier C + ask + refuse=true allows execution (ask is not coding)", () => {
        const tierInfo = resolveTier({ overrideTier: "C" })
        expect(
          shouldRefuseCoding({
            tierInfo,
            agentName: "ask",
            refuseSmallModelCoding: true,
          }),
        ).toBe(false)
      })

      test("Tier C + code + refuse=false allows execution (flag off)", () => {
        const tierInfo = resolveTier({ overrideTier: "C" })
        expect(
          shouldRefuseCoding({
            tierInfo,
            agentName: "code",
            refuseSmallModelCoding: false,
          }),
        ).toBe(false)
      })
    })
  })

  // -------------------------------------------------------------------------
  // Category 7: Tool Surface Filtering (Phase 2)
  // -------------------------------------------------------------------------
  describe("Category 7: Tool Surface Filtering (filterToolsByTier)", () => {
    // Helper: create mock tool list
    const mockTools = (ids: string[]) => ids.map((id) => ({ id, description: `mock ${id}` }))

    const ALL_TOOL_IDS = [
      "read", "grep", "glob", "bash", "webfetch", "question", "todowrite",
      "edit", "write", "apply_patch", "task", "skill", "lookup_symbols",
      "fetch_repo_map", "lsp", "agent_manager", "rewrite_file",
      "fox_memory_save", "kilo_memory_save",
    ]

    test("Tier S sees all tools", () => {
      const tier = resolveTier({ overrideTier: "S" })
      const result = filterToolsByTier(mockTools(ALL_TOOL_IDS), tier)
      expect(result.map((t) => t.id)).toEqual(ALL_TOOL_IDS)
    })

    test("Tier A sees all tools", () => {
      const tier = resolveTier({ overrideTier: "A" })
      const result = filterToolsByTier(mockTools(ALL_TOOL_IDS), tier)
      expect(result.map((t) => t.id)).toEqual(ALL_TOOL_IDS)
    })

    test("Tier B sees all tools", () => {
      const tier = resolveTier({ overrideTier: "B" })
      const result = filterToolsByTier(mockTools(ALL_TOOL_IDS), tier)
      expect(result.map((t) => t.id)).toEqual(ALL_TOOL_IDS)
    })

    test("Tier C hides complex tools", () => {
      const tier = resolveTier({ overrideTier: "C" })
      const result = filterToolsByTier(mockTools(ALL_TOOL_IDS), tier)
      const ids = result.map((t) => t.id)
      expect(ids).not.toContain("task")
      expect(ids).not.toContain("skill")
      expect(ids).not.toContain("lookup_symbols")
      expect(ids).not.toContain("fetch_repo_map")
      expect(ids).not.toContain("lsp")
      expect(ids).not.toContain("agent_manager")
      expect(ids).not.toContain("fox_memory_save")
      expect(ids).not.toContain("kilo_memory_save")
    })

    test("Tier C hides edit/write/apply_patch (uses rewrite_file instead)", () => {
      const tier = resolveTier({ overrideTier: "C" })
      const result = filterToolsByTier(mockTools(ALL_TOOL_IDS), tier)
      const ids = result.map((t) => t.id)
      expect(ids).not.toContain("edit")
      expect(ids).not.toContain("write")
      expect(ids).not.toContain("apply_patch")
      expect(ids).toContain("rewrite_file")
    })

    test("Tier C keeps safe tools", () => {
      const tier = resolveTier({ overrideTier: "C" })
      const result = filterToolsByTier(mockTools(ALL_TOOL_IDS), tier)
      const ids = result.map((t) => t.id)
      expect(ids).toContain("read")
      expect(ids).toContain("grep")
      expect(ids).toContain("glob")
      expect(ids).toContain("bash")
      expect(ids).toContain("webfetch")
      expect(ids).toContain("question")
      expect(ids).toContain("rewrite_file")
    })

    test("Tier D hides complex tools AND edit/write/apply_patch", () => {
      const tier = resolveTier({ overrideTier: "D" })
      const result = filterToolsByTier(mockTools(ALL_TOOL_IDS), tier)
      const ids = result.map((t) => t.id)
      expect(ids).not.toContain("task")
      expect(ids).not.toContain("skill")
      expect(ids).not.toContain("edit")
      expect(ids).not.toContain("write")
      expect(ids).not.toContain("apply_patch")
    })

    test("Tier D includes rewrite_file", () => {
      const tier = resolveTier({ overrideTier: "D" })
      const result = filterToolsByTier(mockTools(ALL_TOOL_IDS), tier)
      expect(result.map((t) => t.id)).toContain("rewrite_file")
    })

    test("Tier C with filter disabled sees all tools", () => {
      const tier = resolveTier({ overrideTier: "C" })
      const result = filterToolsByTier(mockTools(ALL_TOOL_IDS), tier, false)
      expect(result.map((t) => t.id)).toEqual(ALL_TOOL_IDS)
    })

    test("Tier D with filter disabled sees all tools", () => {
      const tier = resolveTier({ overrideTier: "D" })
      const result = filterToolsByTier(mockTools(ALL_TOOL_IDS), tier, false)
      expect(result.map((t) => t.id)).toEqual(ALL_TOOL_IDS)
    })

    test("Empty tool list returns empty array", () => {
      const tier = resolveTier({ overrideTier: "C" })
      expect(filterToolsByTier([], tier)).toEqual([])
    })

    test("Unknown/custom tool IDs pass through (not in either set)", () => {
      const tier = resolveTier({ overrideTier: "C" })
      const custom = mockTools(["my_custom_plugin_tool", "another_tool"])
      const result = filterToolsByTier(custom, tier)
      expect(result.map((t) => t.id)).toEqual(["my_custom_plugin_tool", "another_tool"])
    })

    test("Tier B does NOT have rewrite_file filtered out", () => {
      const tier = resolveTier({ overrideTier: "B" })
      const tools = mockTools(["read", "edit", "rewrite_file"])
      const result = filterToolsByTier(tools, tier)
      expect(result.map((t) => t.id)).toContain("rewrite_file")
    })

    test("commit is in TIER_COMPLEX_TOOLS and filtered out for Tier C", () => {
      expect(TIER_COMPLEX_TOOLS.has("commit")).toBe(true)
      const tier = resolveTier({ overrideTier: "C" })
      const tools = mockTools(["read", "commit"])
      const result = filterToolsByTier(tools, tier)
      expect(result.map((t) => t.id)).not.toContain("commit")
    })

    test("websearch is in TIER_SAFE_TOOLS and survives Tier D filtering", () => {
      expect(TIER_SAFE_TOOLS.has("websearch")).toBe(true)
      const tier = resolveTier({ overrideTier: "D" })
      const tools = mockTools(["read", "websearch", "task"])
      const result = filterToolsByTier(tools, tier)
      expect(result.map((t) => t.id)).toContain("websearch")
    })

    test("recall is in TIER_SAFE_TOOLS and survives Tier D filtering", () => {
      expect(TIER_SAFE_TOOLS.has("recall")).toBe(true)
      const tier = resolveTier({ overrideTier: "D" })
      const tools = mockTools(["read", "recall", "task"])
      const result = filterToolsByTier(tools, tier)
      expect(result.map((t) => t.id)).toContain("recall")
    })

    test("repo_overview is in TIER_SAFE_TOOLS and survives Tier D filtering", () => {
      expect(TIER_SAFE_TOOLS.has("repo_overview")).toBe(true)
      const tier = resolveTier({ overrideTier: "D" })
      const tools = mockTools(["read", "repo_overview", "task"])
      const result = filterToolsByTier(tools, tier)
      expect(result.map((t) => t.id)).toContain("repo_overview")
    })

    test("semantic_search is in TIER_SAFE_TOOLS and survives Tier D filtering", () => {
      expect(TIER_SAFE_TOOLS.has("semantic_search")).toBe(true)
      const tier = resolveTier({ overrideTier: "D" })
      const tools = mockTools(["read", "semantic_search", "task"])
      const result = filterToolsByTier(tools, tier)
      expect(result.map((t) => t.id)).toContain("semantic_search")
    })

    test("notebook_read is in TIER_SAFE_TOOLS and survives Tier D filtering", () => {
      expect(TIER_SAFE_TOOLS.has("notebook_read")).toBe(true)
      const tier = resolveTier({ overrideTier: "D" })
      const tools = mockTools(["read", "notebook_read", "task"])
      const result = filterToolsByTier(tools, tier)
      expect(result.map((t) => t.id)).toContain("notebook_read")
    })

    test("notebook_edit and notebook_execute are in TIER_COMPLEX_TOOLS and filtered out for Tier C", () => {
      expect(TIER_COMPLEX_TOOLS.has("notebook_edit")).toBe(true)
      expect(TIER_COMPLEX_TOOLS.has("notebook_execute")).toBe(true)
      const tier = resolveTier({ overrideTier: "C" })
      const tools = mockTools(["read", "notebook_edit", "notebook_execute"])
      const result = filterToolsByTier(tools, tier)
      const ids = result.map((t) => t.id)
      expect(ids).not.toContain("notebook_edit")
      expect(ids).not.toContain("notebook_execute")
    })

    test("TIER_SAFE_TOOLS and TIER_COMPLEX_TOOLS have no overlapping tools", () => {
      for (const tool of TIER_SAFE_TOOLS) {
        expect(TIER_COMPLEX_TOOLS.has(tool)).toBe(false)
      }
    })
  })

  // -------------------------------------------------------------------------
  // Category 8: Runtime Tier Reclassification (Phase 2)
  // -------------------------------------------------------------------------
  describe("Category 8: Runtime Tier Reclassification", () => {
    test("createReclassState preserves initial tier", () => {
      const tier = resolveTier({ overrideTier: "C" })
      const state = createReclassState(tier)
      expect(state.current.tier).toBe("C")
      expect(state.original.tier).toBe("C")
      expect(state.consecutiveFailures).toBe(0)
      expect(state.reclassified).toBe(false)
    })

    test("Success promotes C to B", () => {
      const tier = resolveTier({ overrideTier: "C" })
      const state = createReclassState(tier)
      const next = reclassifyOnSuccess(state)
      expect(next.current.tier).toBe("B")
      expect(next.reclassified).toBe(true)
      expect(next.current.source).toBe("reclassified")
    })

    test("Successive successes don't promote past B", () => {
      const tier = resolveTier({ overrideTier: "C" })
      let state = createReclassState(tier)
      state = reclassifyOnSuccess(state)
      expect(state.current.tier).toBe("B")
      state = reclassifyOnSuccess(state)
      expect(state.current.tier).toBe("B")
    })

    test("Success on Tier S is no-op", () => {
      const tier = resolveTier({ overrideTier: "S" })
      const state = createReclassState(tier)
      const next = reclassifyOnSuccess(state)
      expect(next.current.tier).toBe("S")
      expect(next.reclassified).toBe(false)
    })

    test("Success on Tier A is no-op", () => {
      const tier = resolveTier({ overrideTier: "A" })
      const state = createReclassState(tier)
      const next = reclassifyOnSuccess(state)
      expect(next.current.tier).toBe("A")
    })

    test("Success on Tier D is no-op (too small to promote)", () => {
      const tier = resolveTier({ overrideTier: "D" })
      const state = createReclassState(tier)
      const next = reclassifyOnSuccess(state)
      expect(next.current.tier).toBe("D")
      expect(next.reclassified).toBe(false)
    })

    test("Success resets failure counter", () => {
      const tier = resolveTier({ overrideTier: "B" })
      let state = createReclassState(tier)
      state = reclassifyOnFailure(state)
      expect(state.consecutiveFailures).toBe(1)
      state = reclassifyOnSuccess(state)
      expect(state.consecutiveFailures).toBe(0)
    })

    test("Single failure doesn't demote B", () => {
      const tier = resolveTier({ overrideTier: "B" })
      const state = createReclassState(tier)
      const next = reclassifyOnFailure(state)
      expect(next.current.tier).toBe("B")
      expect(next.consecutiveFailures).toBe(1)
      expect(next.reclassified).toBe(false)
    })

    test("Two consecutive failures do not demote B-native model", () => {
      const tier = resolveTier({ overrideTier: "B" })
      let state = createReclassState(tier)
      state = reclassifyOnFailure(state)
      state = reclassifyOnFailure(state)
      expect(state.current.tier).toBe("B")
      expect(state.reclassified).toBe(false)
      expect(state.consecutiveFailures).toBe(2)
    })

    test("Failure on Tier S is no-op", () => {
      const tier = resolveTier({ overrideTier: "S" })
      let state = createReclassState(tier)
      state = reclassifyOnFailure(state)
      state = reclassifyOnFailure(state)
      expect(state.current.tier).toBe("S")
    })

    test("Failure on Tier D is no-op (already lowest)", () => {
      const tier = resolveTier({ overrideTier: "D" })
      let state = createReclassState(tier)
      state = reclassifyOnFailure(state)
      state = reclassifyOnFailure(state)
      expect(state.current.tier).toBe("D")
    })

    test("Promotion then demotion returns to original (C→B→C)", () => {
      const tier = resolveTier({ overrideTier: "C" })
      let state = createReclassState(tier)
      state = reclassifyOnSuccess(state) // C → B
      expect(state.current.tier).toBe("B")
      state = reclassifyOnFailure(state) // 1 fail
      state = reclassifyOnFailure(state) // 2 fails → B → C
      expect(state.current.tier).toBe("C")
    })

    test("C model: promote, demote, re-promote (C→B→C→B)", () => {
      const tier = resolveTier({ overrideTier: "C" })
      let state = createReclassState(tier)
      state = reclassifyOnSuccess(state) // C → B
      expect(state.current.tier).toBe("B")
      state = reclassifyOnFailure(state)
      state = reclassifyOnFailure(state) // B → C
      expect(state.current.tier).toBe("C")
      state = reclassifyOnSuccess(state) // C → B
      expect(state.current.tier).toBe("B")
    })

    test("reclassified flag is set on transition", () => {
      const tier = resolveTier({ overrideTier: "C" })
      const state = createReclassState(tier)
      expect(state.reclassified).toBe(false)
      const next = reclassifyOnSuccess(state)
      expect(next.reclassified).toBe(true)
    })

    test("Original tier is preserved through transitions", () => {
      const tier = resolveTier({ overrideTier: "C" })
      let state = createReclassState(tier)
      state = reclassifyOnSuccess(state) // C → B
      state = reclassifyOnFailure(state)
      state = reclassifyOnFailure(state) // B → C
      expect(state.original.tier).toBe("C")
      expect(state.original.source).not.toBe("reclassified")
    })
  })

  // -------------------------------------------------------------------------
  // Category 9: Tool Filtering + Tier Reclassification Integration (Phase 2)
  // -------------------------------------------------------------------------
  describe("Category 9: Tool Filtering + Reclassification Integration", () => {
    const mockTools = (ids: string[]) => ids.map((id) => ({ id, description: `mock ${id}` }))
    const EDIT_TOOLS = ["read", "grep", "glob", "bash", "edit", "write", "task", "rewrite_file"]

    test("Tier C after reclassification to B expands tools", () => {
      const tier = resolveTier({ overrideTier: "C" })
      let state = createReclassState(tier)
      // Initially C: task is hidden
      const before = filterToolsByTier(mockTools(EDIT_TOOLS), state.current)
      expect(before.map((t) => t.id)).not.toContain("task")
      // After success: promoted to B, task is available
      state = reclassifyOnSuccess(state)
      const after = filterToolsByTier(mockTools(EDIT_TOOLS), state.current)
      expect(after.map((t) => t.id)).toContain("task")
    })

    test("Promoted Tier B after demotion to C narrows tools", () => {
      const tier = resolveTier({ overrideTier: "C" })
      let state = createReclassState(tier)
      state = reclassifyOnSuccess(state) // C → B
      // Now B: task is available
      const before = filterToolsByTier(mockTools(EDIT_TOOLS), state.current)
      expect(before.map((t) => t.id)).toContain("task")
      // After 2 failures: demoted back to C, task is hidden
      state = reclassifyOnFailure(state)
      state = reclassifyOnFailure(state)
      const after = filterToolsByTier(mockTools(EDIT_TOOLS), state.current)
      expect(after.map((t) => t.id)).not.toContain("task")
    })

    test("B-native model preserves tools after failures (no demotion)", () => {
      const tier = resolveTier({ overrideTier: "B" })
      let state = createReclassState(tier)
      state = reclassifyOnFailure(state)
      state = reclassifyOnFailure(state)
      const after = filterToolsByTier(mockTools(EDIT_TOOLS), state.current)
      expect(after.map((t) => t.id)).toContain("task")
    })

    test("TIER_SAFE_TOOLS and TIER_COMPLEX_TOOLS don't overlap", () => {
      for (const id of TIER_COMPLEX_TOOLS) {
        expect(TIER_SAFE_TOOLS.has(id)).toBe(false)
      }
    })

    test("Reclassified tier uses correct maxSteps", () => {
      const tier = resolveTier({ overrideTier: "C" })
      let state = createReclassState(tier)
      expect(computeMaxSteps(undefined, state.current)).toBe(TIER_META.C.maxSteps)
      state = reclassifyOnSuccess(state)
      expect(computeMaxSteps(undefined, state.current)).toBe(TIER_META.B.maxSteps)
    })

    test("Reclassified tier updates warnOnCoding", () => {
      const tier = resolveTier({ overrideTier: "C" })
      let state = createReclassState(tier)
      expect(state.current.warnOnCoding).toBe(true)
      state = reclassifyOnSuccess(state)
      expect(state.current.warnOnCoding).toBe(false)
    })

    test("Reclassification changes tool cache key when tier changes", () => {
      const tier = resolveTier({ overrideTier: "C" })
      let state = createReclassState(tier)
      const agentName = "code"
      const modelId = "test-model"
      const providerId = "test-provider"
      const keyBefore = `${agentName}:${modelId}:${providerId}:${state.current.tier}`
      expect(keyBefore).toBe("code:test-model:test-provider:C")

      state = reclassifyOnSuccess(state)
      const keyAfter = `${agentName}:${modelId}:${providerId}:${state.current.tier}`
      expect(keyAfter).toBe("code:test-model:test-provider:B")
      expect(keyAfter).not.toBe(keyBefore)
    })

    test("dynamic_tier_reclassification disabled preserves original tier", () => {
      const tier = resolveTier({ overrideTier: "C" })
      const dynamicEnabled = false
      const state = createReclassState(tier)
      const effectiveTier = dynamicEnabled ? reclassifyOnSuccess(state).current : tier
      expect(effectiveTier.tier).toBe("C")
    })

    test("Original tier is preserved for coding refusal and warnings even after promotion", () => {
      const tier = resolveTier({ overrideTier: "C" })
      let state = createReclassState(tier)
      state = reclassifyOnSuccess(state) // Promoted to B
      expect(state.current.tier).toBe("B")
      expect(state.original.tier).toBe("C")
      expect(shouldRefuseCoding({ tierInfo: state.original, agentName: "code", refuseSmallModelCoding: true })).toBe(true)
      expect(shouldWarnCoding(state.original, "code")).toBe(true)
    })

    test("Tier transition triggers toolDefCache invalidation condition", () => {
      const tier = resolveTier({ overrideTier: "C" })
      let state = createReclassState(tier)
      let toolDefCache: { key: string } | undefined = { key: "old-key" }

      const oldTier = state.current.tier
      state = reclassifyOnSuccess(state)
      if (state.current.tier !== oldTier) {
        toolDefCache = undefined
      }
      expect(toolDefCache).toBeUndefined()
    })
  })
})
