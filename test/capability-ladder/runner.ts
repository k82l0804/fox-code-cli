/**
 * AFB Runner — Challenge execution harness
 *
 * Manages sandbox creation, agent invocation, output capture,
 * verification execution, and git diff analysis for each challenge.
 */

import { existsSync, mkdirSync, rmSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import { scoreChallenge, scoreTier } from "./rubric";
import type {
  ChallengeMetadata,
  TierMetadata,
  AgentRun,
  VerifyResult,
  ChallengeScore,
  TierScore,
} from "./rubric";

// ─── Config ─────────────────────────────────────────────────────────────

const LADDER_ROOT = resolve(import.meta.dir);
const TIERS_DIR = join(LADDER_ROOT, "tiers");
const SANDBOX_BASE = "/tmp/afb-sandbox";

/**
 * Per-tier soft time budgets (seconds).
 *
 * These are "open-ended with adjustable soft limits" — agents run freely
 * until the budget expires, then timeout = FAIL + worst efficiency score.
 * Reference solution time_budget_seconds in each challenge.json is kept
 * separately for efficiency grading of runs that finish within budget.
 */
const DEFAULT_TIER_TIMEOUTS: Record<number, number> = {
  1: 600, 2: 600, 3: 600,       // 10 min — basic + multi-file
  4: 900, 5: 900,                // 15 min — tool orchestration + adversarial
  6: 1200, 7: 1200,              // 20 min — long-horizon + autonomy
  8: 1500, 9: 1500, 10: 1500,    // 25 min — Guardian-tier evaluation
};

/**
 * Agent binary resolvers.
 */
export function getAiderBin(): string {
  if (process.env.AIDER_BIN && existsSync(process.env.AIDER_BIN)) return process.env.AIDER_BIN;
  const workspaceAider = resolve(LADDER_ROOT, "../../../ext-repo/agent-cli/aider/.venv/bin/aider");
  if (existsSync(workspaceAider)) return workspaceAider;
  const systemAider = Bun.which("aider");
  if (systemAider) return systemAider;
  return "aider";
}

export function getGooseBin(): string {
  if (process.env.GOOSE_BIN && existsSync(process.env.GOOSE_BIN)) return process.env.GOOSE_BIN;
  const systemGoose = Bun.which("goose");
  if (systemGoose) return systemGoose;
  const homeGoose = join(process.env.HOME ?? "", ".local/bin/goose");
  if (existsSync(homeGoose)) return homeGoose;
  return "goose";
}

export interface AgentInvocation {
  args: string[];
  env: Record<string, string | undefined>;
}

/**
 * Agent invocation command builders.
 */
export const AGENT_COMMANDS: Record<
  string,
  (sandbox: string, prompt: string, model?: string) => AgentInvocation
> = {
  fox: (sandbox, prompt, model) => {
    const args = [
      "bun", "run", join(LADDER_ROOT, "../../src/index.ts"),
      "run", prompt,
      "--dir", sandbox,
      "--auto",
    ];
    if (model) {
      args.push("-m", model);
    }
    return {
      args,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        CI: "true",
        AFB_SANDBOX: sandbox,
      },
    };
  },
  aider: (sandbox, prompt, model) => {
    const aiderModel = model ? `openai/${model.replace(/^openai\//, "")}` : "openai/gpt-4o";
    const aiderBin = getAiderBin();
    return {
      args: [
        aiderBin,
        "--model", aiderModel,
        "--message", prompt,
        "--yes-always",
        "--no-git-commit-verify",
        "--no-analytics",
        "--no-check-update",
        "--no-show-release-notes",
        "--no-browser",
        "--no-pretty",
        "--exit",
      ],
      env: {
        ...process.env,
        OPENAI_API_BASE: process.env.OPENAI_BASE_URL ?? "http://localhost:8000/v1",
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "local-dev",
        GIT_TERMINAL_PROMPT: "0",
        CI: "true",
        AFB_SANDBOX: sandbox,
      },
    };
  },
  goose: (sandbox, prompt, model) => {
    const gooseModel = model ? model.replace(/^openai\//, "") : "gpt-4o";
    const gooseBin = getGooseBin();
    return {
      args: [
        gooseBin,
        "run",
        "--no-session",
        "--stats",
        "--provider", "openai",
        "--model", gooseModel,
        "--text", prompt,
      ],
      env: {
        ...process.env,
        GOOSE_PROVIDER: "openai",
        OPENAI_BASE_URL: process.env.OPENAI_BASE_URL ?? "http://localhost:8000/v1",
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "local-dev",
        GIT_TERMINAL_PROMPT: "0",
        CI: "true",
        AFB_SANDBOX: sandbox,
      },
    };
  },
};

// ─── Discovery ──────────────────────────────────────────────────────────

/**
 * List all tier directories in the tiers/ folder.
 */
export function discoverTiers(): string[] {
  if (!existsSync(TIERS_DIR)) return [];
  return readdirSync(TIERS_DIR)
    .filter((d) => d.startsWith("t") && statSync(join(TIERS_DIR, d)).isDirectory())
    .sort();
}

/**
 * List all challenge directories within a tier directory.
 */
export function discoverChallenges(tierDir: string): string[] {
  const fullPath = join(TIERS_DIR, tierDir);
  if (!existsSync(fullPath)) return [];
  return readdirSync(fullPath)
    .filter((d) => {
      const p = join(fullPath, d);
      return statSync(p).isDirectory() && existsSync(join(p, "challenge.json"));
    })
    .sort();
}

/**
 * Load challenge metadata from a challenge directory.
 */
export async function loadChallenge(tierDir: string, challengeDir: string): Promise<ChallengeMetadata> {
  const path = join(TIERS_DIR, tierDir, challengeDir, "challenge.json");
  const content = await Bun.file(path).text();
  return JSON.parse(content) as ChallengeMetadata;
}

/**
 * Load tier metadata from a tier directory.
 */
export async function loadTier(tierDir: string): Promise<TierMetadata> {
  const path = join(TIERS_DIR, tierDir, "tier.json");
  if (!existsSync(path)) {
    // Generate default metadata from directory name
    const match = tierDir.match(/^t(\d+)-(.+)$/);
    const tierNum = match ? parseInt(match[1]) : 0;
    return {
      tier: tierNum,
      name: tierDir,
      description: "",
      fault_line: "",
      autonomy_required: tierNum >= 6,
      guardian_required: tierNum >= 8 && tierNum <= 9,
      timeout_seconds: DEFAULT_TIER_TIMEOUTS[tierNum] ?? 120,
    };
  }
  const content = await Bun.file(path).text();
  return JSON.parse(content) as TierMetadata;
}

// ─── Sandbox Management ─────────────────────────────────────────────────

/**
 * Create a fresh sandbox for a challenge, copying workspace/ contents.
 */
export function createSandbox(tierDir: string, challengeDir: string): string {
  const workspaceDir = join(TIERS_DIR, tierDir, challengeDir, "workspace");
  const sandboxPath = join(SANDBOX_BASE, `${tierDir}-${challengeDir}`);

  // Clean and create
  if (existsSync(sandboxPath)) {
    rmSync(sandboxPath, { recursive: true, force: true });
  }
  mkdirSync(sandboxPath, { recursive: true });

  if (existsSync(workspaceDir)) {
    // Copy workspace files into sandbox
    copyDirSync(workspaceDir, sandboxPath);
  }

  // Initialize git in sandbox
  Bun.spawnSync(["git", "init", "-q"], {
    cwd: sandboxPath,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  Bun.spawnSync(["git", "config", "user.email", "afb@bench.local"], {
    cwd: sandboxPath,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  Bun.spawnSync(["git", "config", "user.name", "AFB Runner"], {
    cwd: sandboxPath,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  Bun.spawnSync(["git", "add", "."], {
    cwd: sandboxPath,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  Bun.spawnSync(["git", "commit", "-q", "-m", "Initial state"], {
    cwd: sandboxPath,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  Bun.spawnSync(["git", "tag", "-f", "initial-state"], {
    cwd: sandboxPath,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });

  return sandboxPath;
}

/**
 * Recursively copy a directory.
 */
function copyDirSync(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      const content = Bun.file(srcPath);
      Bun.write(destPath, content);
    }
  }
}

// ─── Agent Execution ────────────────────────────────────────────────────

/**
 * Invoke an agent CLI against a sandbox with a task prompt.
 * Returns the AgentRun data including stdout, stderr, duration, and exit code.
 */
export async function runAgent(
  agent: "fox" | "aider" | "goose",
  challenge: ChallengeMetadata,
  sandboxPath: string,
  timeoutSeconds: number,
  model?: string,
): Promise<AgentRun> {
  const invocationBuilder = AGENT_COMMANDS[agent];
  if (!invocationBuilder) {
    throw new Error(`Unknown agent: ${agent}`);
  }

  // Pre-flight check for external binaries
  if (agent === "aider") {
    const bin = getAiderBin();
    if (!existsSync(bin) && !Bun.which("aider")) {
      throw new Error(`Aider executable not found at ${bin}`);
    }
  }
  if (agent === "goose") {
    const bin = getGooseBin();
    if (!existsSync(bin) && !Bun.which("goose")) {
      throw new Error(`Goose executable not found at ${bin}`);
    }
  }

  const { args, env } = invocationBuilder(sandboxPath, challenge.inputs.task_prompt, model);
  const startTime = Date.now();
  let timedOut = false;

  const proc = Bun.spawn(args, {
    cwd: sandboxPath,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: env as Record<string, string>,
  });

  // Set up soft timeout — kill the process when budget expires
  const timeout = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, timeoutSeconds * 1000);

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  clearTimeout(timeout);

  const durationSeconds = (Date.now() - startTime) / 1000;

  // Get git diff stats against initial-state
  const diffResult = Bun.spawnSync(
    ["git", "diff", "--stat", "initial-state"],
    {
      cwd: sandboxPath,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    },
  );
  const diffStat = diffResult.stdout.toString();
  const filesTouched = countFilesInDiff(diffStat);
  const linesChanged = countLinesInDiff(diffStat);

  // Estimate token count from output length (rough: 4 chars ≈ 1 token)
  const tokensConsumed = Math.ceil((stdout.length + stderr.length) / 4);

  return {
    agent,
    challenge_id: challenge.id,
    tier: challenge.tier,
    exit_code: exitCode,
    duration_seconds: durationSeconds,
    tokens_consumed: tokensConsumed,
    files_touched: filesTouched,
    lines_changed: linesChanged,
    stdout,
    stderr,
    sandbox_path: sandboxPath,
    timed_out: timedOut,
  };
}

/**
 * Count files changed from git diff --stat output.
 */
function countFilesInDiff(diffStat: string): number {
  const lines = diffStat.trim().split("\n");
  return Math.max(0, lines.length - 1);
}

/**
 * Count total lines changed from git diff --stat output.
 */
function countLinesInDiff(diffStat: string): number {
  const match = diffStat.match(/(\d+) insertions?\(\+\)/);
  const insertions = match ? parseInt(match[1]) : 0;
  const delMatch = diffStat.match(/(\d+) deletions?\(-\)/);
  const deletions = delMatch ? parseInt(delMatch[1]) : 0;
  return insertions + deletions;
}

/**
 * Get the full git diff against initial-state for analysis.
 */
export function getGitDiff(sandboxPath: string): string {
  const result = Bun.spawnSync(
    ["git", "diff", "initial-state"],
    {
      cwd: sandboxPath,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    },
  );
  return result.stdout.toString();
}

// ─── Verification ───────────────────────────────────────────────────────

/**
 * Run verify.ts against the sandbox to check acceptance criteria.
 */
export async function runVerification(
  tierDir: string,
  challengeDir: string,
  sandboxPath: string,
): Promise<VerifyResult> {
  const verifyPath = join(TIERS_DIR, tierDir, challengeDir, "verify.ts");

  if (!existsSync(verifyPath)) {
    return {
      challenge_id: challengeDir,
      tests_total: 0,
      tests_passed: 0,
      tests_failed: 0,
      test_output: "No verify.ts found",
      passed: false,
    };
  }

  const proc = Bun.spawnSync(
    ["bun", "test", verifyPath, "--timeout", "30000"],
    {
      cwd: sandboxPath,
      env: {
        ...process.env,
        AFB_SANDBOX: sandboxPath,
        CI: "true",
      },
    },
  );

  const output = proc.stdout.toString() + proc.stderr.toString();

  // Parse bun test output for pass/fail counts
  const passMatch = output.match(/(\d+) pass/);
  const failMatch = output.match(/(\d+) fail/);
  const testsPassed = passMatch ? parseInt(passMatch[1]) : 0;
  const testsFailed = failMatch ? parseInt(failMatch[1]) : 0;
  const testsTotal = testsPassed + testsFailed;

  return {
    challenge_id: challengeDir,
    tests_total: testsTotal,
    tests_passed: testsPassed,
    tests_failed: testsFailed,
    test_output: output,
    passed: proc.exitCode === 0 && testsFailed === 0,
  };
}

// ─── Orchestration ──────────────────────────────────────────────────────

/**
 * Run a single challenge for a single agent. Returns the scored result.
 */
export async function runChallenge(
  agent: "fox" | "aider" | "goose",
  tierDir: string,
  challengeDir: string,
  timeoutSeconds?: number,
  model?: string,
): Promise<ChallengeScore> {
  const challenge = await loadChallenge(tierDir, challengeDir);
  const tier = await loadTier(tierDir);
  const timeout = timeoutSeconds ?? tier.timeout_seconds;

  // 1. Create sandbox
  const sandboxPath = createSandbox(tierDir, challengeDir);

  // 2. Run agent
  const run = await runAgent(agent, challenge, sandboxPath, timeout, model);

  // 3. Run verification
  const verifyResult = await runVerification(tierDir, challengeDir, sandboxPath);

  // 4. Get git diff for safety analysis
  const gitDiff = getGitDiff(sandboxPath);

  // 5. Score
  const score = scoreChallenge(run, challenge, verifyResult, gitDiff);

  return score;
}

/**
 * Run a challenge N times and return the median scored result.
 * Median is selected by total score; ties broken by raw efficiency.
 */
export async function runChallengeWithMedian(
  agent: "fox" | "aider" | "goose",
  tierDir: string,
  challengeDir: string,
  runs: number = 1,
  timeoutSeconds?: number,
  model?: string,
): Promise<ChallengeScore> {
  if (runs <= 1) {
    return runChallenge(agent, tierDir, challengeDir, timeoutSeconds, model);
  }

  const scores: ChallengeScore[] = [];
  for (let i = 0; i < runs; i++) {
    const score = await runChallenge(agent, tierDir, challengeDir, timeoutSeconds, model);
    scores.push(score);
  }

  // Sort ascending by total score, then by raw efficiency (lower is better)
  scores.sort((a, b) => {
    if (a.total !== b.total) return a.total - b.total;
    return b.efficiency_raw - a.efficiency_raw;
  });

  const medianIndex = Math.floor(scores.length / 2);
  return scores[medianIndex];
}

/**
 * Run all challenges in a tier for a single agent. Returns the tier score.
 */
export async function runTier(
  agent: "fox" | "aider" | "goose",
  tierDir: string,
  runs: number = 1,
  model?: string,
): Promise<TierScore> {
  const tier = await loadTier(tierDir);
  const challenges = discoverChallenges(tierDir);
  const scores: ChallengeScore[] = [];

  for (const challengeDir of challenges) {
    const score = await runChallengeWithMedian(agent, tierDir, challengeDir, runs, tier.timeout_seconds, model);
    scores.push(score);
  }

  return scoreTier(tier, scores);
}

/**
 * Run all tiers for a single agent. Returns all tier scores.
 */
export async function runAllTiers(
  agent: "fox" | "aider" | "goose",
  runs: number = 1,
  model?: string,
): Promise<TierScore[]> {
  const tiers = discoverTiers();
  const results: TierScore[] = [];

  for (const tierDir of tiers) {
    const tierScore = await runTier(agent, tierDir, runs, model);
    results.push(tierScore);
  }

  return results;
}

// ─── CLI Entry Point ────────────────────────────────────────────────────

/**
 * Parse CLI arguments and run the benchmark.
 * Usage:
 *   bun run test/capability-ladder/runner.ts --agent fox
 *   bun run test/capability-ladder/runner.ts --agent fox --tier t01-sanity
 *   bun run test/capability-ladder/runner.ts --agent fox --challenge t01-sanity/t01-01
 *   bun run test/capability-ladder/runner.ts --agent fox --all --runs 3 --model gpt-4o
 */
export async function main() {
  const args = process.argv.slice(2);
  const agentIdx = args.indexOf("--agent");
  const tierIdx = args.indexOf("--tier");
  const challengeIdx = args.indexOf("--challenge");
  const runsIdx = args.indexOf("--runs");
  const modelIdx = args.indexOf("--model");
  const isAll = args.includes("--all");

  const agent = agentIdx >= 0 ? (args[agentIdx + 1] as "fox" | "aider" | "goose") : "fox";
  const runs = runsIdx >= 0 ? Math.max(1, parseInt(args[runsIdx + 1], 10) || 1) : 1;
  const model = modelIdx >= 0 ? args[modelIdx + 1] : undefined;

  if (challengeIdx >= 0) {
    // Run a single challenge
    const rawChallenge = args[challengeIdx + 1];
    let tierDir: string;
    let challengeDir: string;

    if (rawChallenge.includes("/")) {
      [tierDir, challengeDir] = rawChallenge.split("/");
    } else if (tierIdx >= 0) {
      tierDir = args[tierIdx + 1];
      challengeDir = rawChallenge;
    } else {
      const allTiers = discoverTiers();
      const foundTier = allTiers.find((t) => discoverChallenges(t).includes(rawChallenge));
      if (!foundTier) {
        throw new Error(`Challenge not found: ${rawChallenge}`);
      }
      tierDir = foundTier;
      challengeDir = rawChallenge;
    }

    const score = await runChallengeWithMedian(agent, tierDir, challengeDir, runs, undefined, model);
    console.log(JSON.stringify(score, null, 2));
  } else if (tierIdx >= 0 && !isAll) {
    // Run a single tier
    const tierDir = args[tierIdx + 1];
    const tierScore = await runTier(agent, tierDir, runs, model);
    console.log(JSON.stringify(tierScore, null, 2));
  } else {
    // Run all tiers
    const tierScores = await runAllTiers(agent, runs, model);
    console.log(JSON.stringify(tierScores, null, 2));
  }
}

// Run if executed directly
if (import.meta.main) {
  main().catch(console.error);
}
