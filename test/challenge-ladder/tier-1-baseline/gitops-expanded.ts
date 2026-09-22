/**
 * Tier 1 — GitOps Expanded (10 fixtures)
 *
 * 7 existing GitOps fixtures + 3 new:
 *   - git log --oneline (multi-commit history)
 *   - git diff --stat (large repo)
 *   - git stash list (multiple stashes)
 */
import type { ChallengeFixture } from "../types"
import { GITOPS_FIXTURES } from "../../corpora/gitops/fixtures"

const existingFixtures: ChallengeFixture[] = GITOPS_FIXTURES.map((f, idx) => ({
  id: `gitops-t1-${String(idx + 1).padStart(2, "0")}`,
  tier: 1 as const,
  category: "gitops" as const,
  description: f.name,
  seed: 3000 + idx,
  input: {
    content: f.content,
    tool: f.tool,
    command: f.command,
  },
  expected: {
    type: "invariant" as const,
    mustContain: f.mustContain ? [...f.mustContain] : undefined,
    workflow: "swe" as const,
    minReductionPct: f.minExpectedReductionPct,
  },
}))

const newFixtures: ChallengeFixture[] = [
  {
    id: "gitops-t1-08",
    tier: 1,
    category: "gitops",
    description: "git log --oneline (25 commits across feature branches)",
    seed: 3100,
    input: {
      content: Array.from({ length: 25 }, (_, i) => {
        const hashes = [
          "a1b2c3d", "e4f5g6h", "i7j8k9l", "m0n1o2p", "q3r4s5t",
          "u6v7w8x", "y9z0a1b", "c2d3e4f", "g5h6i7j", "k8l9m0n",
          "o1p2q3r", "s4t5u6v", "w7x8y9z", "a0b1c2d", "e3f4g5h",
          "i6j7k8l", "m9n0o1p", "q2r3s4t", "u5v6w7x", "y8z9a0b",
          "c1d2e3f", "g4h5i6j", "k7l8m9n", "o0p1q2r", "s3t4u5v",
        ]
        const messages = [
          "feat: add user authentication flow",
          "fix: resolve race condition in session handler",
          "refactor: extract database connection pool",
          "docs: update API reference for v2 endpoints",
          "test: add integration tests for payment gateway",
          "chore: bump dependencies to latest versions",
          "fix: handle null pointer in config parser",
          "feat: implement webhook retry logic",
          "perf: optimize SQL query for user search",
          "fix: correct timezone handling in scheduler",
          "feat: add rate limiting middleware",
          "refactor: simplify error handling pipeline",
          "fix: resolve memory leak in event emitter",
          "docs: add migration guide for v1→v2",
          "test: add edge case tests for CSV import",
          "feat: implement audit log streaming",
          "fix: correct pagination offset calculation",
          "chore: configure CI/CD pipeline stages",
          "feat: add multi-tenant support",
          "fix: handle unicode in file path resolver",
          "refactor: consolidate logging utilities",
          "perf: add connection pooling for Redis",
          "fix: resolve deadlock in transaction handler",
          "feat: implement batch export functionality",
          "test: add load testing fixtures",
        ]
        return `${hashes[i]} ${messages[i]}`
      }).join("\n"),
      tool: "bash",
      command: "git log --oneline -25",
    },
    expected: {
      type: "invariant",
      mustContain: [
        "feat: add user authentication flow",
        "fix: resolve race condition",
        "refactor: extract database connection pool",
        "test: add load testing fixtures",
      ],
      workflow: "swe",
      minReductionPct: 0,
    },
  },
  {
    id: "gitops-t1-09",
    tier: 1,
    category: "gitops",
    description: "git diff --stat (large repo with 30+ files changed)",
    seed: 3101,
    input: {
      content: [
        ...Array.from({ length: 30 }, (_, i) => {
          const files = [
            "src/auth/login.ts", "src/auth/register.ts", "src/auth/session.ts",
            "src/api/routes.ts", "src/api/middleware.ts", "src/api/validators.ts",
            "src/db/connection.ts", "src/db/migrations/001.ts", "src/db/migrations/002.ts",
            "src/models/user.ts", "src/models/session.ts", "src/models/audit.ts",
            "src/utils/logger.ts", "src/utils/crypto.ts", "src/utils/config.ts",
            "test/auth.test.ts", "test/api.test.ts", "test/db.test.ts",
            "test/models.test.ts", "test/utils.test.ts", "test/integration.test.ts",
            "docs/README.md", "docs/API.md", "docs/CHANGELOG.md",
            "package.json", "tsconfig.json", ".env.example",
            "docker-compose.yml", "Dockerfile", "nginx.conf",
          ]
          const insertions = Math.floor(Math.random() * 200) + 1
          const deletions = Math.floor(Math.random() * 100)
          const bar = "+".repeat(Math.min(insertions, 30)) + "-".repeat(Math.min(deletions, 20))
          return ` ${files[i]} | ${String(insertions + deletions).padStart(4)} ${bar}`
        }),
        " 30 files changed, 2847 insertions(+), 1203 deletions(-)",
      ].join("\n"),
      tool: "bash",
      command: "git diff --stat",
    },
    expected: {
      type: "invariant",
      mustContain: [
        "src/auth/login.ts",
        "src/db/connection.ts",
        "30 files changed",
        "2847 insertions",
        "1203 deletions",
      ],
      workflow: "swe",
      minReductionPct: 0,
    },
  },
  {
    id: "gitops-t1-10",
    tier: 1,
    category: "gitops",
    description: "git stash list (multiple stashes with WIP descriptions)",
    seed: 3102,
    input: {
      content: `stash@{0}: WIP on feat/auth: a1b2c3d implement OAuth2 PKCE flow
stash@{1}: WIP on fix/memory-leak: e4f5g6h debugging event listener cleanup
stash@{2}: On main: experimental perf optimization for batch processor
stash@{3}: WIP on feat/webhooks: i7j8k9l half-finished retry logic
stash@{4}: On develop: quick fix for production hotfix — revert before merge
stash@{5}: WIP on refactor/config: m0n1o2p migrating to JSONC parser
stash@{6}: On feat/audit: audit trail streaming — paused for code review`,
      tool: "bash",
      command: "git stash list",
    },
    expected: {
      type: "invariant",
      mustContain: [
        "stash@{0}",
        "stash@{6}",
        "OAuth2 PKCE flow",
        "production hotfix",
        "JSONC parser",
      ],
      workflow: "swe",
    },
  },
]

export const TIER1_GITOPS_FIXTURES: readonly ChallengeFixture[] = [
  ...existingFixtures,
  ...newFixtures,
]
