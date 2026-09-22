/**
 * Tier 2 — Shell Pipelines (20 fixtures)
 *
 * Build → test → lint → coverage → deploy pipelines.
 * Includes intermittent failures, retries, and massive log output
 * that stresses truncation.
 */
import type { ChallengeFixture, WorkflowStep } from "../types"

function ts(offset: number): string {
  return new Date(1727000000000 + offset * 1000).toISOString()
}

function makePipeline(idx: number): { steps: WorkflowStep[]; content: string; desc: string } {
  const pkgManagers = ["npm", "bun", "pnpm", "yarn"]
  const pm = pkgManagers[idx % 4]!
  const installCmd = pm === "bun" ? "bun install" : `${pm} install`
  const buildCmd = pm === "bun" ? "bun run build" : `${pm} run build`
  const testCmd = pm === "bun" ? "bun test" : `${pm} test`
  const lintCmd = pm === "bun" ? "bun run lint" : `${pm} run lint`

  const hasFailure = idx % 3 === 1

  const steps: WorkflowStep[] = [
    {
      tool: "bash",
      command: installCmd,
      content: Array.from({ length: 30 }, (_, i) =>
        `${ts(idx * 300 + i)} [install] resolving package ${i + 1}/30: @scope/pkg-${i}@^${Math.floor(i / 3)}.${i % 10}.0`
      ).join("\n") + `\n\n✓ Installed ${30 + idx} packages in ${(1.2 + idx * 0.1).toFixed(1)}s`,
      timestamp: ts(idx * 300),
    },
    {
      tool: "bash",
      command: buildCmd,
      content: [
        `[${ts(idx * 300 + 35)}] [build] Compiling TypeScript...`,
        ...Array.from({ length: 15 }, (_, i) =>
          `[${ts(idx * 300 + 36 + i)}] [build] Compiled src/module-${i}.ts (${(0.1 + i * 0.02).toFixed(2)}s)`
        ),
        `[${ts(idx * 300 + 55)}] [build] Bundling dist/index.js...`,
        `[${ts(idx * 300 + 58)}] [build] ✓ Build completed in ${(2.3 + idx * 0.05).toFixed(1)}s (${15 + idx} modules)`,
      ].join("\n"),
      timestamp: ts(idx * 300 + 35),
    },
    {
      tool: "bash",
      command: testCmd,
      content: hasFailure
        ? [
            `Running test suite...`,
            ...Array.from({ length: 10 }, (_, i) =>
              `  ${i === 5 ? "✗" : "✓"} test case ${i + 1}: ${["validates input", "handles edge case", "processes batch", "serializes output", "handles timeout", "FLAKY: race condition in async handler", "computes hash", "validates schema", "handles overflow", "cleans up resources"][i]}`
            ),
            `\n9 pass, 1 fail`,
            `\n=== Retry attempt 1/2 ===`,
            ...Array.from({ length: 10 }, (_, i) =>
              `  ✓ test case ${i + 1}: ${["validates input", "handles edge case", "processes batch", "serializes output", "handles timeout", "race condition in async handler (retry pass)", "computes hash", "validates schema", "handles overflow", "cleans up resources"][i]}`
            ),
            `\n10 pass, 0 fail (after retry)`,
          ].join("\n")
        : [
            `Running test suite...`,
            ...Array.from({ length: 10 }, (_, i) =>
              `  ✓ test case ${i + 1}: ${["validates input", "handles edge case", "processes batch", "serializes output", "handles timeout", "processes async handler", "computes hash", "validates schema", "handles overflow", "cleans up resources"][i]} [${(0.5 + i * 0.3).toFixed(0)}ms]`
            ),
            `\n10 pass, 0 fail (${(1.8 + idx * 0.1).toFixed(1)}s)`,
          ].join("\n"),
      timestamp: ts(idx * 300 + 60),
    },
    {
      tool: "bash",
      command: lintCmd,
      content: [
        `Linting ${15 + idx} files...`,
        ...Array.from({ length: Math.min(idx % 5, 3) }, (_, i) =>
          `  ⚠ src/module-${i * 3}.ts:${10 + i * 7}:${5 + i}: Unused variable 'temp${i}' (no-unused-vars)`
        ),
        idx % 5 > 0
          ? `\n✓ ${15 + idx} files linted, ${Math.min(idx % 5, 3)} warnings`
          : `\n✓ ${15 + idx} files linted, 0 warnings`,
      ].join("\n"),
      timestamp: ts(idx * 300 + 80),
    },
    {
      tool: "bash",
      command: `${pm === "bun" ? "bun run" : `${pm} run`} deploy --stage staging`,
      content: [
        `[deploy] Deploying to staging...`,
        `[deploy] Uploading bundle (${(245 + idx * 12).toFixed(0)} KB)...`,
        `[deploy] Provisioning resources...`,
        `[deploy] Health check: HTTP 200 OK`,
        `[deploy] ✓ Deployed to staging in ${(8.5 + idx * 0.3).toFixed(1)}s`,
        `[deploy] URL: https://staging-${idx}.app.example.com`,
      ].join("\n"),
      timestamp: ts(idx * 300 + 90),
    },
  ]

  const content = steps.map((s, i) =>
    `[Pipeline Step ${i + 1}/${steps.length}] [${s.timestamp!}] $ ${s.command}\n${s.content}`
  ).join("\n\n" + "=".repeat(60) + "\n\n")

  return {
    steps,
    content,
    desc: `CI/CD pipeline using ${pm}: install → build → test${hasFailure ? " (with retry)" : ""} → lint → deploy`,
  }
}

export const TIER2_SHELL_PIPELINE_FIXTURES: readonly ChallengeFixture[] = Array.from(
  { length: 20 },
  (_, idx) => {
    const { steps, content, desc } = makePipeline(idx)
    return {
      id: `shell-pipe-t2-${String(idx + 1).padStart(2, "0")}`,
      tier: 2 as const,
      category: "shell-pipelines" as const,
      description: desc,
      seed: 12000 + idx,
      input: {
        content,
        tool: "bash" as const,
        command: "bash ci-pipeline.sh",
        steps,
      },
      expected: {
        type: "completion" as const,
        mustContain: [
          "Build completed",
          "pass",
          "Deployed to staging",
        ],
        workflow: "swe" as const,
      },
    }
  },
)
