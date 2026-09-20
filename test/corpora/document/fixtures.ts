import type { CorpusFixture } from "../types"

export const DOCUMENT_FIXTURES: readonly CorpusFixture[] = [
  {
    id: "doc-01-tabular-records-json",
    name: "tabular JSON array of 35 database entities (columnar conversion)",
    category: "document",
    tool: "read",
    content: JSON.stringify(
      Array.from({ length: 35 }, (_, i) => ({
        id: `usr_${1000 + i}`,
        username: `developer_${i}`,
        email: `dev_${i}@fox.local`,
        role: i % 5 === 0 ? "admin" : "member",
        status: "active",
        quotaRemaining: 50000 - i * 100,
      })),
      null,
      2
    ),
    mustContain: [
      "usr_1000",
      "developer_0",
      "usr_1034",
      "developer_34",
    ],
    minExpectedReductionPct: 40,
  },
  {
    id: "doc-02-repetitive-json-keys",
    name: "nested JSON payload with long repetitive keys (key packing)",
    category: "document",
    tool: "read",
    content: JSON.stringify(
      Array.from({ length: 20 }, (_, i) => ({
        telemetrySessionIdentifier: `session_uuid_token_${i}`,
        cumulativePromptTokensUsed: 12400 + i * 50,
        cumulativeCompletionTokensUsed: 3100 + i * 10,
        promptCacheHitRatePercentage: 89.4,
        clientReportedLatencyDurationMs: 42.5,
      })),
      null,
      2
    ),
    mustContain: [
      "session_uuid_token_0",
      "session_uuid_token_19",
    ],
    minExpectedReductionPct: 25,
  },
  {
    id: "doc-03-markdown-spec-doc",
    name: "technical specification markdown with tables and code blocks",
    category: "document",
    tool: "read",
    content: `# Fox Token Compression Architecture Specification

## Overview
Fox implements zero-overhead lossless token compression to maximize KV-cache reuse.

| Strategy | Layer | Flag | Invariant |
| :--- | :--- | :--- | :--- |
| Path Normalization | Tool Output | FOX_EXPERIMENTAL_COMPRESS_PATHS | Lossless paths |
| Tabular JSON | Tool Output | FOX_EXPERIMENTAL_COMPRESS_DATA | Preserves row counts |
| Diff Context Trim | Tool Output | FOX_EXPERIMENTAL_COMPRESS_DIFF | Preserves +/- hunks |
| Supersession | Session Prompt | FOX_EXPERIMENTAL_COMPRESS_SUPERSEDE | Prunes obsolete turns |

\`\`\`typescript
export function compress(input: string): string {
  return process(input, { workspaceRoot: "/home/user" })
}
\`\`\`
`,
    mustContain: [
      "# Fox Token Compression Architecture Specification",
      "Path Normalization",
      "Tabular JSON",
      "Diff Context Trim",
      "Supersession",
    ],
    minExpectedReductionPct: 0,
  },
  {
    id: "doc-04-csv-dataset-export",
    name: "CSV tabular dataset of performance metrics",
    category: "document",
    tool: "read",
    content: [
      "timestamp,task_id,status,cache_reads,prefill_tokens,completion_tokens,wallclock_s",
      ...Array.from({ length: 25 }, (_, i) =>
        `2026-09-20T18:${String(i).padStart(2, "0")}:00Z,task_${i + 1},SUCCESS,${120000 + i * 1000},${3500 + i * 20},${450 + i * 5},${(15.2 + i * 0.4).toFixed(1)}`
      ),
    ].join("\n"),
    mustContain: [
      "timestamp,task_id,status,cache_reads",
      "task_1,SUCCESS",
      "task_25,SUCCESS",
    ],
    minExpectedReductionPct: 0,
  },
]
