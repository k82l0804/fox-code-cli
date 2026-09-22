/**
 * Tier 2 — GitOps Workflows (20 fixtures)
 *
 * Multi-step agent-style workflows:
 *   issue → branch → edit → commit → push → PR description
 * Each fixture has 5–10 steps with realistic tool output including
 * timestamps, tool headers, and occasional noise.
 */
import type { ChallengeFixture, WorkflowStep } from "../types"

function ts(offset: number): string {
  return new Date(1727000000000 + offset * 1000).toISOString()
}

function makeGitOpsWorkflow(
  idx: number,
  branchName: string,
  files: string[],
  commitMsg: string,
): { steps: WorkflowStep[]; content: string } {
  const steps: WorkflowStep[] = [
    {
      tool: "bash",
      command: "git status",
      content: `On branch main\nYour branch is up to date with 'origin/main'.\nnothing to commit, working tree clean`,
      timestamp: ts(idx * 100),
    },
    {
      tool: "bash",
      command: `git checkout -b ${branchName}`,
      content: `Switched to a new branch '${branchName}'`,
      timestamp: ts(idx * 100 + 5),
    },
    ...files.map((f, i) => ({
      tool: "read" as const,
      content: `// File: ${f}\n` + Array.from({ length: 20 + i * 5 }, (_, j) =>
        `const line${j} = "value_${j}"; // ${f.split("/").pop()}`
      ).join("\n"),
      timestamp: ts(idx * 100 + 10 + i * 3),
    })),
    {
      tool: "edit" as const,
      content: `File updated: ${files[0]}\n  Applied 3 changes (2 insertions, 1 deletion)`,
      timestamp: ts(idx * 100 + 30),
    },
    {
      tool: "bash",
      command: "git diff --stat",
      content: files.map(f => ` ${f} | ${Math.floor(Math.random() * 20) + 3} ${"+" .repeat(5)}${"-".repeat(2)}`).join("\n") +
        `\n ${files.length} files changed, ${files.length * 8} insertions(+), ${files.length * 3} deletions(-)`,
      timestamp: ts(idx * 100 + 35),
    },
    {
      tool: "bash",
      command: `git commit -am "${commitMsg}"`,
      content: `[${branchName} ${["a1b2c3d", "e4f5g6h", "i7j8k9l", "m0n1o2p"][idx % 4]}] ${commitMsg}\n ${files.length} files changed, ${files.length * 8} insertions(+), ${files.length * 3} deletions(-)`,
      timestamp: ts(idx * 100 + 40),
    },
    {
      tool: "bash",
      command: `git push origin ${branchName}`,
      content: `Enumerating objects: ${files.length + 5}, done.\nCounting objects: 100% (${files.length + 5}/${files.length + 5}), done.\nDelta compression using up to 8 threads\nCompressing objects: 100% (${files.length}/${files.length}), done.\nWriting objects: 100% (${files.length + 2}/${files.length + 2}), 1.42 KiB | 1.42 MiB/s, done.\nTotal ${files.length + 2} (delta ${files.length - 1}), reused 0 (delta 0)\nremote: Resolving deltas: 100% (${files.length - 1}/${files.length - 1}), completed with ${files.length - 2} local objects.\nTo github.com:org/repo.git\n * [new branch]      ${branchName} -> ${branchName}`,
      timestamp: ts(idx * 100 + 50),
    },
  ]

  const content = steps.map((s, i) =>
    `[Step ${i + 1}/${steps.length}] [${s.timestamp ?? ""}] tool=${s.tool}${s.command ? ` cmd="${s.command}"` : ""}\n${s.content}`
  ).join("\n\n---\n\n")

  return { steps, content }
}

