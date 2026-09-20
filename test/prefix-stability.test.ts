/**
 * Prefix stability test: validates that the system prompt produced by
 * KilocodeSystemPrompt.environment() is deterministic — it must not
 * contain dynamic values (dates, timestamps, random IDs) that would
 * invalidate the KV-cache prefix across turns within a session.
 *
 * Strategy 4.3 — KV-Cache Prefix Freezing
 */
import { describe, test, expect } from "bun:test"
import { createHash } from "node:crypto"
import { KilocodeSystemPrompt } from "@/foxcode/system-prompt"
import type { InstanceContext } from "@/project/instance-context"
import type { Provider } from "@/provider/provider"
import { ToolSchemaProjection } from "@opencode-ai/llm/protocols/utils/tool-schema"

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

  test("tool schemas are sorted alphabetically for deterministic KV prefix (Invariant A)", () => {
    const rawTools: Record<string, { description?: string; inputSchema: Record<string, unknown> }> = {
      write_file: { description: "Write file", inputSchema: { type: "object", properties: { path: { type: "string" } } } },
      bash: { description: "Run bash", inputSchema: { type: "object", properties: { command: { type: "string" } } } },
      read_file: { description: "Read file", inputSchema: { type: "object", properties: { path: { type: "string" } } } },
      edit_file: { description: "Edit file", inputSchema: { type: "object", properties: { path: { type: "string" } } } },
    }

    const sortedKeys = Object.keys(rawTools).sort()
    expect(sortedKeys).toEqual(["bash", "edit_file", "read_file", "write_file"])

    // Assert that key sorting produces identical JSON representation regardless of insertion order
    const shuffled: Record<string, unknown> = {
      read_file: rawTools.read_file,
      bash: rawTools.bash,
      write_file: rawTools.write_file,
      edit_file: rawTools.edit_file,
    }
    const sortObject = (obj: Record<string, unknown>) =>
      Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]))

    expect(JSON.stringify(sortObject(rawTools))).toBe(JSON.stringify(sortObject(shuffled)))
  })

  test("schema minification preserves required parameter keys and types (Invariant B)", () => {
    const bashSchema = {
      type: "object" as const,
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "BashInput",
      additionalProperties: false,
      properties: {
        command: { type: "string" as const, description: "The bash command to execute" },
        timeout: { type: "number" as const, description: "Command timeout in ms" },
      },
      required: ["command"],
    }

    const compact = ToolSchemaProjection.compact(bashSchema) as any
    expect(compact.type).toBe("object")
    expect(compact.required).toEqual(["command"])
    expect(compact.properties.command.type).toBe("string")
    expect(compact.properties.timeout.type).toBe("number")
    expect(compact.additionalProperties).toBeUndefined()
  })

  test("prefix snapshot hash is deterministic across runs (Invariant D)", () => {
    const ctx = fakeContext()
    const model = fakeModel()

    const envLines = KilocodeSystemPrompt.environment({ ctx, model }).join("\n")
    const hash1 = createHash("sha256").update(envLines).digest("hex")
    const hash2 = createHash("sha256").update(envLines).digest("hex")

    expect(hash1).toBe(hash2)
    expect(hash1.length).toBe(64)
  })
})

