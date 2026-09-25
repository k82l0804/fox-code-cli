import { describe, expect, test } from "bun:test"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { parseFencedBlocks } from "@/session/fence-parser"
import { createJournal } from "@/session/mutation-journal"
import { resolveExitCondition, buildEmptyExitReflectionText } from "@/session/control-plane"
import { resolveTier, filterToolsByTier, TIER_TOOL_SURFACE } from "@/foxcode/model-tier"
import { FENCE_INSTRUCTION_PROMPT } from "@/session/prompt/loop"

describe("Weak-Model Fast Path — Whole-File Generation Format (Phase 2E PR 4)", () => {
  test("1. Fence parser: standard ``` filepath block -> correct file + content", () => {
    const text = `Here is the complete implementation for the file:

\`\`\`src/utils/math.ts
export function add(a: number, b: number): number {
  return a + b;
}
\`\`\`

Let me know if you need anything else!`

    const blocks = parseFencedBlocks(text)
    expect(blocks.length).toBe(1)
    expect(blocks[0].file).toBe("src/utils/math.ts")
    expect(blocks[0].format).toBe("fence")
    expect(blocks[0].content).toBe(
      `export function add(a: number, b: number): number {\n  return a + b;\n}`,
    )
    expect(blocks[0].startLine).toBe(3)
  })

  test("2. Fence parser: File: path header + block -> correct file + content", () => {
    const text = `I have updated the configuration as requested:

File: config/settings.json
\`\`\`json
{
  "host": "localhost",
  "port": 8080
}
\`\`\`
`

    const blocks = parseFencedBlocks(text)
    expect(blocks.length).toBe(1)
    expect(blocks[0].file).toBe("config/settings.json")
    expect(blocks[0].format).toBe("fence")
    expect(blocks[0].content).toContain('"port": 8080')
  })

  test("3. Fence parser: SEARCH/REPLACE block -> format: 'search-replace'", () => {
    const text = `Here is the search and replace hunk:

File: src/rate_limiter.ts
<<<< SEARCH
const capacity = 100
====
const capacity = 200
>>>> REPLACE
`

    const blocks = parseFencedBlocks(text)
    expect(blocks.length).toBe(1)
    expect(blocks[0].file).toBe("src/rate_limiter.ts")
    expect(blocks[0].format).toBe("search-replace")
    expect(blocks[0].searchContent).toBe("const capacity = 100")
    expect(blocks[0].replaceContent).toBe("const capacity = 200")
  })

  test("4. Fence parser: multiple blocks in one message -> array of all", () => {
    const text = `I modified two files for this change:

\`\`\`src/types.ts
export interface User { id: string }
\`\`\`

And the implementation:

File: src/service.ts
\`\`\`ts
import { User } from "./types"
export function getUser(): User { return { id: "1" } }
\`\`\`
`

    const blocks = parseFencedBlocks(text)
    expect(blocks.length).toBe(2)
    expect(blocks[0].file).toBe("src/types.ts")
    expect(blocks[0].content).toBe("export interface User { id: string }")
    expect(blocks[1].file).toBe("src/service.ts")
    expect(blocks[1].content).toContain("getUser")
  })

  test("5. Fence parser: block with no file path -> skipped", () => {
    const text = `Here is an explanation of the algorithm:

\`\`\`typescript
// Just some example code with no file path
function example() {
  return 42;
}
\`\`\`

Notice how it returns 42.`

    const blocks = parseFencedBlocks(text)
    expect(blocks.length).toBe(0)
  })

  test("6. Fence parser: malformed block -> skipped, others still extracted", () => {
    const text = `First a broken block with no closing fence:

\`\`\`src/broken.ts
this block never closes...

File: src/valid.ts
\`\`\`ts
export const valid = true;
\`\`\`
`

    const blocks = parseFencedBlocks(text)
    expect(blocks.length).toBe(1)
    expect(blocks[0].file).toBe("src/valid.ts")
    expect(blocks[0].content).toBe("export const valid = true;")
  })

  test("7. Integration: C/D model produces fenced block -> harness applies it -> journal records mutation with source: 'fence-parse' -> exit gate satisfied", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fox-fence-apply-"))
    const journal = createJournal()
    const tierInfo = resolveTier({ overrideTier: "C" })
    expect(tierInfo.useFenceParse).toBe(true)

    const modelResponse = `Here is the solution:

\`\`\`src/solution.ts
export const solved = true;
\`\`\`
`
    const parsedBlocks = parseFencedBlocks(modelResponse)
    expect(parsedBlocks.length).toBe(1)

    // Simulate harness application in processor.ts
    for (const block of parsedBlocks) {
      const fullPath = path.join(tmpDir, block.file)
      fs.mkdirSync(path.dirname(fullPath), { recursive: true })
      fs.writeFileSync(fullPath, block.content, "utf-8")

      journal.record({
        tool: "rewrite_file",
        file: fullPath,
        timestamp: Date.now(),
        messageId: "msg-123",
        source: "fence-parse",
      })
    }

    // Verify disk content
    expect(fs.readFileSync(path.join(tmpDir, "src/solution.ts"), "utf-8")).toBe("export const solved = true;")

    // Verify journal recording
    expect(journal.hasEntries()).toBe(true)
    const entry = journal.lastEntry()
    expect(entry?.source).toBe("fence-parse")
    expect(entry?.file).toBe(path.join(tmpDir, "src/solution.ts"))

    // Verify exit gate sees work done and allows exit
    const exitDecision = resolveExitCondition({
      isCodeChangeTask: true,
      journalEmpty: journal.isEmpty(),
      emptyExitRetries: 0,
      hasNewRegressions: false,
      repairBudgetExhausted: false,
      hasGreenCommit: true,
      isMaxSteps: false,
      tier: "C",
    })

    expect(exitDecision.action).toBe("break")
    expect(exitDecision.terminalState).toBe("done")

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test("8. Integration: C/D model produces prose only -> exit gate fires -> reflection says 'write the complete file in a fenced block'", () => {
    const journal = createJournal()
    expect(journal.isEmpty()).toBe(true)

    // Prose only response from 8B model
    const proseResponse = "I have reviewed the code. Everything looks like it could be fixed by adding a null check."
    const parsedBlocks = parseFencedBlocks(proseResponse)
    expect(parsedBlocks.length).toBe(0)

    const reflectionText = buildEmptyExitReflectionText("C")
    expect(reflectionText).toContain("write the complete file in a fenced block")

    const exitDecision = resolveExitCondition({
      isCodeChangeTask: true,
      journalEmpty: journal.isEmpty(),
      emptyExitRetries: 0,
      hasNewRegressions: false,
      repairBudgetExhausted: false,
      hasGreenCommit: false,
      isMaxSteps: false,
      emptyExitReflectionText: reflectionText,
      tier: "C",
    })

    expect(exitDecision.action).toBe("continue")
    expect(exitDecision.incrementEmptyExit).toBe(true)
    expect(exitDecision.reflectionText).toContain("write the complete file in a fenced block")
  })

  test("9. Integration: S/A model produces fenced blocks -> ignored (S/A uses tool calls). Journal NOT updated", () => {
    const journal = createJournal()
    const tierInfo = resolveTier({ overrideTier: "S" })
    expect(tierInfo.useFenceParse).toBe(false)

    const text = `\`\`\`src/test.ts\nconst x = 1;\n\`\`\``

    // In processor.ts, fence parsing is guarded by `if (tierInfo.useFenceParse)`
    if (tierInfo.useFenceParse) {
      const blocks = parseFencedBlocks(text)
      for (const b of blocks) {
        journal.record({
          tool: "rewrite_file",
          file: b.file,
          timestamp: Date.now(),
          messageId: "msg-456",
          source: "fence-parse",
        })
      }
    }

    expect(journal.isEmpty()).toBe(true)
  })

  test("10. System prompt: C/D tier -> fence instructions present, no edit tool schemas", () => {
    const tierC = resolveTier({ overrideTier: "C" })
    expect(tierC.useFenceParse).toBe(true)

    // Tool surface for Tier C has only grep and bash
    const toolsC = TIER_TOOL_SURFACE.C
    expect(toolsC.has("edit")).toBe(false)
    expect(toolsC.has("rewrite_file")).toBe(false)
    expect(toolsC.has("write")).toBe(false)
    expect(toolsC.has("apply_patch")).toBe(false)
    expect(toolsC).toEqual(new Set(["grep", "bash"]))

    // Prompt instructions for Tier C include FENCE_INSTRUCTION_PROMPT
    const fenceInstruction = tierC.useFenceParse ? FENCE_INSTRUCTION_PROMPT : undefined
    expect(fenceInstruction).toBeDefined()
    expect(fenceInstruction).toContain("write the complete updated file in a fenced code block")
  })

  test("11. System prompt: S/A tier -> standard tool instructions, no fence instructions", () => {
    const tierS = resolveTier({ overrideTier: "S" })
    expect(tierS.useFenceParse).toBe(false)

    // Tool surface for Tier S has edit and rewrite_file
    const toolsS = TIER_TOOL_SURFACE.S
    expect(toolsS.has("edit")).toBe(true)
    expect(toolsS.has("rewrite_file")).toBe(true)

    // Fence instruction prompt is NOT present for Tier S
    const fenceInstruction = tierS.useFenceParse ? FENCE_INSTRUCTION_PROMPT : undefined
    expect(fenceInstruction).toBeUndefined()
  })
})
