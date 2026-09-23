import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { resolveProfile, listProfiles, getProfile, type ModelProfile } from "@/session/prompt/model-profile"
import { usable, isOverflow } from "@/session/overflow"
import { provider as getSystemPrompt } from "@/session/system"
import type { Provider } from "@/provider/provider"
import type { ConfigV1 } from "@opencode-ai/core/v1/config/config"

describe("Model Profiles & Prompt Matrix", () => {
  const originalEnv = process.env.FOX_MODEL_PROFILE

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.FOX_MODEL_PROFILE
    } else {
      process.env.FOX_MODEL_PROFILE = originalEnv
    }
  })

  describe("listProfiles & getProfile", () => {
    test("loads curated open-weights model profiles", () => {
      const profiles = listProfiles()
      expect(profiles.length).toBeGreaterThanOrEqual(6)

      const ids = profiles.map((p: ModelProfile) => p.id)
      expect(ids).toContain("llama-3.3")
      expect(ids).toContain("llama-3.1")
      expect(ids).toContain("codestral")
      expect(ids).toContain("gemma")
      expect(ids).toContain("nemotron")
      expect(ids).toContain("gpt-oss")
    })

    test("retrieves profiles by ID or Name case-insensitively", () => {
      const p1 = getProfile("llama-3.3")
      expect(p1).toBeDefined()
      expect(p1?.name).toBe("Meta Llama 3.3 70B")

      const p2 = getProfile("Mistral Codestral")
      expect(p2).toBeDefined()
      expect(p2?.id).toBe("codestral")
    })
  })

  describe("Auto-detection for Ollama and local model names", () => {
    test("detects Llama 3.1 from Ollama tag format", () => {
      const p = resolveProfile({ modelId: "llama3.1:8b" })
      expect(p.id).toBe("llama-3.1")
      expect(p.contextWindow).toBe(131072)
      expect(p.promptFile).toBe("local.txt")
      expect(p.toolCalling).toBe("native")
    })

    test("detects Llama 3.3 from Ollama tag format", () => {
      const p = resolveProfile({ modelId: "llama3.3:70b" })
      expect(p.id).toBe("llama-3.3")
      expect(p.contextWindow).toBe(131072)
    })

    test("detects Codestral from Ollama tag format", () => {
      const p = resolveProfile({ modelId: "codestral:22b" })
      expect(p.id).toBe("codestral")
      expect(p.contextWindow).toBe(32768)
      expect(p.temperature).toBe(0.15)
    })

    test("detects Gemma 2/4 from Ollama tag format", () => {
      const p = resolveProfile({ modelId: "gemma2:9b" })
      expect(p.id).toBe("gemma")
      expect(p.contextWindow).toBe(32768)
    })

    test("detects Nemotron from Ollama tag format", () => {
      const p = resolveProfile({ modelId: "nemotron:latest" })
      expect(p.id).toBe("nemotron")
      expect(p.contextWindow).toBe(131072)
    })

    test("detects GPT-OSS from Ollama tag format", () => {
      const p = resolveProfile({ modelId: "gpt-oss:120b" })
      expect(p.id).toBe("gpt-oss")
      expect(p.contextWindow).toBe(131072)
    })
  })

  describe("Auto-detection for OpenRouter / LiteLLM proxy routes", () => {
    test("detects Meta Llama 3.3 OpenRouter endpoint", () => {
      const p = resolveProfile({
        providerId: "openrouter",
        modelId: "meta-llama/llama-3.3-70b-instruct",
      })
      expect(p.id).toBe("llama-3.3")
    })

    test("detects Mistral Codestral OpenRouter endpoint", () => {
      const p = resolveProfile({
        providerId: "openrouter",
        modelId: "mistralai/codestral-2508",
      })
      expect(p.id).toBe("codestral")
    })

    test("detects Google Gemma 4 OpenRouter endpoint", () => {
      const p = resolveProfile({
        providerId: "openrouter",
        modelId: "google/gemma-4-31b-it",
      })
      expect(p.id).toBe("gemma")
    })

    test("detects Nvidia Nemotron OpenRouter endpoint", () => {
      const p = resolveProfile({
        providerId: "openrouter",
        modelId: "nvidia/nemotron-3-ultra-550b-a55b",
      })
      expect(p.id).toBe("nemotron")
    })

    test("detects OpenAI GPT-OSS OpenRouter endpoint", () => {
      const p = resolveProfile({
        providerId: "openrouter",
        modelId: "openai/gpt-oss-120b",
      })
      expect(p.id).toBe("gpt-oss")
    })
  })

  describe("Manual Override", () => {
    test("overrideProfile overrides auto-detection", () => {
      const p = resolveProfile({
        modelId: "llama3.1:8b",
        overrideProfile: "codestral",
      })
      expect(p.id).toBe("codestral")
      expect(p.contextWindow).toBe(32768)
    })

    test("FOX_MODEL_PROFILE environment variable overrides auto-detection", () => {
      process.env.FOX_MODEL_PROFILE = "nemotron"
      const p = resolveProfile({ modelId: "llama3.1:8b" })
      expect(p.id).toBe("nemotron")
      expect(p.name).toBe("Nvidia Nemotron 3 / 4")
    })

    test("falls back to default profile for unknown models", () => {
      const p = resolveProfile({ modelId: "unknown-custom-model" })
      expect(p.id).toBe("default")
      expect(p.promptFile).toBe("default.txt")
    })
  })

  describe("Compaction Threshold & Overflow Integration", () => {
    test("uses profile context window when model context limit is 0", () => {
      const modelWithNoLimit: Provider.Model = {
        id: "llama3.1:8b",
        providerID: "ollama",
        limit: { context: 0, output: 4096 },
      } as any

      const cfg: ConfigV1.Info = {} as any
      const u = usable({ cfg, model: modelWithNoLimit, outputTokenMax: 4096 })

      // Should use 131,072 - 4096 = 126,976 instead of 0
      expect(u).toBe(131072 - 4096)
    })

    test("triggers overflow compaction correctly using profile context limit", () => {
      const modelWithNoLimit: Provider.Model = {
        id: "codestral:22b",
        providerID: "ollama",
        limit: { context: 0, output: 4096 },
      } as any

      const cfg: ConfigV1.Info = {} as any
      // Codestral profile has contextWindow: 32768, usable = 32768 - 4096 = 28672
      const tokensBelow = {
        input: 20000,
        output: 0,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      }
      expect(isOverflow({ cfg, tokens: tokensBelow, model: modelWithNoLimit, outputTokenMax: 4096 })).toBe(false)

      const tokensAbove = {
        input: 30000,
        output: 0,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      }
      expect(isOverflow({ cfg, tokens: tokensAbove, model: modelWithNoLimit, outputTokenMax: 4096 })).toBe(true)
    })

    test("manual profile override takes effect in compaction limit calculation", () => {
      const model: Provider.Model = {
        id: "custom-local",
        providerID: "ollama",
        limit: { context: 0, output: 4096 },
      } as any

      const cfg: ConfigV1.Info = {
        model_profile: "codestral",
      } as any

      // With codestral profile override (32768), usable should be 32768 - 4096 = 28672
      const u = usable({ cfg, model, outputTokenMax: 4096 })
      expect(u).toBe(32768 - 4096)
    })
  })

  describe("System Prompt Selection Integration", () => {
    test("selects local.txt system prompt for profiled open models", () => {
      const model: Provider.Model = {
        providerID: "ollama",
        api: { id: "llama-3.1" },
      } as any

      const prompts = getSystemPrompt(model)
      expect(prompts.length).toBe(1)
      expect(prompts[0]).toContain("You are Fox, an interactive CLI tool")
    })

    test("respects profile override in system prompt selection", () => {
      const model: Provider.Model = {
        providerID: "openai",
        api: { id: "gpt-4o" },
      } as any

      // With manual profile override to codestral, selects local.txt
      const prompts = getSystemPrompt(model, "codestral")
      expect(prompts.length).toBe(1)
      expect(prompts[0]).toContain("You are Fox, an interactive CLI tool")
    })
  })
})
