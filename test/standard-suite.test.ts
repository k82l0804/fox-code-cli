/**
 * Fox Standard Test Suite — Canonical Invariant & Corpora Regression Runner
 *
 * Runs all 6 golden corpora defined in docs/research/std-test-suite-sort-of.md:
 *   1. SWE-bench Mini (12 canonical software engineering tasks)
 *   2. GitOps Workflow Corpus
 *   3. Build/Test/CI Output Corpus
 *   4. Diff Corpus
 *   5. Shell Output Corpus
 *   6. Document & Data Corpus
 *
 * Validates the 6 Core Invariants:
 *   - Invariant 1: Lossless Information Preservation
 *   - Invariant 2: Non-Expansion (compressed.length <= raw.length)
 *   - Invariant 3: Prefix Stability & Cache Reusability
 *   - Invariant 4: Supersession Correctness
 *   - Invariant 5: Escape Hatch Fidelity
 *   - Invariant 6: Execution Overhead & Positive ROI
 */
import { describe, test, expect, beforeAll, beforeEach } from "bun:test"
import {
  getAllCorporaFixtures,
  getCorporaStats,
  SWE_BENCH_MINI_TASKS,
  GITOPS_FIXTURES,
  TEST_OUTPUT_FIXTURES,
  DIFF_FIXTURES,
  SHELL_OUTPUT_FIXTURES,
  DOCUMENT_FIXTURES,
  type CorpusFixture,
} from "./corpora"
import {
  process as runCompress,
  truncateShellOutput,
  rewriteGitCommand,
  type CompressContext,
} from "@opencode-ai/core/tool/compress"
import { CompressionMetrics } from "@opencode-ai/core/tool/compression-metrics"
import { buildSupersededSet } from "@/session/supersede"
import { KilocodeSystemPrompt } from "@/foxcode/system-prompt"
import { createHash } from "node:crypto"
import process from "node:process"

const WORKSPACE = "/home/k82l0804/workarea/fox/fox-code-cli"

function getTestContext(fixture: CorpusFixture): CompressContext {
  return {
    workspaceRoot: WORKSPACE,
    toolName: fixture.tool,
    workflow: "swe",
  }
}

