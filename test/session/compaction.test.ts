import { describe, expect, test } from "bun:test"
import {
  summaryText,
  completedCompactions,
  turns,
  preserveRecentBudget,
} from "@/session/compaction"
import type { SessionV1 } from "@opencode-ai/core/v1/session"
import type { ConfigV1 } from "@opencode-ai/core/v1/config/config"
import type { Provider } from "@/provider/provider"

describe("Compaction Pure Helpers", () => {
  describe("summaryText", () => {
    test("extracts and trims text parts", () => {
      const msg: SessionV1.WithParts = {
        info: { id: "m1", sessionID: "s1", role: "assistant" } as any,
        parts: [
          { type: "text", text: "  First paragraph.  " } as any,
          { type: "tool", tool: "read" } as any,
          { type: "text", text: "Second paragraph." } as any,
        ],
      }
      expect(summaryText(msg)).toBe("First paragraph.\n\nSecond paragraph.")
    })

    test("returns undefined when message has no text parts", () => {
      const msg: SessionV1.WithParts = {
        info: { id: "m2", sessionID: "s1", role: "assistant" } as any,
        parts: [{ type: "tool", tool: "read" } as any],
      }
      expect(summaryText(msg)).toBeUndefined()
    })

    test("returns undefined for empty text parts", () => {
      const msg: SessionV1.WithParts = {
        info: { id: "m3", sessionID: "s1", role: "assistant" } as any,
        parts: [{ type: "text", text: "   " } as any],
      }
      expect(summaryText(msg)).toBeUndefined()
    })
  })

  describe("turns", () => {
    test("identifies user turns excluding compaction parts", () => {
      const msgs: SessionV1.WithParts[] = [
        { info: { id: "u1", role: "user" } as any, parts: [{ type: "text", text: "hi" } as any] },
        { info: { id: "a1", role: "assistant" } as any, parts: [{ type: "text", text: "hello" } as any] },
        { info: { id: "u2", role: "user" } as any, parts: [{ type: "compaction" } as any] },
        { info: { id: "u3", role: "user" } as any, parts: [{ type: "text", text: "next" } as any] },
        { info: { id: "a2", role: "assistant" } as any, parts: [{ type: "text", text: "done" } as any] },
      ]
      const result = turns(msgs)
      expect(result.length).toBe(2)
      expect(result[0].id).toBe("u1")
      expect(result[0].start).toBe(0)
      expect(result[0].end).toBe(3) // u3 starts at 3
      expect(result[1].id).toBe("u3")
      expect(result[1].start).toBe(3)
      expect(result[1].end).toBe(5)
    })
  })

  describe("completedCompactions", () => {
    test("pairs compaction user requests with completed assistant responses", () => {
      const msgs: SessionV1.WithParts[] = [
        {
          info: { id: "u-comp", role: "user" } as any,
          parts: [{ type: "compaction" } as any],
        },
        {
          info: {
            id: "a-comp",
            role: "assistant",
            parentID: "u-comp",
            summary: true,
            finish: "stop",
          } as any,
          parts: [{ type: "text", text: "Summary of earlier session" } as any],
        },
      ]
      const compactions = completedCompactions(msgs)
      expect(compactions.length).toBe(1)
      expect(compactions[0].userIndex).toBe(0)
      expect(compactions[0].assistantIndex).toBe(1)
      expect(compactions[0].summary).toBe("Summary of earlier session")
    })

    test("ignores incomplete or errored compaction assistant messages", () => {
      const msgs: SessionV1.WithParts[] = [
        {
          info: { id: "u-comp", role: "user" } as any,
          parts: [{ type: "compaction" } as any],
        },
        {
          info: {
            id: "a-comp",
            role: "assistant",
            parentID: "u-comp",
            summary: true,
            finish: undefined, // incomplete
          } as any,
          parts: [{ type: "text", text: "Partial" } as any],
        },
      ]
      expect(completedCompactions(msgs)).toEqual([])
    })
  })

  describe("preserveRecentBudget", () => {
    const mockModel: Provider.Model = {
      id: "test-model",
      name: "Test",
      provider: "openai",
      limit: { context: 128_000, output: 4096 },
    } as any

    test("uses config override when configured", () => {
      const cfg: ConfigV1.Info = {
        compaction: { preserve_recent_tokens: 5000 },
      } as any
      expect(preserveRecentBudget({ cfg, model: mockModel })).toBe(5000)
    })

    test("clamps default budget between min (2,000) and max (8,000)", () => {
      const cfg: ConfigV1.Info = {} as any
      const budget = preserveRecentBudget({ cfg, model: mockModel })
      expect(budget).toBeGreaterThanOrEqual(2000)
      expect(budget).toBeLessThanOrEqual(8000)
    })
  })
})
