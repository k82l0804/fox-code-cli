/**
 * AFB Reporter — JSON + Markdown report generator
 *
 * Generates human-readable comparison reports and machine-readable
 * JSON result files from benchmark runs.
 */

import { mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import type { AgentScore, TierScore, ChallengeScore } from "./rubric";
import type { PassBarVerdict, TierComparison } from "./comparator";
import { evaluatePassBar, compareTiers } from "./comparator";
import { scoreAgent } from "./rubric";

// ─── Config ─────────────────────────────────────────────────────────────

const RESULTS_DIR = join(resolve(import.meta.dir), "results");

// ─── Tier Name Map ──────────────────────────────────────────────────────

const TIER_NAMES: Record<number, string> = {
  1: "Sanity & Wiring",
  2: "Simple Multi-step",
  3: "Multi-file SWE",
  4: "Error Recovery",
  5: "Adversarial Instructions",
  6: "Long-horizon Tasks",
  7: "Unsafe Autonomy",
  8: "Guardian + Autonomy",
  9: "Multi-agent Arbitration",
  10: "SWE-bench Style Bugs",
};

// ─── JSON Output ────────────────────────────────────────────────────────

/**
 * Save agent results as JSON.
 */
export async function saveAgentResults(
  agentScore: AgentScore,
  date: string = new Date().toISOString().slice(0, 10),
): Promise<string> {
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });
  const path = join(RESULTS_DIR, `${agentScore.agent}-${date}.json`);
  await Bun.write(path, JSON.stringify(agentScore, null, 2));
  return path;
}

/**
 * Save comparison verdict as JSON.
 */
export async function saveVerdict(
  verdict: PassBarVerdict,
  date: string = new Date().toISOString().slice(0, 10),
): Promise<string> {
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });
  const path = join(RESULTS_DIR, `verdict-${date}.json`);
  await Bun.write(path, JSON.stringify(verdict, null, 2));
  return path;
}

// ─── Markdown Report ────────────────────────────────────────────────────

/**
 * Generate a full Markdown comparison report.
 */
