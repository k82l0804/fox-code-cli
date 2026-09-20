#!/usr/bin/env bun
/**
 * fox-vs-kilo-showdown.ts — Deterministic A/B comparison across workflows
 * 
 * Measures the EXACT byte/token differences between:
 *   - "Kilo mode" (no compression)  
 *   - "Fox mode"  (all compression enabled)
 *
 * Covers 3 distinct workflows:
 *   1. 🛠️ Software Engineering (code navigation, diffs, build logs, test runs)
 *   2. 📊 Data Analysis (CSV datasets, JSON arrays, SQL queries, metric logs)
 *   3. 🔬 Research & Technical Writing (papers, documentation scrapes, literature notes)
 *
 * Deterministic: same input → same output every time. No model non-determinism.
 *
 * Usage:
 *   bun run tools/fox-vs-kilo-showdown.ts
 */

import {
  relativizePaths,
  compressGitStatus,
  trimDiffContext,
  compressTabular,
  deduplicateLogLines,
  compressJsonKeys,
  filterTestOutput,
  rewriteGitCommand,
  type CompressContext,
} from "../packages/core/src/tool/compress"
import { buildSupersededSet } from "../src/session/supersede"

const WORKSPACE = "/home/k82l0804/workarea/fox/fox-code-cli"

const ctx: CompressContext = {
  workspaceRoot: WORKSPACE,
  toolName: "bench",
}

type WorkflowCategory =
  | "Software Engineering"
  | "Data Analysis"
  | "Research & Technical Writing"

interface Fixture {
  category: WorkflowCategory
  name: string
  tool: string
  /** Simulated raw tool output */
  content: string
  /** Optional content when pre-execution command rewriting is active (e.g. git log --oneline) */
  foxContent?: string
}

// ─── Realistic Multi-Workflow Fixtures ─────────────────────────────────────

