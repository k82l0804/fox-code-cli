/**
 * Tier 4 — GAIA-style Tasks (20 fixtures)
 *
 * Reasoning + tool-use prompts with structured inputs (logs, tables, JSON).
 * Fox sees raw material and must compress without losing critical data points.
 */
import type { ChallengeFixture } from "../types"

const gaiaTemplates = [
  { title: "Interpret server error logs", content: (i: number) => `=== Server Error Report ===\nTime: 2026-09-20T${String(10 + i).padStart(2, "0")}:00:00Z\nTotal requests: ${10000 + i * 500}\nError rate: ${(2.5 + i * 0.3).toFixed(1)}%\nTop errors:\n  1. 502 Bad Gateway: ${200 + i * 15} occurrences (upstream timeout)\n  2. 429 Too Many Requests: ${150 + i * 10} occurrences (rate limit)\n  3. 500 Internal Server Error: ${50 + i * 5} occurrences (null pointer in /api/users/${i})\n\nAction required: Investigate upstream timeout spike at ${String(10 + i).padStart(2, "0")}:${String(30 + i).padStart(2, "0")}`, must: ["502 Bad Gateway", "upstream timeout", "Action required"] },
  { title: "Summarize deployment diff", content: (i: number) => `Deployment #${100 + i}\nEnvironment: production-${i % 3 === 0 ? "us-east" : i % 3 === 1 ? "eu-west" : "ap-south"}\nPrevious: v2.${i}.0 (sha: ${`abcdef${i}`.slice(0, 7)})\nCurrent:  v2.${i + 1}.0 (sha: ${`fedcba${i}`.slice(0, 7)})\n\nChanges:\n  - ${3 + i % 4} files modified\n  - ${10 + i * 2} insertions, ${5 + i} deletions\n  - New dependencies: @scope/pkg-${i}@^1.0.0\n  - Removed: legacy-lib@0.${i}.0\n\nRollback plan: revert to v2.${i}.0 via \`kubectl rollout undo\``, must: ["Deployment #", "Rollback plan", "kubectl rollout"] },
  { title: "Analyze resource utilization report", content: (i: number) => `=== Resource Utilization ===\nCluster: k8s-prod-${i % 3 + 1}\nNodes: ${3 + i % 5}\n\n| Node | CPU % | Memory % | Disk % | Pods |\n|------|-------|----------|--------|------|\n| node-1 | ${45 + i * 2} | ${60 + i} | ${30 + i * 3} | ${12 + i} |\n| node-2 | ${38 + i * 3} | ${55 + i * 2} | ${25 + i * 2} | ${10 + i} |\n| node-3 | ${72 + i} | ${85 + i} | ${45 + i} | ${18 + i} |\n\nAlerts: node-3 CPU above 70% threshold for ${2 + i} hours`, must: ["Resource Utilization", "node-3", "threshold"] },
  { title: "Parse CI pipeline results", content: (i: number) => `Pipeline #${5000 + i} — ${i % 2 === 0 ? "SUCCESS" : "FAILED"}\nTrigger: push to main (${`abc${i}def`.slice(0, 7)})\nDuration: ${120 + i * 15}s\n\nStages:\n  ✓ checkout (${2 + i % 3}s)\n  ✓ install  (${15 + i * 2}s)\n  ✓ build    (${30 + i * 3}s)\n  ${i % 2 === 0 ? "✓" : "✗"} test     (${45 + i * 4}s) ${i % 2 === 1 ? "— 2 failures in test/integration.ts" : ""}\n  ${i % 2 === 0 ? "✓" : "⊘"} deploy   (${20 + i}s) ${i % 2 === 1 ? "— skipped (tests failed)" : ""}\n\nArtifacts: dist.tar.gz (${(1.2 + i * 0.1).toFixed(1)} MB)`, must: ["Pipeline #", "checkout", "Artifacts"] },
  { title: "Interpret database query plan", content: (i: number) => `EXPLAIN ANALYZE output:\n\nSort  (cost=${1000 + i * 50}.00..${1200 + i * 50}.00 rows=${500 + i * 20} width=${64 + i})\n  Sort Key: created_at DESC\n  Sort Method: quicksort  Memory: ${25 + i * 5}kB\n  ->  Hash Join  (cost=${500 + i * 30}.00..${900 + i * 40}.00 rows=${500 + i * 20} width=${64 + i})\n        Hash Cond: (orders.user_id = users.id)\n        ->  Seq Scan on orders  (cost=0.00..${400 + i * 20}.00 rows=${2000 + i * 100} width=${40 + i})\n              Filter: (status = 'pending')\n              Rows Removed by Filter: ${8000 + i * 200}\n        ->  Hash  (cost=${100 + i * 10}.00..${100 + i * 10}.00 rows=${1000 + i * 50} width=${24 + i})\n              ->  Index Scan using users_pkey on users  (cost=0.00..${100 + i * 10}.00 rows=${1000 + i * 50} width=${24 + i})\n\nPlanning Time: ${(0.5 + i * 0.1).toFixed(1)} ms\nExecution Time: ${(45.2 + i * 3.5).toFixed(1)} ms`, must: ["EXPLAIN ANALYZE", "Hash Join", "Seq Scan", "Execution Time"] },
]

export const TIER4_GAIA_FIXTURES: readonly ChallengeFixture[] = Array.from(
  { length: 20 },
  (_, idx) => {
    const tpl = gaiaTemplates[idx % gaiaTemplates.length]!
    const content = tpl.content(idx)
    return {
      id: `gaia-t4-${String(idx + 1).padStart(2, "0")}`,
      tier: 4 as const,
      category: "gaia-style" as const,
      description: `GAIA-style: ${tpl.title} (variant ${Math.floor(idx / gaiaTemplates.length) + 1})`,
      seed: 30000 + idx,
      input: { content, tool: "bash" as const, command: "cat report.txt" },
      expected: {
        type: "objective" as const,
        mustContain: tpl.must,
        workflow: "swe" as const,
      },
    }
  },
)