export function generateComparisonReport(
  agents: AgentScore[],
  date: string = new Date().toISOString().slice(0, 10),
  model: string = "gpt-4o",
  runs: number = 3,
): string {
  const fox = agents.find((a) => a.agent === "fox");
  if (!fox) throw new Error("Fox results required for comparison report");

  const competitors = agents.filter((a) => a.agent !== "fox");
  const verdict = evaluatePassBar(fox, competitors);
  const tierComps = compareTiers(fox, competitors);

  const lines: string[] = [];

  // Header
  lines.push("# Agent Faultline Benchmark — Comparative Report");
  lines.push(`## ${date} | Model: ${model} | Runs: ${runs} (median)`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Scoreboard
  lines.push("## Scoreboard");
  lines.push("");
  lines.push(generateScoreboardTable(agents, tierComps));
  lines.push("");

  // Per-tier breakdown
  lines.push("## Per-Tier Breakdown");
  lines.push("");
  for (const comp of tierComps) {
    lines.push(generateTierSection(comp, agents));
  }

  // Pass Bar Verdict
  lines.push("---");
  lines.push("");
  lines.push("## Pass Bar Verdict");
  lines.push("");
  lines.push(generateVerdictTable(verdict));
  lines.push("");

  // "Better Than" analysis
  lines.push("## Competitive Position");
  lines.push("");
  for (const comp of competitors) {
    const isBetter = verdict.is_better_than[comp.agent];
    const emoji = isBetter ? "✅" : "➖";
    lines.push(`- Fox vs ${comp.agent}: ${emoji} ${isBetter ? "BETTER THAN" : "matches"}`);
  }
  lines.push("");

  // Summary
  lines.push("---");
  lines.push("");
  lines.push(`## Verdict: ${verdict.verdict_summary}`);
  lines.push("");

  // Efficiency comparison
  lines.push("## Efficiency Comparison");
  lines.push("");
  lines.push(generateEfficiencyTable(agents));
  lines.push("");

  // Catastrophic failures
  lines.push("## Catastrophic Failures");
  lines.push("");
  lines.push(generateCatastrophicTable(agents));
  lines.push("");

  return lines.join("\n");
}

/**
 * Generate the main scoreboard table.
 */
function generateScoreboardTable(
  agents: AgentScore[],
  tierComps: TierComparison[],
): string {
  const agentNames = agents.map((a) => a.agent);
  const header = `| Tier | ${agentNames.join(" | ")} | Winner |`;
  const separator = `|------|${agentNames.map(() => "------").join("|")}|--------|`;

  const rows: string[] = [header, separator];

  for (const comp of tierComps) {
    const tierName = TIER_NAMES[comp.tier] ?? `Tier ${comp.tier}`;
    const scores = agentNames.map((a) => {
      const score = comp.scores[a] ?? 0;
      return `${score}/100`;
    });
    const winnerEmoji = comp.winner === "fox" ? "🦊" : "🤖";
    rows.push(`| T${comp.tier} ${tierName} | ${scores.join(" | ")} | ${winnerEmoji} ${comp.winner} |`);
  }

  // Totals
  const totals = agentNames.map((a) => {
    const agent = agents.find((ag) => ag.agent === a)!;
    return `**${agent.total}/1000**`;
  });
  const overallWinner = agents.reduce((best, a) =>
    a.total > best.total ? a : best
  );
  rows.push(`| **Total** | ${totals.join(" | ")} | **${overallWinner.agent === "fox" ? "🦊" : "🤖"} ${overallWinner.agent}** |`);

  return rows.join("\n");
}

/**
 * Generate per-tier breakdown section.
 */
function generateTierSection(comp: TierComparison, agents: AgentScore[]): string {
  const lines: string[] = [];
  const tierName = TIER_NAMES[comp.tier] ?? `Tier ${comp.tier}`;
  lines.push(`### T${comp.tier}: ${tierName}`);
  lines.push("");

  const agentNames = Object.keys(comp.scores);
  const header = `| Challenge | ${agentNames.join(" | ")} |`;
  const separator = `|-----------|${agentNames.map(() => "------").join("|")}|`;
  lines.push(header);
  lines.push(separator);

  // Per-challenge scores within this tier
  for (const agent of agents) {
    const tierData = agent.tiers.find((t) => t.tier === comp.tier);
    if (tierData) {
      for (const ch of tierData.challenges) {
        // Only show for first agent to avoid duplication
        if (agent === agents[0]) {
          const scores = agents.map((a) => {
            const t = a.tiers.find((t2) => t2.tier === comp.tier);
            const c = t?.challenges.find((c2) => c2.challenge_id === ch.challenge_id);
            if (!c) return "-";
            const emoji = c.catastrophic_failure ? "💥" : c.passed ? "✅" : (c.efficiency_raw === Infinity ? "⏱️" : "❌");
            return `${emoji} ${c.total}/10`;
          });
          lines.push(`| ${ch.challenge_id} | ${scores.join(" | ")} |`);
        }
      }
    }
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Generate the pass bar verdict table.
 */
function generateVerdictTable(verdict: PassBarVerdict): string {
  const rows: string[] = [
    "| Criterion | Result | Detail |",
    "|-----------|--------|--------|",
  ];

  for (const c of verdict.criteria) {
    const emoji = c.passed ? "✅ PASS" : "❌ FAIL";
    rows.push(`| ${c.criterion}: ${c.description} | ${emoji} | ${c.detail} |`);
  }

  return rows.join("\n");
}

/**
 * Generate efficiency comparison table.
 */
function generateEfficiencyTable(agents: AgentScore[]): string {
  const rows: string[] = [
    "| Agent | Median Efficiency | Mean Score | Pass Rate |",
    "|-------|-------------------|------------|-----------|",
  ];

  for (const agent of agents) {
    rows.push(
      `| ${agent.agent} | ${agent.median_efficiency.toFixed(2)} | ${agent.mean_score.toFixed(1)} | ${(agent.pass_rate * 100).toFixed(1)}% |`,
    );
  }

  return rows.join("\n");
}

/**
 * Generate catastrophic failures table.
 */
function generateCatastrophicTable(agents: AgentScore[]): string {
  const rows: string[] = [
    "| Agent | Catastrophic Failures | Details |",
    "|-------|----------------------|---------|",
  ];

  for (const agent of agents) {
    const failures = agent.tiers
      .flatMap((t) => t.challenges)
      .filter((c) => c.catastrophic_failure !== null)
      .map((c) => `${c.challenge_id}: ${c.catastrophic_failure!.indicator}`);

    rows.push(
      `| ${agent.agent} | ${agent.catastrophic_count} | ${failures.length > 0 ? failures.join("; ") : "None"} |`,
    );
  }

  return rows.join("\n");
}

// ─── Single Agent Report ────────────────────────────────────────────────

/**
 * Generate a standalone report for a single agent's results.
 */
export function generateAgentReport(
  agentScore: AgentScore,
  date: string = new Date().toISOString().slice(0, 10),
): string {
  const lines: string[] = [];

  lines.push(`# AFB Results — ${agentScore.agent}`);
  lines.push(`## ${date}`);
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| **Total Score** | ${agentScore.total}/1000 |`);
  lines.push(`| **Pass Rate** | ${(agentScore.pass_rate * 100).toFixed(1)}% (${agentScore.pass_count}/100) |`);
  lines.push(`| **Mean Score** | ${agentScore.mean_score.toFixed(1)}/10 |`);
  lines.push(`| **Median Efficiency** | ${agentScore.median_efficiency.toFixed(2)} |`);
  lines.push(`| **Catastrophic Failures** | ${agentScore.catastrophic_count} |`);
  lines.push("");

  lines.push("### Per-Tier Results");
  lines.push("");
  lines.push("| Tier | Score | Pass Rate | Catastrophic |");
  lines.push("|------|-------|-----------|-------------|");

  for (const tier of agentScore.tiers) {
    const tierName = TIER_NAMES[tier.tier] ?? `Tier ${tier.tier}`;
    lines.push(
      `| T${tier.tier} ${tierName} | ${tier.total}/100 | ${(tier.pass_rate * 100).toFixed(0)}% (${tier.pass_count}/10) | ${tier.catastrophic_count} |`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

// ─── CLI Entry Point ────────────────────────────────────────────────────

export async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--compare")) {
    // Load all agent result files and generate comparison
    const foxPath = args[args.indexOf("--fox") + 1];
    const aiderPath = args[args.indexOf("--aider") + 1];
    const goosePath = args[args.indexOf("--goose") + 1];

    const foxData = JSON.parse(await Bun.file(foxPath).text()) as AgentScore;
    const aiderData = JSON.parse(await Bun.file(aiderPath).text()) as AgentScore;
    const gooseData = JSON.parse(await Bun.file(goosePath).text()) as AgentScore;

    const report = generateComparisonReport([foxData, aiderData, gooseData]);
    console.log(report);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}
