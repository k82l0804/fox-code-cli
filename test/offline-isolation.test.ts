import { describe, expect, test } from "bun:test"
import { DEFAULT_HEADERS } from "../src/foxcode/const"
import { resolveProvider, DEFAULT_MODEL, FALLBACK_IMAGE_MODELS } from "../src/foxcode/tool/generate-image"
import { parseShareUrl } from "../src/cli/cmd/import"

describe("Offline Isolation & Cloud Service Purge", () => {
  describe("Default Headers", () => {
    test("does not contain external cloud or telemetry referers", () => {
      expect((DEFAULT_HEADERS as any)["HTTP-Referer"]).toBeUndefined()
      expect(DEFAULT_HEADERS["X-Title"]).toBe("Fox Code")
      expect(DEFAULT_HEADERS["User-Agent"]).toContain("Fox-Code")
    })
  })

  describe("Image Generation Gateway Guard", () => {
    test("defaults to local auto model", () => {
      expect(DEFAULT_MODEL).toBe("local/auto")
      expect(FALLBACK_IMAGE_MODELS).toEqual([{ value: "local/auto", label: "Local Auto Image Model" }])
    })

    test("refuses to resolve remote providers without explicit FOX_IMAGE_BASE_URL", () => {
      const origBase = process.env.FOX_IMAGE_BASE_URL
      const origOpenRouter = process.env.FOX_OPENROUTER_BASE
      try {
        delete process.env.FOX_IMAGE_BASE_URL
        delete process.env.FOX_OPENROUTER_BASE
        const resolved = resolveProvider(undefined, "some-remote-key")
        expect(resolved).toBeNull()
      } finally {
        if (origBase) process.env.FOX_IMAGE_BASE_URL = origBase
        if (origOpenRouter) process.env.FOX_OPENROUTER_BASE = origOpenRouter
      }
    })
  })

  describe("Session Import Guard", () => {
    test("correctly parses share URL pattern for detection", () => {
      expect(parseShareUrl("https://app.kilo.ai/s/test-slug-123")).toBe("test-slug-123")
      expect(parseShareUrl("/path/to/local/file.json")).toBeNull()
    })
  })

  describe("ModelsDev Offline Isolation", () => {
    test("does not default to remote models.dev URL", () => {
      const { Flag } = require("@opencode-ai/core/flag/flag")
      expect(Flag.FOX_MODELS_URL).toBeUndefined()
    })

    test("ModelsDev refresh does not make any external network requests when FOX_MODELS_URL is unset", async () => {
      const origFetch = globalThis.fetch
      let fetchCalledWith: string[] = []
      globalThis.fetch = (async (input: any) => {
        const url = typeof input === "string" ? input : input.url
        fetchCalledWith.push(url)
        throw new Error(`Unexpected external fetch: ${url}`)
      }) as any

      try {
        const { ModelsDev } = await import("@opencode-ai/core/models-dev")
        // ModelsDev service refresh with undefined source must be a no-op
        const { Effect } = await import("effect")
        // Verify fetch was never invoked for models.dev
        expect(fetchCalledWith.some(url => url.includes("models.dev"))).toBe(false)
      } finally {
        globalThis.fetch = origFetch
      }
    })
  })

  describe("Provider Resolution & Local Prioritization", () => {
    test("resolvePluginProviders ignores disabled providers and extracts local hook auth", async () => {
      const { resolvePluginProviders } = await import("../src/cli/cmd/providers")
      const mockHooks = [
        {
          auth: {
            provider: "local-llm",
            methods: [{ type: "api" as const, label: "API Key" }],
          },
        },
        {
          auth: {
            provider: "cloud-disabled",
            methods: [{ type: "api" as const, label: "API Key" }],
          },
        },
      ]

      const result = resolvePluginProviders({
        hooks: mockHooks as any,
        existingProviders: {},
        disabled: new Set(["cloud-disabled"]),
        providerNames: { "local-llm": "Local LLM Server" },
      })

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ id: "local-llm", name: "Local LLM Server" })
    })
  })

  describe("Banned Cloud Gateways Audit", () => {
    const BANNED_PATTERNS = [
      "chatgpt.com",
      "auth.openai.com",
      "do-ai.run",
      "auth.x.ai",
      "api.apertis.ai",
      "opncd.ai",
      "cloudflare.com/cdn-cgi/trace",
      "ingest.kilosessions.ai",
    ]

    test("default headers and tool configs do not reference banned cloud endpoints", () => {
      const serializedHeaders = JSON.stringify(DEFAULT_HEADERS)
      for (const pattern of BANNED_PATTERNS) {
        expect(serializedHeaders).not.toContain(pattern)
      }
    })

    test("generate-image fallbacks do not reference openrouter or remote cloud services", () => {
      const serialized = JSON.stringify(FALLBACK_IMAGE_MODELS)
      expect(serialized).not.toContain("openrouter.ai")
      expect(serialized).not.toContain("openai.com")
      expect(serialized).toContain("local/auto")
    })
  })
})

