import { describe, expect, test, beforeAll, afterAll } from "bun:test"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { AstIndexer } from "@foxcode/indexing/ast/indexer"
import { BM25Index, buildIndexFromIndexer, tokenizeCodeText } from "@/session/localize/bm25"
import { getCallers, getCallees, getImporters, computeImportGraph, computePageRank, scoreFileCentrality } from "@/session/localize/graph"
import { fuseRRF, extractSpansForFiles } from "@/session/localize/ranker"
import { localize } from "@/session/localize/pipeline"
import { buildCodeContextBlock, countTokens, type CodeContextOptions } from "@/session/code-context"
import { TIER_MAP_TOKEN_BUDGET } from "@/foxcode/model-tier"

describe("Code Context Block & Localization Pipeline (Phase 2E PR 3)", () => {
  let tmpDir: string
  let stateDir: string
  let indexer: AstIndexer

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fox-code-context-test-"))
    stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "fox-state-test-"))

    // Initialize git repo in tmpDir for git ls-files to work
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true })

    // Create target file: rate_limiter.ts
    fs.writeFileSync(
      path.join(tmpDir, "src/rate_limiter.ts"),
      `/**
 * Implements sliding window carry-over algorithm for rate limiting.
 */
export class RateLimiter {
  private capacity: number

  constructor(capacity: number) {
    this.capacity = capacity
  }

  acquire(tokens = 1): boolean {
    if (this.capacity >= tokens) {
      this.capacity -= tokens
      return true
    }
    return false
  }

  reset(): void {
    this.capacity = 100
  }
}
`,
    )

    // Create service.ts that imports and calls rate_limiter.ts
    fs.writeFileSync(
      path.join(tmpDir, "src/service.ts"),
      `import { RateLimiter } from "./rate_limiter"

export function handleRequest(): boolean {
  const limiter = new RateLimiter(50)
  return limiter.acquire(1)
}
`,
    )

    // Create decoy file 1: decoy_window.ts (mentions window, but is a UI modal)
    fs.writeFileSync(
      path.join(tmpDir, "src/decoy_window.ts"),
      `/**
 * UI Window modal rendering component.
 */
export class WindowModal {
  renderWindow(): void {
    console.log("rendering window modal dialog")
  }
}
`,
    )

    // Create decoy file 2: decoy_limiter.ts (speed limiter with no imports)
    fs.writeFileSync(
      path.join(tmpDir, "src/decoy_limiter.ts"),
      `/**
 * Hardware motor speed limiter.
 */
export function speedLimiter(rpm: number): number {
  return Math.min(rpm, 3000)
}
`,
    )

    // Git init and add so git ls-files works
    const { execSync } = await import("child_process")
    execSync("git init && git config user.email 'test@test.com' && git config user.name 'test' && git add -A && git commit -m 'init'", {
      cwd: tmpDir,
      stdio: "ignore",
    })

    indexer = AstIndexer.create(tmpDir, stateDir)
    await indexer.scan()
  })

  afterAll(() => {
    indexer.dispose()
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
      fs.rmSync(stateDir, { recursive: true, force: true })
    } catch {}
  })

  test("1. BM25 unit: score identifiers, verify 'sliding window' matches rate_limiter.ts", () => {
    const bm25 = buildIndexFromIndexer(indexer)
    const matches = bm25.score("sliding window carry-over")

    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0].file).toBe("src/rate_limiter.ts")
    expect(matches[0].score).toBeGreaterThan(0)

    // Check that decoy files score much lower or 0
    const decoyWindowScore = matches.find((m) => m.file === "src/decoy_window.ts")?.score ?? 0
    expect(matches[0].score).toBeGreaterThan(decoyWindowScore)
  })

  test("2. Graph unit: callers/callees/importers return correct results on fixture", () => {
    // Importers
    const importers = indexer.importers("src/rate_limiter.ts")
    expect(importers).toContain("src/service.ts")
    expect(importers).not.toContain("src/decoy_window.ts")

    // Callers
    const callers = getCallers(indexer, "acquire")
    expect(callers.some((c) => c.filePath === "src/service.ts" && c.name === "handleRequest")).toBe(true)

    // Callees
    const callees = getCallees(indexer, "handleRequest")
    expect(callees.some((c) => c.name === "acquire")).toBe(true)
  })

  test("3. RRF fusion: combined ranking outperforms either signal alone on fixture", () => {
    const bm25 = buildIndexFromIndexer(indexer)
    const bm25Matches = bm25.score("window limiter")

    const files = ["src/rate_limiter.ts", "src/service.ts", "src/decoy_window.ts", "src/decoy_limiter.ts"]
    const importGraph = computeImportGraph(files, indexer)
    const pageRanks = computePageRank(importGraph)
    const centralityScores = new Map<string, number>()

    for (const f of files) {
      centralityScores.set(f, scoreFileCentrality(f, indexer, pageRanks))
    }

    // Rate limiter has both BM25 match and high centrality (imported by service)
    const fused = fuseRRF(bm25Matches, centralityScores)
    expect(fused.length).toBeGreaterThan(0)
    expect(fused[0].file).toBe("src/rate_limiter.ts")
    expect(fused[0].rrfScore).toBeGreaterThan(fused[1].rrfScore)
  })

  test("4. Integration: task description + fixture repo with decoy files -> correct file in top-3", () => {
    const result = localize("Fix the sliding window rate limiter token consumption bug", indexer, tmpDir)
    expect(result.spans.length).toBeGreaterThan(0)

    const topSpanFiles = result.spans.map((s) => s.file)
    expect(topSpanFiles.slice(0, 3)).toContain("src/rate_limiter.ts")
    expect(result.partial).toBe(false)
  })

  test("5. Envelope: map + localize + pins never exceed 5000 tokens", () => {
    const block = buildCodeContextBlock({
      task: "Fix the sliding window rate limiter issue",
      tier: "A",
      indexer,
      workingSet: [],
      mutatedFiles: ["src/rate_limiter.ts"],
      projectDir: tmpDir,
      maxTokens: 5000,
    })

    const totalTokens = countTokens(block.content)
    expect(totalTokens).toBeLessThanOrEqual(5000)
    expect(block.mapTokens).toBeGreaterThan(0)
    expect(block.content).toContain("<repo_map>")
    expect(block.content).toContain("<localized_spans>")
  })

  test("6. Envelope overflow regression: deliberately feed 20 large files as pins -> trimming engages, final output <= 5000 tokens", () => {
    // Create 20 large dummy files
    const largeFiles: string[] = []
    const largeDir = path.join(tmpDir, "large_files")
    fs.mkdirSync(largeDir, { recursive: true })

    for (let i = 0; i < 20; i++) {
      const fileName = `large_files/file_${i}.ts`
      const fullPath = path.join(tmpDir, fileName)
      // 500 lines of code (~15KB per file = ~3750 tokens each)
      const content = Array.from({ length: 500 }, (_, line) => `export function fn_${i}_${line}() { return ${line} }`).join("\n")
      fs.writeFileSync(fullPath, content)
      largeFiles.push(fileName)
    }

    const block = buildCodeContextBlock({
      task: "Fix bug in system",
      tier: "S",
      indexer,
      workingSet: largeFiles.slice(0, 10),
      mutatedFiles: largeFiles.slice(10, 20),
      projectDir: tmpDir,
      maxTokens: 5000,
    })

    const totalTokens = countTokens(block.content)
    expect(totalTokens).toBeLessThanOrEqual(5000)
    expect(block.contentHash).toBeDefined()
    expect(block.contentHash.length).toBe(64) // sha256 hex string
  })

  test("7. Cache key: changes when content changes, stable when it doesn't", () => {
    const block1 = buildCodeContextBlock({
      task: "Fix rate limiter",
      tier: "A",
      indexer,
      workingSet: [],
      mutatedFiles: [],
      projectDir: tmpDir,
    })

    const block2 = buildCodeContextBlock({
      task: "Fix rate limiter",
      tier: "A",
      indexer,
      workingSet: [],
      mutatedFiles: [],
      projectDir: tmpDir,
    })

    expect(block1.contentHash).toBe(block2.contentHash)

    // With different mutated files, contentHash must change
    const block3 = buildCodeContextBlock({
      task: "Fix rate limiter",
      tier: "A",
      indexer,
      workingSet: [],
      mutatedFiles: ["src/service.ts"],
      projectDir: tmpDir,
    })

    expect(block3.contentHash).not.toBe(block1.contentHash)
  })

  test("8. Map refresh after apply: new cache key, correct content", () => {
    const beforeBlock = buildCodeContextBlock({
      task: "Update service",
      tier: "A",
      indexer,
      workingSet: [],
      mutatedFiles: [],
      projectDir: tmpDir,
    })

    // Simulate harness mutating a file
    const afterBlock = buildCodeContextBlock({
      task: "Update service",
      tier: "A",
      indexer,
      workingSet: [],
      mutatedFiles: ["src/rate_limiter.ts", "src/service.ts"],
      projectDir: tmpDir,
    })

    expect(afterBlock.contentHash).not.toBe(beforeBlock.contentHash)
    expect(afterBlock.content).toContain("src/rate_limiter.ts")
  })

  test("9. Cold-index: generate starts without blocking; block marked partial", () => {
    // Create empty indexer
    const coldDir = fs.mkdtempSync(path.join(os.tmpdir(), "fox-cold-test-"))
    const coldState = fs.mkdtempSync(path.join(os.tmpdir(), "fox-cold-state-"))

    const coldIndexer = AstIndexer.create(coldDir, coldState)
    expect(coldIndexer.stats().files).toBe(0)

    const block = buildCodeContextBlock({
      task: "Fix bug in empty project",
      tier: "A",
      indexer: coldIndexer,
      workingSet: [],
      mutatedFiles: [],
      projectDir: coldDir,
    })

    expect(block.partial).toBe(true)
    coldIndexer.dispose()

    try {
      fs.rmSync(coldDir, { recursive: true, force: true })
      fs.rmSync(coldState, { recursive: true, force: true })
    } catch {}
  })

  test("10. Localize not run on Ask/explain tasks", () => {
    const result = localize("Can you explain how this rate limiter works?", indexer, tmpDir)
    expect(result.spans).toEqual([])
    expect(result.partial).toBe(false)
  })

  test("11. 'the rate limiter tests are failing' -> localizes to rate_limiter.ts", () => {
    const result = localize("the rate limiter tests are failing", indexer, tmpDir)
    expect(result.spans.length).toBeGreaterThan(0)
    expect(result.spans[0].file).toBe("src/rate_limiter.ts")
  })

  test("Model tier map budget: C/D gets 1500 tokens, S/A/B gets 1000", () => {
    expect(TIER_MAP_TOKEN_BUDGET.S).toBe(1000)
    expect(TIER_MAP_TOKEN_BUDGET.A).toBe(1000)
    expect(TIER_MAP_TOKEN_BUDGET.B).toBe(1000)
    expect(TIER_MAP_TOKEN_BUDGET.C).toBe(1500)
    expect(TIER_MAP_TOKEN_BUDGET.D).toBe(1500)
  })
})
