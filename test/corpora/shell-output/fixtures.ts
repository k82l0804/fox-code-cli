import type { CorpusFixture } from "../types"

const WORKSPACE = "/home/k82l0804/workarea/fox/fox-code-cli"

export const SHELL_OUTPUT_FIXTURES: readonly CorpusFixture[] = [
  {
    id: "shell-01-oversized-stream-log",
    name: "oversized 400-line build/run stream log (truncated to safety bound)",
    category: "shell-output",
    tool: "bash",
    command: "bun run dev --verbose",
    content: Array.from({ length: 400 }, (_, i) =>
      `[2026-09-20T18:46:${String(i % 60).padStart(2, "0")}Z] [DEBUG] worker-${i % 4}: processing internal batch item #${i + 1} with hash sha256:a1b2c3d4e5f6`
    ).join("\n"),
    mustContain: [
      "worker-",
      "processing internal batch item #",
    ],
    minExpectedReductionPct: 40,
  },
  {
    id: "shell-02-truncation-escape-hatch",
    name: "shell output with # no-truncate escape hatch (full fidelity)",
    category: "shell-output",
    tool: "bash",
    command: "cat /tmp/detailed-diagnostics.log # no-truncate",
    content: Array.from({ length: 300 }, (_, i) =>
      `CRITICAL_DUMP_ROW_${i}: payload={ "key_${i}": "value_${i}", "status": "PENDING" }`
    ).join("\n"),
    mustContain: [
      "CRITICAL_DUMP_ROW_0",
      "CRITICAL_DUMP_ROW_150",
      "CRITICAL_DUMP_ROW_299",
    ],
    isEscapeHatch: true,
    minExpectedReductionPct: 0,
  },
  {
    id: "shell-03-deep-workspace-paths",
    name: "deeply nested workspace paths (normalized to relative with CWD header)",
    category: "shell-output",
    tool: "grep",
    command: "git grep -n 'Effect.fn'",
    content: Array.from({ length: 40 }, (_, i) =>
      `${WORKSPACE}/packages/core/src/tool/handlers/submodules/group-${i % 5}/handler-${i}.ts:${10 + i}: export const action${i} = Effect.fn("action_${i}")`
    ).join("\n"),
    mustContain: [
      "packages/core/src/tool/handlers/submodules/group-",
      "export const action",
      "Effect.fn",
    ],
    minExpectedReductionPct: 30,
  },
  {
    id: "shell-04-gnu-grep-line-numbers",
    name: "GNU grep output with filename and line numbers",
    category: "shell-output",
    tool: "grep",
    command: "grep -rn 'TODO' src/",
    content: [
      `${WORKSPACE}/src/session/llm.ts:42: // TODO: add timeout handler`,
      `${WORKSPACE}/src/session/llm.ts:98: // TODO: cache prompt tokens`,
      `${WORKSPACE}/src/server/routes/instance/httpapi/session.ts:15: // TODO: check token expiry`,
      `${WORKSPACE}/src/server/routes/instance/httpapi/session.ts:74: // TODO: stream events properly`,
      `${WORKSPACE}/src/foxcode/config/config.ts:31: // TODO: support custom yaml formats`,
    ].join("\n"),
    mustContain: [
      "src/session/llm.ts:42: // TODO: add timeout handler",
      "src/server/routes/instance/httpapi/session.ts:15: // TODO: check token expiry",
    ],
    minExpectedReductionPct: 20,
  },
  {
    id: "shell-05-find-traversal",
    name: "find command directory traversal listing",
    category: "shell-output",
    tool: "bash",
    command: "find src/ -name '*.ts'",
    content: [
      `${WORKSPACE}/src/index.ts`,
      `${WORKSPACE}/src/session/llm.ts`,
      `${WORKSPACE}/src/session/supersede.ts`,
      `${WORKSPACE}/src/cli/cmd/compression.ts`,
      `${WORKSPACE}/src/storage/db.bun.ts`,
      `${WORKSPACE}/src/storage/db.node.ts`,
    ].join("\n"),
    mustContain: [
      "src/index.ts",
      "src/session/llm.ts",
      "src/session/supersede.ts",
    ],
    minExpectedReductionPct: 25,
  },
]