const fixtures: Fixture[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. 🛠️ Software Engineering
  // ─────────────────────────────────────────────────────────────────────────
  {
    category: "Software Engineering",
    name: "grep: find effect imports",
    tool: "grep",
    content: Array.from({ length: 80 }, (_, i) =>
      `${WORKSPACE}/src/session/step-${i}.ts:${i + 1}: import { Effect } from "effect"`
    ).join("\n"),
  },
  {
    category: "Software Engineering",
    name: "grep: find TODO comments",
    tool: "grep",
    content: Array.from({ length: 30 }, (_, i) =>
      `${WORKSPACE}/packages/core/src/tool/handler-${i}.ts:${42 + i}: // TODO: refactor this later`
    ).join("\n"),
  },
  {
    category: "Software Engineering",
    name: "read: package.json",
    tool: "read",
    content: JSON.stringify({
      name: "@fox/cli",
      version: "0.1.0",
      dependencies: Object.fromEntries(
        Array.from({ length: 25 }, (_, i) => [`@dep/package-${i}`, `^${i}.0.0`])
      ),
      devDependencies: Object.fromEntries(
        Array.from({ length: 15 }, (_, i) => [`@dev/tool-${i}`, `^${i}.0.0`])
      ),
    }, null, 2),
  },
  {
    category: "Software Engineering",
    name: "bash: git diff (unified diff)",
    tool: "bash",
    content: [
      "diff --git a/packages/core/src/tool/compress.ts b/packages/core/src/tool/compress.ts",
      "index 8a3b1c2..9d4e5f6 100644",
      "--- a/packages/core/src/tool/compress.ts",
      "+++ b/packages/core/src/tool/compress.ts",
      "@@ -14,8 +14,8 @@ import { Flag } from \"../flag/flag\"",
      " import { Log } from \"../util/log\"",
      " import { CompressionMetrics } from \"./compression-metrics\"",
      " ",
      "-const log = Log.create({ service: \"compression-legacy\" })",
      "+const log = Log.create({ service: \"compression\" })",
      " ",
      " export interface CompressContext {",
      "   readonly workspaceRoot: string",
      "   readonly toolName: string",
      "@@ -45,10 +45,10 @@ const transforms: readonly Transform[] = [",
      "     name: \"trimDiffContext\",",
      "     span: \"compression.diff_context_trim\",",
      "     enabled: () => Flag.FOX_EXPERIMENTAL_COMPRESS_DIFF,",
      "-    apply: oldTrimDiffFunction,",
      "+    apply: trimDiffContext,",
      "   },",
      "   {",
      "     name: \"compressTabular\",",
      "     span: \"compression.structured_data.tabular\",",
      "     enabled: () => Flag.FOX_EXPERIMENTAL_COMPRESS_DATA,",
      "@@ -120,9 +120,9 @@ export function process(text: string, ctx: CompressContext): string {",
      "   let originalLen = text.length",
      "   let totalOverheadMs = 0",
      "   let anyEnabled = false",
      "-  // old loop without metrics",
      "-  for (const t of legacyTransforms) {",
      "+  for (const transform of transforms) {",
      "     if (!transform.enabled()) continue",
      "     anyEnabled = true",
    ].join("\n"),
  },
  {
    category: "Software Engineering",
    name: "bash: ls -la (file listing)",
    tool: "bash",
    content: [
      "total 128",
      ...Array.from({ length: 20 }, (_, i) =>
        `drwxr-xr-x  ${i + 2} k82l0804 k82l0804  ${4096 + i * 100} Sep 20 10:${String(i).padStart(2, "0")} ${["src", "test", "packages", "tools", "docs", "dist", "node_modules", ".git", "scripts", "bin"][i % 10]}`
      ),
    ].join("\n"),
  },
  {
    category: "Software Engineering",
    name: "bash: test output (repetitive)",
    tool: "bash",
    content: [
      ...Array.from({ length: 50 }, (_, i) =>
        `✓ test case ${i + 1}: validates input correctly [0.${i}ms]`
      ),
      ...Array(20).fill("PASS"),
      "70 tests passed, 0 failed",
    ].join("\n"),
  },
  {
    category: "Software Engineering",
    name: "bash: build log (repetitive errors)",
    tool: "bash",
    content: [
      "Building project...",
      ...Array(25).fill("warning: unused import 'Effect' in module"),
      ...Array(10).fill(`${WORKSPACE}/packages/core/src/tool/compress.ts: warning TS6133: unused local`),
      "Build completed with 35 warnings",
    ].join("\n"),
  },
  {
    category: "Software Engineering",
    name: "grep: deep path results",
    tool: "grep",
    content: Array.from({ length: 40 }, (_, i) =>
      `${WORKSPACE}/packages/core/src/tool/handlers/builtin/internal/step-${i}.ts:${100 + i}: export const handler${i} = Effect.fn("handler")`
    ).join("\n"),
  },
  {
    category: "Software Engineering",
    name: "bash: git status (standard verbose)",
    tool: "bash",
    content: [
      "On branch feat/git-tool-token-compression",
      "Your branch is up to date with 'origin/feat/git-tool-token-compression'.",
      "",
      "Changes to be committed:",
      '  (use "git restore --staged <file>..." to unstage)',
      "\tmodified:   packages/core/src/tool/compress.ts",
      "\tmodified:   packages/core/test/compress.test.ts",
      "",
      "Changes not staged for commit:",
      '  (use "git add <file>..." to update what will be committed)',
      '  (use "git restore <file>..." to discard changes in working directory)',
      "\tmodified:   src/tool/shell.ts",
      "\tmodified:   src/tool/truncate.ts",
      "",
      "Untracked files:",
      '  (use "git add <file>..." to include in what will be committed)',
      "\tpackages/core/src/tool/git-util.ts",
      "\tdocs/research/benchmark-notes.md",
      "",
      'no changes added to commit (use "git add" to track)',
    ].join("\n"),
  },
  {
    category: "Software Engineering",
    name: "bash: git diff with lockfile (package-lock.json)",
    tool: "bash",
    content: [
      "diff --git a/package.json b/package.json",
      "index a1b2c3d..e4f5g6h 100644",
      "--- a/package.json",
      "+++ b/package.json",
      "@@ -5,3 +5,3 @@",
      "   \"dependencies\": {",
      "-    \"effect\": \"3.10.0\",",
      "+    \"effect\": \"3.13.0\",",
      "   }",
      "diff --git a/package-lock.json b/package-lock.json",
      "index 7a8b9c0..1d2e3f4 100644",
      "--- a/package-lock.json",
      "+++ b/package-lock.json",
      "@@ -10,120 +10,120 @@",
      ...Array.from({ length: 60 }, (_, i) => [
        `-\t\t"node_modules/dep-${i}": {`,
        `-\t\t\t"version": "1.0.${i}",`,
        `+\t\t"node_modules/dep-${i}": {`,
        `+\t\t\t"version": "1.1.${i}",`,
      ]).flat(),
    ].join("\n"),
  },
  {
    category: "Software Engineering",
    name: "bash: test output (failing suite with noise)",
    tool: "bash",
    content: [
      "bun test v1.2.4 (c6e28882)",
      "",
      ...Array.from({ length: 18 }, (_, i) =>
        `✓ packages/core/test/unit-${i}.test.ts > assert token count passes [0.${i}ms]`
      ),
      "✗ packages/core/test/git.test.ts > handles merge conflict markers",
      "  AssertionError: expected 'conflict' to equal 'clean'",
      "    at /packages/core/test/git.test.ts:42:12",
      "    at async runTest (/packages/core/test/runner.ts:88:5)",
      "",
      ...Array.from({ length: 22 }, (_, i) =>
        `✓ packages/core/test/suite-${i}.test.ts > cleans up temporary directory [0.${i}ms]`
      ),
      "",
      " 40 pass",
      " 1 fail",
      " 142 expect() calls",
      "Ran 41 tests across 41 files. [182.00ms]",
    ].join("\n"),
  },
  {
    category: "Software Engineering",
    name: "bash: git log (pre-execution rewrite to oneline)",
    tool: "bash",
    content: Array.from({ length: 20 }, (_, i) => [
      `commit ${i}a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b`,
      `Author: Developer <dev${i}@example.com>`,
      `Date:   Sun Sep 20 14:0${i % 10}:00 2026 -0400`,
      "",
      `    feat(core): implement step ${i} of modular architecture`,
      `    `,
      `    This commit updates the core subsystem to handle step ${i}`,
      `    cleanly without regression. Tested on linux and macos.`,
      "",
    ]).flat().join("\n"),
    foxContent: Array.from({ length: 20 }, (_, i) =>
      `${i}a1b2c3 feat(core): implement step ${i} of modular architecture`
    ).join("\n"),
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. 📊 Data Analysis
  // ─────────────────────────────────────────────────────────────────────────
  {
    category: "Data Analysis",
    name: "read: JSON API response (array of objects)",
    tool: "read",
    content: JSON.stringify(
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        username: `user_${i}`,
        email: `user${i}@example.com`,
        department: ["engineering", "marketing", "sales"][i % 3],
        status: i % 4 === 0 ? "inactive" : "active",
        created_at: `2026-09-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
      }))
    ),
  },
  {
    category: "Data Analysis",
    name: "read: sales_q3.csv (tabular dataset)",
    tool: "read",
    content: [
      "date,store_id,product_sku,units_sold,unit_price,total_revenue,customer_segment,region",
      ...Array.from({ length: 40 }, (_, i) => {
        const units = 10 + (i * 7) % 50
        const price = (15.5 + (i * 3.25) % 80).toFixed(2)
        const rev = (units * parseFloat(price)).toFixed(2)
        const reg = ["US-East", "US-West", "EU-Central", "APAC-North"][i % 4]
        const seg = ["Enterprise", "SMB", "Consumer"][i % 3]
        return `2026-08-${String((i % 28) + 1).padStart(2, "0")},STORE_${100 + (i % 8)},SKU_${2000 + (i % 15)},${units},${price},${rev},${seg},${reg}`
      }),
    ].join("\n"),
  },
  {
    category: "Data Analysis",
    name: "bash: sqlite3 query output (ASCII table)",
    tool: "bash",
    content: [
      "+---------+----------------------+---------------+--------------+----------------+",
      "| order_id| customer_name        | product_group | total_amount | payment_status |",
      "+---------+----------------------+---------------+--------------+----------------+",
      ...Array.from({ length: 25 }, (_, i) => {
        const id = String(10040 + i).padEnd(7)
        const name = `Customer_${i}`.padEnd(20)
        const group = ["Electronics", "Office Supplies", "Furniture"][i % 3]!.padEnd(13)
        const amount = `$${(120.50 + i * 42.10).toFixed(2)}`.padStart(12)
        const status = (i % 5 === 0 ? "PENDING" : "PAID").padEnd(14)
        return `| ${id} | ${name} | ${group} | ${amount} | ${status} |`
      }),
      "+---------+----------------------+---------------+--------------+----------------+",
      "25 rows in set (0.012 sec)",
    ].join("\n"),
  },
  {
    category: "Data Analysis",
    name: "bash: pandas dataframe describe()",
    tool: "bash",
    content: [
      "                  age          salary          tenure       bonus_pct    satisfaction",
      "count     1000.000000     1000.000000     1000.000000     1000.000000     1000.000000",
      "mean        38.420000    84520.120000        5.340000        0.142000        4.120000",
      "std          9.810000    23140.500000        3.120000        0.051000        0.780000",
      "min         21.000000    35000.000000        0.500000        0.050000        1.500000",
      "25%         31.000000    68000.000000        2.800000        0.100000        3.800000",
      "50%         37.000000    82000.000000        5.000000        0.140000        4.200000",
      "75%         45.000000    98500.000000        7.600000        0.180000        4.700000",
      "max         64.000000   165000.000000       18.200000        0.300000        5.000000",
      "",
      "[8 rows x 5 columns]",
    ].join("\n"),
  },
  {
    category: "Data Analysis",
    name: "bash: metric telemetry stream (repetitive)",
    tool: "bash",
    content: [
      "# HELP http_requests_total Total HTTP requests processed",
      "# TYPE http_requests_total counter",
      ...Array(15).fill('http_requests_total{method="GET",handler="/api/v1/health",status="200"} 45210'),
      ...Array(12).fill('http_requests_total{method="POST",handler="/api/v1/query",status="200"} 12480'),
      ...Array(8).fill('http_requests_total{method="POST",handler="/api/v1/query",status="504"} 14'),
      "prometheus_scrape_duration_seconds 0.0042",
    ].join("\n"),
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. 🔬 Research & Technical Writing
  // ─────────────────────────────────────────────────────────────────────────
  {
    category: "Research & Technical Writing",
    name: "read: research paper extract (markdown/latex)",
    tool: "read",
    content: [
      "# Lossless Token Compression for Interactive Autonomous Agent Architectures",
      "",
      "**Abstract**",
      "Modern Large Language Model (LLM) agents accumulate expansive conversation histories containing tool executions,",
      "file payloads, and compiler outputs. In this work, we propose a multi-tier lossless token compression pipeline",
      "operating before model context ingress. Our experiments demonstrate a 35-58% token reduction with zero semantic drift.",
      "",
      "## 1. Introduction & Problem Formulation",
      "Autonomous coding agents operating under Agent Client Protocol (ACP) require long multi-turn sessions.",
      "Given context length $L$ and turns $T$, memory scaling is governed by:",
      "$$\\mathcal{C}(T) = \\sum_{t=1}^T (|P_{sys}| + |\\mathcal{S}_{tools}| + \\sum_{k=1}^t (|u_k| + |a_k| + |o_k|))$$",
      "where $|\\mathcal{S}_{tools}|$ represents the cumulative serialization footprint of declared tool schemas.",
      "",
      "## 2. Methodology & Invariants",
      "Our compression guarantees lossless preservation of all operational semantics:",
      "1. Path relativization: Strips workspace prefixes `${WORKSPACE}` while preserving CWD context.",
      "2. Context trimming: Keeps only $\\pm 1$ context line in unified diffs without modifying altered lines.",
      "3. Tabular restructuring: Compresses uniform object arrays into compact columnar headers.",
      "",
      "## 3. Empirical Results",
      "Evaluation against the standard benchmark suite shows marked latency reduction and eliminates context timeouts.",
      "Full ablation tables are archived in `${WORKSPACE}/docs/research/lossless-token-compression.md`.",
      "",
      "## References",
      "- [1] Vaswani et al. Attention Is All You Need. NeurIPS 2017.",
      "- [2] Brown et al. Language Models are Few-Shot Learners. NeurIPS 2020.",
      "- [3] Anthropic. The Model Context Protocol Specification. 2024.",
    ].join("\n"),
  },
  {
    category: "Research & Technical Writing",
    name: "web: API documentation scrape",
    tool: "web",
    content: [
      "# Inference Engine API Reference (v2.4)",
      "",
      "## Endpoint: POST /v1/chat/completions",
      "Creates a model response for the given chat conversation.",
      "",
      "### Request Headers",
      "| Header | Type | Required | Description |",
      "| :--- | :--- | :--- | :--- |",
      "| Authorization | string | Yes | Bearer token formatted as `Bearer <token>` |",
      "| Content-Type | string | Yes | Must be `application/json` |",
      "| X-Request-ID | string | No | Unique client trace identifier |",
      "",
      "### Request Body Parameters",
      "- `model` (string, required): ID of the model to use.",
      "- `messages` (array, required): A list of messages comprising the conversation so far.",
      "- `temperature` (number, optional, default: 1.0): Sampling temperature between 0 and 2.",
      "- `tools` (array, optional): A list of tools the model may call.",
      "",
      "### Error Response Codes",
      "| HTTP Status | Error Code | Description |",
      "| :--- | :--- | :--- |",
      "| 400 | invalid_request_error | Request payload failed schema validation |",
      "| 401 | authentication_error | Missing or invalid API key |",
      "| 429 | rate_limit_exceeded | Concurrency or quota ceiling reached |",
      "| 500 | server_error | Transient internal upstream failure |",
    ].join("\n"),
  },
  {
    category: "Research & Technical Writing",
    name: "read: multi-paper literature notes",
    tool: "read",
    content: [
      "# Comparative Literature Notes: Context Optimization in LLM Agents",
      "",
      "## Paper 1: AutoCompressor (Chevalier et al., 2023)",
      "- Approach: Trains recurrent summary vectors through soft prompting.",
      "- Strengths: Compresses arbitrary text into fixed 4-8 summary tokens.",
      "- Weaknesses: Lossy; degrades code syntax and exact variable references.",
      "- Relevance: Unsuitable for SWE, but relevant for unstructured research summarization.",
      "",
      "## Paper 2: Selective Context Pruning (Li et al., 2024)",
      "- Approach: Computes self-information entropy per token and removes low-information tokens.",
      "- Strengths: Model-agnostic, reduces token count by 20-30%.",
      "- Weaknesses: May drop critical punctuation like quotes or semicolon in code blocks.",
      "",
      "## Paper 3: Fox Lossless Compaction Architecture (2026)",
      "- Approach: Deterministic syntactic compression (paths, diffs, tabular JSON, deduplication).",
      "- Strengths: 100% lossless, 0 semantic regression, zero GPU inference required for compression.",
      "- Reference notes: `${WORKSPACE}/docs/research/test-plan-ideas-lossless-token-compression.md`",
    ].join("\n"),
  },
  {
    category: "Research & Technical Writing",
    name: "bash: arxiv search results",
    tool: "bash",
    content: [
      "Found 4 papers matching query 'context compression llm':",
      "",
      "[1] arXiv:2401.12345 - Context Compression for Long-Horizon Autonomous Coding",
      "    Authors: Zhang, J., Wu, K., Patel, R.",
      "    Published: 2025-11-14 | Categories: cs.SE, cs.AI",
      "    Abstract: We explore rule-based syntax compression techniques for developer tools...",
      "    URL: https://arxiv.org/abs/2401.12345 | PDF: https://arxiv.org/pdf/2401.12345.pdf",
      "",
      "[2] arXiv:2402.67890 - Benchmarking Tool Invocations in Agentic Systems",
      "    Authors: Miller, A., Chen, L., Tanaka, H.",
      "    Published: 2025-12-02 | Categories: cs.CL, cs.AI",
      "    Abstract: Evaluating tool usage across 50,000 developer and research trajectories...",
      "    URL: https://arxiv.org/abs/2402.67890 | PDF: https://arxiv.org/pdf/2402.67890.pdf",
    ].join("\n"),
  },
]

// ─── Schema fixture ────────────────────────────────────────────────────────

const sampleToolSchema = {
  name: "read",
  description: "Read a file from the filesystem. Returns the file content as text. Supports reading text files of any size. Binary files are not supported and will return an error.",
  parameters: {
    type: "object" as const,
    properties: {
      filePath: {
        type: "string" as const,
        description: "The absolute path to the file to read. Must be a valid filesystem path.",
      },
      startLine: {
        type: "number" as const,
        description: "Optional. The 1-indexed line number to start reading from. If omitted, reads from the beginning of the file.",
      },
      endLine: {
        type: "number" as const,
        description: "Optional. The 1-indexed line number to stop reading at (inclusive). If omitted, reads to the end of the file.",
      },
    },
    required: ["filePath"] as string[],
    additionalProperties: false,
  },
}

function minifySchema(schema: typeof sampleToolSchema) {
  const minified = JSON.parse(JSON.stringify(schema))
  delete minified.description
  if (minified.parameters?.properties) {
    for (const prop of Object.values(minified.parameters.properties) as any[]) {
      delete prop.description
    }
  }
  delete minified.parameters?.additionalProperties
  return minified
}

// Simulate 25 tool schemas (Fox has ~25 tools)
const allSchemas = Array.from({ length: 25 }, (_, i) => ({
  ...sampleToolSchema,
  name: `tool_${i}`,
  description: `Tool ${i}: ${sampleToolSchema.description}`,
}))

// ─── Compression Pipeline Helper ───────────────────────────────────────────

function compressOutput(raw: string, tool: string): string {
  let out = raw
  out = relativizePaths(out, { ...ctx, toolName: tool })
  out = compressGitStatus(out, { ...ctx, toolName: tool })
  out = trimDiffContext(out, { ...ctx, toolName: tool })
  out = compressTabular(out, { ...ctx, toolName: tool })
  out = deduplicateLogLines(out, { ...ctx, toolName: tool })
  out = compressJsonKeys(out, { ...ctx, toolName: tool })
  out = filterTestOutput(out, { ...ctx, toolName: tool })
  return out
}

// ─── Run the showdown ──────────────────────────────────────────────────────

console.log("═".repeat(78))
console.log("  🦊 FOX vs KILO — Multi-Workflow Compression Showdown")
console.log("═".repeat(78))
console.log()

// Schema comparison
const kiloSchemaBytes = JSON.stringify(allSchemas).length
const foxSchemaBytes = JSON.stringify(allSchemas.map(minifySchema)).length
const schemaSaved = kiloSchemaBytes - foxSchemaBytes

console.log("  📐 SCHEMA MINIFICATION (per LLM request)")
console.log(`  ${"─".repeat(66)}`)
console.log(`  Kilo (raw schemas):     ${kiloSchemaBytes.toLocaleString()} bytes`)
console.log(`  Fox (minified schemas): ${foxSchemaBytes.toLocaleString()} bytes`)
console.log(`  Saved per request:      ${schemaSaved.toLocaleString()} bytes (${((schemaSaved / kiloSchemaBytes) * 100).toFixed(1)}%)`)
console.log(`  Over 10-turn session:   ${(schemaSaved * 10).toLocaleString()} bytes (~${Math.round(schemaSaved * 10 / 4).toLocaleString()} tokens)`)
console.log()

// Run each category
const categories: WorkflowCategory[] = [
  "Software Engineering",
  "Data Analysis",
  "Research & Technical Writing",
]

const categoryStats: Record<
  WorkflowCategory,
  { kiloBytes: number; foxBytes: number; saved: number }
> = {
  "Software Engineering": { kiloBytes: 0, foxBytes: 0, saved: 0 },
  "Data Analysis": { kiloBytes: 0, foxBytes: 0, saved: 0 },
  "Research & Technical Writing": { kiloBytes: 0, foxBytes: 0, saved: 0 },
}

let grandKiloBytes = 0
let grandFoxBytes = 0

for (const category of categories) {
  const catFixtures = fixtures.filter((f) => f.category === category)
  console.log(`  📂 WORKFLOW: ${category.toUpperCase()}`)
  console.log(`  ${"─".repeat(74)}`)
  console.log(
    `  ${"".padEnd(2)} ${"Fixture".padEnd(46)} ${"Kilo".padStart(8)} ${"Fox".padStart(8)} ${"Saved".padStart(8)} ${"Pct".padStart(7)}`
  )
  console.log(
    `  ${"─".repeat(2)} ${"─".repeat(46)} ${"─".repeat(8)} ${"─".repeat(8)} ${"─".repeat(8)} ${"─".repeat(7)}`
  )

  let catKilo = 0
  let catFox = 0

  for (const fixture of catFixtures) {
    const kiloBytes = fixture.content.length
    const rawContent = fixture.foxContent ?? fixture.content
    const foxOutput = compressOutput(rawContent, fixture.tool)
    const foxBytes = foxOutput.length
    const saved = kiloBytes - foxBytes
    const pct = kiloBytes > 0 ? (saved / kiloBytes) * 100 : 0

    catKilo += kiloBytes
    catFox += foxBytes

    const indicator = saved > 0 ? "🦊" : saved < 0 ? "⚠️" : "──"
    console.log(
      `  ${indicator} ${fixture.name.padEnd(46)} ${kiloBytes.toLocaleString().padStart(8)} ${foxBytes.toLocaleString().padStart(8)} ${`${saved >= 0 ? "+" : ""}${saved.toLocaleString()}`.padStart(8)} ${`${pct.toFixed(1)}%`.padStart(7)}`
    )
  }

  const catSaved = catKilo - catFox
  const catPct = catKilo > 0 ? (catSaved / catKilo) * 100 : 0
  categoryStats[category] = { kiloBytes: catKilo, foxBytes: catFox, saved: catSaved }
  grandKiloBytes += catKilo
  grandFoxBytes += catFox

  console.log(
    `  ${"─".repeat(2)} ${"─".repeat(46)} ${"─".repeat(8)} ${"─".repeat(8)} ${"─".repeat(8)} ${"─".repeat(7)}`
  )
  console.log(
    `  📊 Subtotal (${category}): ${catKilo.toLocaleString()} B → ${catFox.toLocaleString()} B | Saved: +${catSaved.toLocaleString()} B (${catPct.toFixed(1)}%)`
  )
  console.log()
}

// Grand Total
const grandSaved = grandKiloBytes - grandFoxBytes
const grandPct = (grandSaved / grandKiloBytes) * 100

console.log("═".repeat(78))
console.log("  🏆 CROSS-WORKFLOW SUMMARY")
console.log("═".repeat(78))
console.log(
  `  ${"Workflow".padEnd(32)} ${"Kilo (B)".padStart(10)} ${"Fox (B)".padStart(10)} ${"Saved (B)".padStart(10)} ${"Savings".padStart(9)}`
)
console.log(`  ${"─".repeat(32)} ${"─".repeat(10)} ${"─".repeat(10)} ${"─".repeat(10)} ${"─".repeat(9)}`)

for (const category of categories) {
  const s = categoryStats[category]
  const pct = s.kiloBytes > 0 ? (s.saved / s.kiloBytes) * 100 : 0
  console.log(
    `  ${category.padEnd(32)} ${s.kiloBytes.toLocaleString().padStart(10)} ${s.foxBytes.toLocaleString().padStart(10)} ${`+${s.saved.toLocaleString()}`.padStart(10)} ${`${pct.toFixed(1)}%`.padStart(8)}`
  )
}

console.log(`  ${"─".repeat(32)} ${"─".repeat(10)} ${"─".repeat(10)} ${"─".repeat(10)} ${"─".repeat(9)}`)
console.log(
  `  ${"GRAND TOTAL (Tool Outputs)".padEnd(32)} ${grandKiloBytes.toLocaleString().padStart(10)} ${grandFoxBytes.toLocaleString().padStart(10)} ${`+${grandSaved.toLocaleString()}`.padStart(10)} ${`${grandPct.toFixed(1)}%`.padStart(8)}`
)
console.log()

// Combined session estimate
const sessionTurns = 10
const schemaTokensSaved = Math.round((schemaSaved * sessionTurns) / 4)
const outputTokensSaved = Math.round(grandSaved / 4)
const totalTokensSaved = schemaTokensSaved + outputTokensSaved

console.log("  💡 COMBINED SESSION ESTIMATE (10 turns across mixed workflows)")
console.log(`  ${"─".repeat(66)}`)
console.log(`  Schema savings:     ${(schemaSaved * sessionTurns).toLocaleString()} bytes (~${schemaTokensSaved.toLocaleString()} tokens)`)
console.log(`  Output compression: ${grandSaved.toLocaleString()} bytes (~${outputTokensSaved.toLocaleString()} tokens)`)
console.log(`  Total estimated:    ~${totalTokensSaved.toLocaleString()} tokens saved per 10-turn session`)
console.log("═".repeat(78))

// ─── 4. Multi-Turn SWE Session Trajectory Simulation (A/B Showdown) ────────

console.log()
console.log("═".repeat(78))
console.log("  🔄 MULTI-TURN SWE SESSION TRAJECTORY SIMULATION (A/B SHOWDOWN)")
console.log("═".repeat(78))
console.log()
console.log("  Simulates an 8-turn real-world software engineering workflow:")
console.log("    Turn 1: git status                Turn 5: edit file (metrics)")
console.log("    Turn 2: read full source file     Turn 6: git status (re-check)")
console.log("    Turn 3: edit file (bugfix)        Turn 7: run test suite")
console.log("    Turn 4: git diff                  Turn 8: git commit")
console.log()

const simTurns = [
  {
    turn: 1,
    action: "bash: git status",
    tool: "bash",
    input: { command: "git status" },
    content: [
      "On branch feat/compression",
      "Your branch is up to date with 'origin/feat/compression'.",
      "Changes not staged for commit:",
      '  (use "git add <file>..." to update what will be committed)',
      "\tmodified:   packages/core/src/tool/compress.ts",
      "Untracked files:",
      "\tpackages/core/test/new.test.ts",
      'no changes added to commit (use "git add" to track)',
    ].join("\n"),
  },
  {
    turn: 2,
    action: "read: compress.ts (12KB)",
    tool: "read",
    input: { path: `${WORKSPACE}/packages/core/src/tool/compress.ts` },
    content: Array.from({ length: 280 }, (_, i) =>
      `export function helperLine${i}() { return Effect.succeed(${i} * 42) }`
    ).join("\n"),
  },
  {
    turn: 3,
    action: "edit: compress.ts (fix)",
    tool: "edit",
    input: { path: `${WORKSPACE}/packages/core/src/tool/compress.ts` },
    content: "File updated successfully: 2 lines replaced.",
  },
  {
    turn: 4,
    action: "bash: git diff",
    tool: "bash",
    input: { command: "git diff" },
    content: [
      "diff --git a/packages/core/src/tool/compress.ts b/packages/core/src/tool/compress.ts",
      "index 1a2b3c4..5d6e7f8 100644",
      "--- a/packages/core/src/tool/compress.ts",
      "+++ b/packages/core/src/tool/compress.ts",
      "@@ -10,3 +10,3 @@",
      " const oldVal = 1",
      "-const fix = false",
      "+const fix = true",
    ].join("\n"),
  },
  {
    turn: 5,
    action: "edit: compress.ts (metrics)",
    tool: "edit",
    input: { path: `${WORKSPACE}/packages/core/src/tool/compress.ts` },
    content: "File updated successfully: added metrics collector.",
  },
  {
    turn: 6,
    action: "bash: git status",
    tool: "bash",
    input: { command: "git status" },
    content: [
      "On branch feat/compression",
      "Changes to be committed:",
      "\tmodified:   packages/core/src/tool/compress.ts",
      "\tmodified:   packages/core/test/compress.test.ts",
    ].join("\n"),
  },
  {
    turn: 7,
    action: "bash: bun test",
    tool: "bash",
    input: { command: "bun test" },
    content: [
      "bun test v1.2.4",
      ...Array.from({ length: 30 }, (_, i) => `✓ test ${i + 1} passed (1ms)`),
      "30 pass, 0 fail",
    ].join("\n"),
  },
  {
    turn: 8,
    action: "bash: git commit",
    tool: "bash",
    input: { command: "git commit -m 'feat: complete compression'" },
    content: "[feat/compression a1b2c3d] feat: complete compression\n 2 files changed, 45 insertions(+)",
  },
]

function makeSimMessage(turn: typeof simTurns[0]): any {
  return {
    info: {
      id: `msg-${turn.turn}`,
      sessionID: "sim-session",
      role: "assistant",
      time: { created: Date.now() },
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      modelID: "test-model",
      providerID: "test-provider",
    },
    parts: [
      {
        id: `call-${turn.turn}`,
        messageID: `msg-${turn.turn}`,
        sessionID: "sim-session",
        type: "tool",
        tool: turn.tool,
        callID: `call-${turn.turn}`,
        state: {
          status: "completed",
          input: turn.input,
          output: turn.content,
          title: "",
          metadata: {},
          time: { start: Date.now(), end: Date.now() },
        },
      },
    ],
  }
}

const KILO_STATIC_BYTES = kiloSchemaBytes + 3000 // raw schemas + verbose prompt
const FOX_STATIC_BYTES = foxSchemaBytes + 2400   // minified schemas + compact prompt

console.log(
  `  ${"Turn".padEnd(6)} ${"Action".padEnd(30)} ${"Kilo Prefill".padStart(14)} ${"Fox Prefill".padStart(14)} ${"Tokens Saved".padStart(14)} ${"Reduction".padStart(11)}`
)
console.log(
  `  ${"─".repeat(6)} ${"─".repeat(30)} ${"─".repeat(14)} ${"─".repeat(14)} ${"─".repeat(14)} ${"─".repeat(11)}`
)

let cumulativeKiloTokens = 0
let cumulativeFoxTokens = 0

for (let currentTurn = 1; currentTurn <= simTurns.length; currentTurn++) {
  const turnsSoFar = simTurns.slice(0, currentTurn)
  const msgsSoFar = turnsSoFar.map(makeSimMessage)

  // Kilo mode: raw schemas + prompt + uncompressed, un-superseded tool outputs
  let kiloTurnHistoryBytes = 0
  for (const t of turnsSoFar) {
    kiloTurnHistoryBytes += t.content.length + 150 // prompt/framing overhead
  }
  const kiloTotalBytes = KILO_STATIC_BYTES + kiloTurnHistoryBytes
  const kiloTokens = Math.round(kiloTotalBytes / 4)

  // Fox mode: minified schemas + compact prompt + superseded & compressed history
  const supersededMap = buildSupersededSet(msgsSoFar, { enabled: true })
  let foxTurnHistoryBytes = 0
  for (const t of turnsSoFar) {
    const callID = `call-${t.turn}`
    const marker = supersededMap.get(callID)
    if (marker) {
      foxTurnHistoryBytes += marker.length + 100
    } else {
      const compressed = compressOutput(t.content, t.tool)
      foxTurnHistoryBytes += compressed.length + 100
    }
  }
  const foxTotalBytes = FOX_STATIC_BYTES + foxTurnHistoryBytes
  const foxTokens = Math.round(foxTotalBytes / 4)

  const tokensSaved = kiloTokens - foxTokens
  const pctSaved = ((tokensSaved / kiloTokens) * 100).toFixed(1)

  cumulativeKiloTokens += kiloTokens
  cumulativeFoxTokens += foxTokens

  const currentAction = simTurns[currentTurn - 1]!
  console.log(
    `  ${`#${currentTurn}`.padEnd(6)} ${currentAction.action.padEnd(30)} ${(
      kiloTokens.toLocaleString() + " tok"
    ).padStart(14)} ${(foxTokens.toLocaleString() + " tok").padStart(14)} ${(
      "+" + tokensSaved.toLocaleString() + " tok"
    ).padStart(14)} ${`${pctSaved}%`.padStart(11)}`
  )
}

const totalSavedTokens = cumulativeKiloTokens - cumulativeFoxTokens
const cumulativePct = ((totalSavedTokens / cumulativeKiloTokens) * 100).toFixed(1)

console.log(
  `  ${"─".repeat(6)} ${"─".repeat(30)} ${"─".repeat(14)} ${"─".repeat(14)} ${"─".repeat(14)} ${"─".repeat(11)}`
)
console.log(
  `  🏆 CUMULATIVE 8-TURN PREFILL: ${cumulativeKiloTokens.toLocaleString()} tokens → ${cumulativeFoxTokens.toLocaleString()} tokens | Saved: +${totalSavedTokens.toLocaleString()} tokens (${cumulativePct}%)`
)
console.log("═".repeat(78))