const workflowConfigs = [
  { branch: "feat/user-auth", files: ["src/auth/login.ts", "src/auth/session.ts", "test/auth.test.ts"], msg: "feat: implement OAuth2 login flow" },
  { branch: "fix/memory-leak", files: ["src/events/emitter.ts", "src/events/listener.ts"], msg: "fix: cleanup event listeners on disconnect" },
  { branch: "refactor/db-pool", files: ["src/db/pool.ts", "src/db/connection.ts", "src/db/config.ts"], msg: "refactor: extract connection pool configuration" },
  { branch: "feat/webhooks", files: ["src/api/webhooks.ts", "src/api/retry.ts", "test/webhooks.test.ts"], msg: "feat: add webhook retry with exponential backoff" },
  { branch: "fix/timezone", files: ["src/utils/date.ts", "test/date.test.ts"], msg: "fix: correct UTC offset in scheduler" },
  { branch: "feat/rate-limit", files: ["src/middleware/rate-limit.ts", "src/middleware/index.ts", "test/rate-limit.test.ts"], msg: "feat: implement sliding window rate limiter" },
  { branch: "fix/csv-encoding", files: ["src/import/csv.ts", "src/import/encoding.ts"], msg: "fix: handle BOM and mixed line endings in CSV" },
  { branch: "feat/audit-log", files: ["src/audit/logger.ts", "src/audit/stream.ts", "src/audit/storage.ts"], msg: "feat: implement audit trail streaming" },
  { branch: "fix/pagination", files: ["src/api/pagination.ts", "test/pagination.test.ts"], msg: "fix: correct off-by-one in cursor-based pagination" },
  { branch: "refactor/config", files: ["src/config/loader.ts", "src/config/merge.ts", "src/config/schema.ts"], msg: "refactor: migrate to JSONC config parser" },
  { branch: "feat/batch-export", files: ["src/export/batch.ts", "src/export/format.ts", "test/export.test.ts"], msg: "feat: add batch export with streaming" },
  { branch: "fix/race-condition", files: ["src/session/handler.ts", "src/session/lock.ts"], msg: "fix: add mutex for concurrent session updates" },
  { branch: "feat/multi-tenant", files: ["src/tenant/resolver.ts", "src/tenant/context.ts", "src/db/tenant-pool.ts"], msg: "feat: add tenant-scoped database connections" },
  { branch: "fix/sql-injection", files: ["src/db/query-builder.ts", "test/query.test.ts"], msg: "fix: parameterize all user-input queries" },
  { branch: "feat/file-upload", files: ["src/api/upload.ts", "src/storage/s3.ts", "test/upload.test.ts"], msg: "feat: implement multipart file upload" },
  { branch: "fix/cors", files: ["src/middleware/cors.ts", "src/config/cors.ts"], msg: "fix: allow credentials with specific origin" },
  { branch: "refactor/logging", files: ["src/utils/logger.ts", "src/utils/log-format.ts", "src/utils/log-transport.ts"], msg: "refactor: consolidate structured logging" },
  { branch: "feat/search", files: ["src/search/index.ts", "src/search/tokenizer.ts", "test/search.test.ts"], msg: "feat: implement full-text search with stemming" },
  { branch: "fix/null-pointer", files: ["src/models/user.ts", "test/models.test.ts"], msg: "fix: guard optional profile fields" },
  { branch: "feat/caching", files: ["src/cache/redis.ts", "src/cache/strategy.ts", "src/cache/invalidation.ts"], msg: "feat: add cache-aside with automatic invalidation" },
]

export const TIER2_GITOPS_FIXTURES: readonly ChallengeFixture[] = workflowConfigs.map(
  (cfg, idx) => {
    const { steps, content } = makeGitOpsWorkflow(idx, cfg.branch, cfg.files, cfg.msg)
    return {
      id: `gitops-wf-t2-${String(idx + 1).padStart(2, "0")}`,
      tier: 2 as const,
      category: "gitops-workflows" as const,
      description: `GitOps workflow: ${cfg.msg}`,
      seed: 10000 + idx,
      input: {
        content,
        tool: "bash" as const,
        command: "git status",
        steps,
      },
      expected: {
        type: "completion" as const,
        mustContain: [
          cfg.branch,
          cfg.msg,
          cfg.files[0]!,
          "new branch",
        ],
        workflow: "swe" as const,
      },
    }
  },
)
