import { describe, expect, test } from "bun:test"
import { FoxSessionOverflow } from "@/foxcode/session/overflow"
import { isOverflow, usable } from "@/session/overflow"
import type { ConfigV1 } from "@opencode-ai/core/v1/config/config"
import type { Provider } from "@/provider/provider"

describe("Session Overflow & Token Counting", () => {
  const mockModel: Provider.Model = {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    limit: { context: 128_000, output: 4096 },
  } as any

  describe("FoxSessionOverflow.count", () => {
    test("sums all token categories correctly", () => {
      const tokens = {
        input: 100,
        output: 50,
        reasoning: 25,
        cache: { read: 10, write: 5 },
      }
      expect(FoxSessionOverflow.count(tokens)).toBe(190)
    })

    test("falls back to total if category sum is 0", () => {
      const tokens = {
        input: 0,
        output: 0,
        reasoning: 0,
        cache: { read: 0, write: 0 },
        total: 42,
      } as any
      expect(FoxSessionOverflow.count(tokens)).toBe(42)
    })
  })

  describe("FoxSessionOverflow.limit", () => {
    test("returns full usable when threshold_percent is not set", () => {
      const cfg: ConfigV1.Info = {} as any
      expect(FoxSessionOverflow.limit({ cfg: cfg as any, model: mockModel, usable: 100_000 })).toBe(100_000)
    })

    test("caps usable tokens based on threshold_percent", () => {
      const cfg: ConfigV1.Info = {
        compaction: { threshold_percent: 50 },
      } as any
      // 50% of 128_000 = 64_000
      expect(FoxSessionOverflow.limit({ cfg: cfg as any, model: mockModel, usable: 100_000 })).toBe(64_000)
    })
  })

  describe("FoxSessionOverflow.measure", () => {
    test("estimates tokens for messages and tools payload", () => {
      const payload = {
        messages: [{ role: "user" as const, content: "Hello world" }],
        tools: {
          testTool: { description: "Does testing", inputSchema: { type: "object" } },
        },
      }
      const measured = FoxSessionOverflow.measure(payload)
      expect(measured.normalized).toBeGreaterThan(0)
      expect(measured.raw).toBeGreaterThanOrEqual(measured.normalized)
      expect(typeof measured.continuation).toBe("boolean")
    })
  })

  describe("FoxSessionOverflow.shouldCompact", () => {
    test("returns true when tokens exceed limit", () => {
      const cfg: ConfigV1.Info = {
        compaction: { threshold_percent: 80 },
      } as any
      const result = FoxSessionOverflow.shouldCompact({
        cfg: cfg as any,
        model: mockModel,
        usable: 100_000,
        tokens: 95_000, // 95k > 80% of 128k (102.4k)? No, 95k < 102.4k. Let's use 110k
        continuation: false,
      })
      expect(result).toBe(false)

      const shouldTrigger = FoxSessionOverflow.shouldCompact({
        cfg: cfg as any,
        model: mockModel,
        usable: 100_000,
        tokens: 115_000,
        continuation: false,
      })
      expect(shouldTrigger).toBe(true)
    })
  })

  describe("isOverflow", () => {
    test("returns false if compaction is disabled in config", () => {
      const cfg: ConfigV1.Info = {
        compaction: { auto: false },
      } as any
      const tokens = {
        input: 200_000,
        output: 0,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      }
      expect(isOverflow({ cfg, tokens, model: mockModel })).toBe(false)
    })
  })
})