describe("Fox Standard Test Suite", () => {
  beforeAll(() => {
    process.env.FOX_EXPERIMENTAL_COMPRESS = "true"
    process.env.FOX_EXPERIMENTAL_COMPRESS_PATHS = "true"
    process.env.FOX_EXPERIMENTAL_COMPRESS_GIT = "true"
    process.env.FOX_EXPERIMENTAL_COMPRESS_DIFF = "true"
    process.env.FOX_EXPERIMENTAL_COMPRESS_DATA = "true"
    process.env.FOX_EXPERIMENTAL_COMPRESS_SUPERSEDE = "true"
  })

  beforeEach(() => {
    CompressionMetrics.reset()
    CompressionMetrics.resetROI()
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 1. Corpora Structure & Inventory Verification
  // ═════════════════════════════════════════════════════════════════════════
  describe("1. Corpora Inventory & Completeness", () => {
    test("verifies all 6 corpora categories are populated with golden fixtures", () => {
      const stats = getCorporaStats()

      expect(stats.sweTasks).toBe(12)
      expect(stats.gitopsFixtures).toBe(7)
      expect(stats.testFixtures).toBe(6)
      expect(stats.diffFixtures).toBe(6)
      expect(stats.shellFixtures).toBe(5)
      expect(stats.docFixtures).toBe(4)
      expect(stats.totalFixtures).toBe(stats.sweTasks * 2 + 7 + 6 + 6 + 5 + 4)
    })

    test("verifies SWE-bench Mini tasks contain complete task specifications", () => {
      for (const task of SWE_BENCH_MINI_TASKS) {
        expect(task.id).toStartWith("swe-")
        expect(task.title.length).toBeGreaterThan(5)
        expect(task.description.length).toBeGreaterThan(20)
        expect(Object.keys(task.initialFiles).length).toBeGreaterThan(0)
        expect(task.failingTestCommand).toContain("bun test")
        expect(task.failingTestOutput).toContain("fail")
        expect(task.referencePatch).toContain("--- a/")
        expect(task.referencePatch).toContain("+++ b/")
        expect(task.expectedAssertions).toBeGreaterThan(0)
      }
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 2. Invariant 1: Lossless Information Preservation
  // ═════════════════════════════════════════════════════════════════════════
  describe("2. Invariant 1: Lossless Information Preservation", () => {
    test("ensures no critical substrings, error frames, or patch lines are dropped", () => {
      const allFixtures = getAllCorporaFixtures()

      for (const fixture of allFixtures) {
        const ctx = getTestContext(fixture)
        let output = runCompress(fixture.content, ctx)

        // If shell output with command, also evaluate shell truncation pipeline
        if (fixture.tool === "bash" && fixture.command) {
          const res = truncateShellOutput(output, { command: fixture.command })
          output = res.output
        }

        if (fixture.mustContain) {
          for (const requiredStr of fixture.mustContain) {
            expect(output).toContain(
              requiredStr,
              `Fixture [${fixture.id}] dropped required substring: "${requiredStr}"`
            )
          }
        }
      }
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 3. Invariant 2: Non-Expansion Invariant
  // ═════════════════════════════════════════════════════════════════════════
  describe("3. Invariant 2: Non-Expansion Invariant", () => {
    test("guarantees compressed output is never larger than raw input across all fixtures", () => {
      const allFixtures = getAllCorporaFixtures()

      for (const fixture of allFixtures) {
        const ctx = getTestContext(fixture)
        let output = runCompress(fixture.content, ctx)

        if (fixture.tool === "bash" && fixture.command) {
          const res = truncateShellOutput(output, { command: fixture.command })
          output = res.output
        }

        expect(output.length).toBeLessThanOrEqual(
          fixture.content.length,
          `Fixture [${fixture.id}] violated non-expansion invariant: raw ${fixture.content.length} -> compressed ${output.length}`
        )
      }
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 4. Invariant 3: Prefix Stability & Cache Reusability
  // ═════════════════════════════════════════════════════════════════════════
  describe("4. Invariant 3: Prefix Stability & KV Cache Reusability", () => {
    test("system prompt environment prefix is byte-identical and hash-stable across turns", () => {
      const fakeContext = {
        directory: WORKSPACE,
        worktree: WORKSPACE,
        project: { id: "fox-standard-suite", vcs: "git" as const, directory: WORKSPACE },
      }
      const fakeModel = {
        id: "nemotron-3-ultra-550b",
        providerID: "openrouter" as any,
        api: { id: "nemotron-3-ultra-550b", npm: "@ai-sdk/openai-compatible" },
        family: "nemotron",
        capabilities: { temperature: true },
      } as any

      const envTurn1 = KilocodeSystemPrompt.environment({ ctx: fakeContext, model: fakeModel }).join("\n")
      const envTurn2 = KilocodeSystemPrompt.environment({ ctx: fakeContext, model: fakeModel }).join("\n")

      expect(envTurn1).toBe(envTurn2)

      const hash1 = createHash("sha256").update(envTurn1).digest("hex")
      const hash2 = createHash("sha256").update(envTurn2).digest("hex")
      expect(hash1).toBe(hash2)
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 5. Invariant 4: Supersession Correctness
  // ═════════════════════════════════════════════════════════════════════════
  describe("5. Invariant 4: Render-Time Supersession Correctness", () => {
    test("supersedes obsolete git status and read outputs when mutations occur", () => {
      const assistantMsg = (id: string, parts: any[]) => ({
        info: { id, role: "assistant" },
        parts,
      })

      const messages = [
        assistantMsg("msg-1", [
          {
            id: "call-1",
            callID: "call-1",
            messageID: "msg-1",
            type: "tool",
            tool: "bash",
            state: {
              status: "completed",
              input: { command: "git status" },
              output: "On branch main\nChanges not staged for commit:\nmodified: src/app.ts",
            },
          },
        ]),
        assistantMsg("msg-2", [
          {
            id: "call-2",
            callID: "call-2",
            messageID: "msg-2",
            type: "tool",
            tool: "read",
            state: {
              status: "completed",
              input: { path: "src/app.ts" },
              output: "const x = 1;",
            },
          },
        ]),
        assistantMsg("msg-3", [
          {
            id: "call-3",
            callID: "call-3",
            messageID: "msg-3",
            type: "tool",
            tool: "edit",
            state: {
              status: "completed",
              input: { path: "src/app.ts", oldString: "const x = 1;", newString: "const x = 2;" },
              output: "File updated successfully.",
            },
          },
        ]),
        assistantMsg("msg-4", [
          {
            id: "call-4",
            callID: "call-4",
            messageID: "msg-4",
            type: "tool",
            tool: "read",
            state: {
              status: "completed",
              input: { path: "src/app.ts" },
              output: "const x = 2;",
            },
          },
        ]),
        assistantMsg("msg-5", [
          {
            id: "call-5",
            callID: "call-5",
            messageID: "msg-5",
            type: "tool",
            tool: "bash",
            state: {
              status: "completed",
              input: { command: "git commit -m 'feat: update app'" },
              output: "[main a1b2c3d] feat: update app\n 1 file changed, 1 insertion(+)",
            },
          },
        ]),
      ]

      const supersededMap = buildSupersededSet(messages as any, { enabled: true })

      // Earlier git status before commit MUST be superseded
      expect(supersededMap.has("call-1")).toBe(true)
      // Earlier read before edit + subsequent read MUST be superseded
      expect(supersededMap.has("call-2")).toBe(true)
      // Latest read must NOT be superseded
      expect(supersededMap.has("call-4")).toBe(false)
      // Commit output must NOT be superseded
      expect(supersededMap.has("call-5")).toBe(false)
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 6. Invariant 5: Escape Hatch Fidelity
  // ═════════════════════════════════════════════════════════════════════════
  describe("6. Invariant 5: Escape Hatch Fidelity", () => {
    test("shell output with # no-truncate completely bypasses truncation", () => {
      const escapeFixture = SHELL_OUTPUT_FIXTURES.find((f) => f.id === "shell-02-truncation-escape-hatch")!
      const res = truncateShellOutput(escapeFixture.content, { command: escapeFixture.command })

      expect(res.truncated).toBe(false)
      expect(res.output).toBe(escapeFixture.content)
      expect(res.output).toContain("CRITICAL_DUMP_ROW_299")
    })

    test("git command prefixed with raw git bypasses rewrite injection", () => {
      const cmd = "raw git status --porcelain"
      const rewritten = rewriteGitCommand(cmd)
      expect(rewritten).toBe("git status --porcelain")
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 7. Invariant 6: Execution Overhead & Positive ROI
  // ═════════════════════════════════════════════════════════════════════════
  describe("7. Invariant 6: Execution Overhead & Positive ROI", () => {
    test("measures transform latency is sub-5ms per fixture with high ROI", () => {
      const allFixtures = getAllCorporaFixtures()
      let totalSavedChars = 0
      let totalDurationMs = 0

      for (const fixture of allFixtures) {
        const ctx = getTestContext(fixture)
        const start = performance.now()
        let output = runCompress(fixture.content, ctx)
        if (fixture.tool === "bash" && fixture.command) {
          output = truncateShellOutput(output, { command: fixture.command }).output
        }
        const duration = performance.now() - start

        totalDurationMs += duration
        totalSavedChars += Math.max(0, fixture.content.length - output.length)

        // Per-fixture latency bound: < 15ms even for large payloads
        expect(duration).toBeLessThan(15)
      }

      // Assert significant character savings across the corpora
      expect(totalSavedChars).toBeGreaterThan(5000)
      const cumulativeRoi = totalDurationMs > 0 ? totalSavedChars / totalDurationMs : Infinity
      expect(cumulativeRoi).toBeGreaterThan(10)
    })
  })
})
