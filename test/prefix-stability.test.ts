/**
 * Prefix stability test: validates that the system prompt produced by
 * KilocodeSystemPrompt.environment() is deterministic — it must not
 * contain dynamic values (dates, timestamps, random IDs) that would
 * invalidate the KV-cache prefix across turns within a session.
 *
 * Strategy 4.3 — KV-Cache Prefix Freezing
 */
import { describe, test, expect } from "bun:test"
import { KilocodeSystemPrompt } from "@/foxcode/system-prompt"
import type { InstanceContext } from "@/project/instance-context"
import type { Provider } from "@/provider/provider"

const fakeContext = (): InstanceContext => ({
  directory: "/home/user/project",
  worktree: "/home/user/project",
  project: {
    id: "test-project",
    vcs: "git",
    directory: "/home/user/project",
  },
})

const fakeModel = (): Provider.Model => ({
  id: "nemotron-3-ultra-550b",
  providerID: "openrouter" as any,
  api: {
    id: "nemotron-3-ultra-550b",
    npm: "@ai-sdk/openai-compatible",
  },
  family: "nemotron",
  capabilities: { temperature: true },
} as unknown as Provider.Model)

describe("system prompt prefix stability (4.3)", () => {
  test("environment() produces identical output across multiple calls", () => {
    const ctx = fakeContext()
    const model = fakeModel()

    const first = KilocodeSystemPrompt.environment({ ctx, model })
    const second = KilocodeSystemPrompt.environment({ ctx, model })

    expect(first).toEqual(second)
  })

  test("environment() does not contain a date string", () => {
    const ctx = fakeContext()
    const model = fakeModel()

    const output = KilocodeSystemPrompt.environment({ ctx, model })
    const joined = output.join("\n")

    // Reject any "Today's date:" pattern
    expect(joined).not.toContain("Today's date:")
    // Reject ISO timestamps
    expect(joined).not.toMatch(/\d{4}-\d{2}-\d{2}T/)
    // Reject toDateString() output like "Mon Sep 20 2026"
    expect(joined).not.toMatch(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/)
  })

  test("environment() output is stable across separate invocations 100ms apart", async () => {
    const ctx = fakeContext()
    const model = fakeModel()

    const first = KilocodeSystemPrompt.environment({ ctx, model })
    await new Promise((resolve) => setTimeout(resolve, 100))
    const second = KilocodeSystemPrompt.environment({ ctx, model })

    expect(first).toEqual(second)
  })

  test("environment() contains expected static fields", () => {
    const ctx = fakeContext()
    const model = fakeModel()

    const output = KilocodeSystemPrompt.environment({ ctx, model })
    const joined = output.join("\n")

    expect(joined).toContain("nemotron-3-ultra-550b")
    expect(joined).toContain("Is directory a git repo: yes")
    expect(joined).toContain(`Platform: ${process.platform}`)
    expect(joined).toContain("<env>")
    expect(joined).toContain("</env>")
  })
})
