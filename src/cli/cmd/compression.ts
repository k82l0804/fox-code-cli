import type { Argv } from "yargs"
import { Effect } from "effect"
import { effectCmd } from "../effect-cmd"
import { Flag } from "@opencode-ai/core/flag/flag"
import {
  getWorkflowPolicy,
  type WorkflowType,
  WORKFLOW_POLICIES,
} from "@opencode-ai/core/tool/compress"
import { CompressionMetrics } from "@opencode-ai/core/tool/compression-metrics"
import crypto from "crypto"

function formatStatus(enabled: boolean): string {
  return enabled ? "\x1b[32m✔ enabled\x1b[0m" : "\x1b[90m✗ disabled\x1b[0m"
}

const PreviewCommand = effectCmd({
  command: "preview [workflow]",
  describe: "preview the active compression policy and transform pipeline",
  instance: false,
  builder: (yargs: Argv) =>
    yargs.positional("workflow", {
      type: "string",
      choices: ["swe", "data", "research", "shell", "none", "auto"],
      describe: "workflow profile to preview (default: active workflow)",
    }),
  handler: Effect.fn("Cli.compression.preview")(function* (args: { workflow?: string }) {
    const wf = (args.workflow as WorkflowType) ?? (Flag.FOX_WORKLOAD as WorkflowType) ?? "swe"
    const policy = getWorkflowPolicy(wf)

    console.log("\n\x1b[1m🦊 Fox Code CLI — Compression Policy Preview\x1b[0m\n")
    console.log(`  \x1b[1mActive Workflow Profile:\x1b[0m \x1b[36m${wf}\x1b[0m`)
    console.log(`  \x1b[1mSafe Mode (FOX_COMPRESSION_SAFE):\x1b[0m ${formatStatus(Flag.FOX_COMPRESSION_SAFE)}`)
    console.log(`  \x1b[1mMaster Switch (FOX_EXPERIMENTAL_COMPRESS):\x1b[0m ${formatStatus(Flag.FOX_EXPERIMENTAL_COMPRESS)}`)
    console.log(`  \x1b[1mCanary Mode (FOX_COMPRESSION_CANARY):\x1b[0m ${formatStatus(Flag.FOX_COMPRESSION_CANARY)}\n`)

    console.log("  \x1b[1mTransform Pipeline for [" + wf + "]:\x1b[0m")
    console.log(`    • Pre-Execution Git Rewrites:     ${formatStatus(policy.gitRewrite)}`)
    console.log(`    • Render-Time Git Supersession:    ${formatStatus(policy.gitSupersede)}`)
    console.log(`    • Diff Context Trimming:           ${formatStatus(policy.diffTrim)} (context: ${Flag.FOX_EXPERIMENTAL_COMPRESS_DIFF_CONTEXT} line)`)
    console.log(`    • Lockfile Diff Collapsing:        ${formatStatus(policy.lockfileCollapse)}`)
    console.log(`    • Test Output Collapsing:          ${formatStatus(policy.testFilter)}`)
    console.log(`    • Log Line Deduplication:          ${formatStatus(policy.logDedup)}`)
    console.log(`    • Tabular JSON Compression:        ${formatStatus(policy.tabular)}`)
    console.log(`    • Path Normalization:              ${formatStatus(policy.pathNormalize)}`)
    console.log(
      `    • Shell Output Capping:            ${formatStatus(policy.shellTruncate)} (${policy.maxShellLines} lines / ${policy.maxShellBytes} bytes)`
    )

    console.log("\n  \x1b[1mActive Escape Hatches:\x1b[0m")
    console.log("    • Raw Git execution:               raw git <cmd>, \\git <cmd>, git --raw <cmd>")
    console.log("    • Shell truncation bypass:         # no-truncate, --full-output")
    console.log("    • Environment overrides:           FOX_GIT_NO_REWRITE=true, FOX_SHELL_NO_TRUNCATE=true")
    console.log("    • Workload force-override:         FOX_WORKLOAD=swe|data|research|shell|none|auto\n")
  }),
})

const SnapshotCommand = effectCmd({
  command: "snapshot",
  describe: "display live compression telemetry, prefix stability, and ROI metrics",
  instance: false,
  handler: Effect.fn("Cli.compression.snapshot")(function* () {
    const summary = CompressionMetrics.summary()
    const wf = (Flag.FOX_WORKLOAD as WorkflowType) ?? "swe"

    // Deterministic prefix fingerprint
    const prefixPayload = `FOX_COMPRESSION_V1_${wf}_${JSON.stringify(WORKFLOW_POLICIES[wf])}`
    const prefixHash = crypto.createHash("sha256").update(prefixPayload).digest("hex").slice(0, 16)

    console.log("\n\x1b[1m🦊 Fox Code CLI — Compression Telemetry & Stability Snapshot\x1b[0m\n")
    console.log(`  \x1b[1mPrefix Stability Hash:\x1b[0m            sha256:${prefixHash}`)
    console.log(`  \x1b[1mActive Workflow:\x1b[0m                  ${wf}`)
    console.log(`  \x1b[1mPre-Execution Git Rewrites:\x1b[0m       ${summary.rewrites}`)
    console.log(`  \x1b[1mShell Output Truncations:\x1b[0m         ${summary.truncations}`)
    console.log(`  \x1b[1mSuperseded Tool Outputs:\x1b[0m          ${summary.superseded}`)
    console.log(`  \x1b[1mCumulative Characters Saved:\x1b[0m      ${summary.charsSaved.toLocaleString()} chars (~${Math.round(summary.charsSaved / 4).toLocaleString()} tokens)`)
    console.log(`  \x1b[1mCumulative Compression Overhead:\x1b[0m  ${summary.overheadMs} ms`)
    const roi = summary.overheadMs > 0 ? (summary.charsSaved / summary.overheadMs).toFixed(1) : "∞"
    console.log(`  \x1b[1mCompression ROI Score:\x1b[0m            ${roi} chars/ms\n`)
  }),
})

export const CompressionCommand = effectCmd({
  command: "compression",
  describe: "inspect token compression policies, escape hatches, and telemetry",
  instance: false,
  builder: (yargs: Argv) => yargs.command(PreviewCommand).command(SnapshotCommand).demandCommand(),
  handler: Effect.fn("Cli.compression")(function* () {}),
})
