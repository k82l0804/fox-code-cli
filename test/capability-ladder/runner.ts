/**
 * AFB Runner — Challenge execution harness
 *
 * Manages sandbox creation, agent invocation, output capture,
 * verification execution, and git diff analysis for each challenge.
 */

import { existsSync, mkdirSync, rmSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import { scoreChallenge } from "./rubric";
import type {
  ChallengeMetadata,
  TierMetadata,
  AgentRun,
  VerifyResult,
  ChallengeScore,
  TierScore,
} from "./rubric";
import { scoreTier } from "./rubric";

// ─── Config ─────────────────────────────────────────────────────────────

const LADDER_ROOT = resolve(import.meta.dir);
const TIERS_DIR = join(LADDER_ROOT, "tiers");
const SANDBOX_BASE = "/tmp/afb-sandbox";

/**
 * Per-tier timeout defaults (seconds).
 */
const DEFAULT_TIER_TIMEOUTS: Record<number, number> = {
  1: 120, 2: 120, 3: 120, 4: 120, 5: 120,
  6: 300, 7: 300,
  8: 600, 9: 600,
  10: 300,
};

/**
 * Agent invocation commands.
 */
const AGENT_COMMANDS: Record<string, (sandbox: string, prompt: string) => string[]> = {
  fox: (sandbox, prompt) => [
    "bun", "run", join(LADDER_ROOT, "../../src/index.ts"),
    "ask", "--message", prompt, "--yes",
  ],
  aider: (sandbox, prompt) => [
    "aider", "--message", prompt, "--yes", "--no-auto-commits",
  ],
  goose: (sandbox, prompt) => [
    "goose", "run", "-t", prompt, "--no-session",
  ],
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
): Promise<AgentRun> {
  const commandBuilder = AGENT_COMMANDS[agent];
  if (!commandBuilder) {
    throw new Error(`Unknown agent: ${agent}`);
  }

  const args = commandBuilder(sandboxPath, challenge.inputs.task_prompt);
  const startTime = Date.now();

  const proc = Bun.spawn(args, {
    cwd: sandboxPath,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      CI: "true",
      AFB_SANDBOX: sandboxPath,
    },
  });

  // Set up timeout
  const timeout = setTimeout(() => {
    proc.kill();
  }, timeoutSeconds * 1000);

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  clearTimeout(timeout);

  const durationSeconds = (Date.now() - startTime) / 1000;

  // Get git diff stats
  const diffResult = Bun.spawnSync(
    ["git", "diff", "--stat", "HEAD"],
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
  };
}

/**
 * Count files changed from git diff --stat output.
 */
function countFilesInDiff(diffStat: string): number {
  const lines = diffStat.trim().split("\n");
  // Last line of git diff --stat is summary: "N files changed, ..."
  // Each preceding line is a file
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
 * Get the full git diff for analysis.
 */
export function getGitDiff(sandboxPath: string): string {
  const result = Bun.spawnSync(
    ["git", "diff", "HEAD"],
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
): Promise<ChallengeScore> {
  const challenge = await loadChallenge(tierDir, challengeDir);
  const tier = await loadTier(tierDir);
  const timeout = timeoutSeconds ?? tier.timeout_seconds;

  // 1. Create sandbox
  const sandboxPath = createSandbox(tierDir, challengeDir);

  // 2. Run agent
  const run = await runAgent(agent, challenge, sandboxPath, timeout);

  // 3. Run verification
  const verifyResult = await runVerification(tierDir, challengeDir, sandboxPath);

  // 4. Get git diff for safety analysis
  const gitDiff = getGitDiff(sandboxPath);

  // 5. Score
  const score = scoreChallenge(run, challenge, verifyResult, gitDiff);

  return score;
}

/**
 * Run all challenges in a tier for a single agent. Returns the tier score.
 */
export async function runTier(
  agent: "fox" | "aider" | "goose",
  tierDir: string,
): Promise<TierScore> {
  const tier = await loadTier(tierDir);
  const challenges = discoverChallenges(tierDir);
  const scores: ChallengeScore[] = [];

  for (const challengeDir of challenges) {
    const score = await runChallenge(agent, tierDir, challengeDir, tier.timeout_seconds);
    scores.push(score);
  }

  return scoreTier(tier, scores);
}

/**
 * Run all tiers for a single agent. Returns all tier scores.
 */
export async function runAllTiers(
  agent: "fox" | "aider" | "goose",
): Promise<TierScore[]> {
  const tiers = discoverTiers();
  const results: TierScore[] = [];

  for (const tierDir of tiers) {
    const tierScore = await runTier(agent, tierDir);
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
 */
export async function main() {
  const args = process.argv.slice(2);
  const agentIdx = args.indexOf("--agent");
  const tierIdx = args.indexOf("--tier");
  const challengeIdx = args.indexOf("--challenge");

  const agent = agentIdx >= 0 ? args[agentIdx + 1] as "fox" | "aider" | "goose" : "fox";

  if (challengeIdx >= 0) {
    // Run a single challenge
    const [tierDir, challengeDir] = args[challengeIdx + 1].split("/");
    const score = await runChallenge(agent, tierDir, challengeDir);
    console.log(JSON.stringify(score, null, 2));
  } else if (tierIdx >= 0) {
    // Run a single tier
    const tierDir = args[tierIdx + 1];
    const tierScore = await runTier(agent, tierDir);
    console.log(JSON.stringify(tierScore, null, 2));
  } else {
    // Run all tiers
    const tierScores = await runAllTiers(agent);
    console.log(JSON.stringify(tierScores, null, 2));
  }
}

// Run if executed directly
if (import.meta.main) {
  main().catch(console.error);
}
