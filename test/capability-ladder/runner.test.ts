/**
 * AFB Unit Tests — Runner Harness & Discovery
 *
 * Validates tier discovery, challenge discovery, agent command construction,
 * sandbox creation with git initial-state tag, and verification runner.
 */

import { expect, test, describe, afterAll } from "bun:test";
import { existsSync, rmSync } from "fs";
import { join } from "path";
import {
  discoverTiers,
  discoverChallenges,
  loadChallenge,
  loadTier,
  AGENT_COMMANDS,
  createSandbox,
  runVerification,
  getGitDiff,
  getAiderBin,
  getGooseBin,
} from "./runner";

describe("AFB Runner Discovery", () => {
  test("discoverTiers finds all tier directories", () => {
    const tiers = discoverTiers();
    expect(tiers.length).toBeGreaterThanOrEqual(10);
    expect(tiers).toContain("t01-sanity");
    expect(tiers).toContain("t04-error-recovery");
    expect(tiers).toContain("t10-swe-bench");
  });

  test("discoverChallenges finds challenges in tier directory", () => {
    const t1Challenges = discoverChallenges("t01-sanity");
    expect(t1Challenges).toContain("t01-01");

    const t4Challenges = discoverChallenges("t04-error-recovery");
    expect(t4Challenges).toContain("t04-02");
  });

  test("loadChallenge parses challenge.json correctly", async () => {
    const meta = await loadChallenge("t01-sanity", "t01-01");
    expect(meta.id).toBe("t01-01");
    expect(meta.tier).toBe(1);
    expect(meta.name).toBe("Fix off-by-one in array chunking");
    expect(meta.reference_solution.files_changed).toBe(1);
    expect(meta.reference_solution.lines_changed).toBe(1);
  });

  test("loadTier returns tier metadata", async () => {
    const tierMeta = await loadTier("t01-sanity");
    expect(tierMeta.tier).toBe(1);
    expect(tierMeta.autonomy_required).toBe(false);
    expect(tierMeta.timeout_seconds).toBe(120);
  });
});

describe("AFB Agent Command Construction", () => {
  test("constructs Fox headless run command with --dir and --auto", () => {
    const { args, env } = AGENT_COMMANDS.fox("/tmp/test-sandbox", "Fix bug", "custom/model");
    expect(args).toContain("run");
    expect(args).toContain("Fix bug");
    expect(args).toContain("--dir");
    expect(args).toContain("/tmp/test-sandbox");
    expect(args).toContain("--auto");
    expect(args).toContain("-m");
    expect(args).toContain("custom/model");
    expect(env.GIT_TERMINAL_PROMPT).toBe("0");
    expect(env.CI).toBe("true");
    expect(env.AFB_SANDBOX).toBe("/tmp/test-sandbox");
  });

  test("constructs Aider non-interactive command matching competitor-eval", () => {
    const { args, env } = AGENT_COMMANDS.aider("/tmp/test-sandbox", "Fix bug", "gpt-4o");
    expect(args).toContain("--yes-always");
    expect(args).toContain("--exit");
    expect(args).toContain("--no-git-commit-verify");
    expect(args).toContain("--no-analytics");
    expect(args).toContain("--no-check-update");
    expect(args).toContain("--no-show-release-notes");
    expect(args).toContain("--no-browser");
    expect(args).toContain("--no-pretty");
    expect(args).toContain("--model");
    expect(args).toContain("openai/gpt-4o");
    expect(env.OPENAI_API_BASE).toBeDefined();
    expect(env.OPENAI_API_KEY).toBeDefined();
    expect(env.GIT_TERMINAL_PROMPT).toBe("0");
  });

  test("constructs Goose headless command matching competitor-eval", () => {
    const { args, env } = AGENT_COMMANDS.goose("/tmp/test-sandbox", "Fix bug", "openai/gpt-4o");
    expect(args).toContain("run");
    expect(args).toContain("--no-session");
    expect(args).toContain("--stats");
    expect(args).toContain("--provider");
    expect(args).toContain("openai");
    expect(args).toContain("--model");
    expect(args).toContain("gpt-4o");
    expect(args).toContain("--text");
    expect(args).toContain("Fix bug");
    expect(env.GOOSE_PROVIDER).toBe("openai");
    expect(env.OPENAI_BASE_URL).toBeDefined();
    expect(env.OPENAI_API_KEY).toBeDefined();
  });

  test("resolves binary paths for available agents", () => {
    const aider = getAiderBin();
    expect(typeof aider).toBe("string");

    const goose = getGooseBin();
    expect(typeof goose).toBe("string");
  });
});

describe("AFB Sandbox & Git Baseline", () => {
  const testSandbox = "/tmp/afb-sandbox/t01-sanity-t01-01";

  afterAll(() => {
    if (existsSync(testSandbox)) {
      rmSync(testSandbox, { recursive: true, force: true });
    }
  });

  test("creates sandbox with git repo and initial-state tag", () => {
    const sandboxPath = createSandbox("t01-sanity", "t01-01");
    expect(existsSync(sandboxPath)).toBe(true);
    expect(existsSync(join(sandboxPath, "src/utils.ts"))).toBe(true);
    expect(existsSync(join(sandboxPath, "test/utils.test.ts"))).toBe(true);

    // Verify git tag exists
    const proc = Bun.spawnSync(["git", "tag", "-l", "initial-state"], {
      cwd: sandboxPath,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    expect(proc.stdout.toString().trim()).toBe("initial-state");

    // Initially, git diff should be empty
    const diff = getGitDiff(sandboxPath);
    expect(diff.trim()).toBe("");
  });

  test("runs verification on initial (unfixed) workspace and reports failure", async () => {
    const sandboxPath = createSandbox("t01-sanity", "t01-01");
    const result = await runVerification("t01-sanity", "t01-01", sandboxPath);

    expect(result.challenge_id).toBe("t01-01");
    expect(result.tests_total).toBeGreaterThan(0);
    // Unfixed workspace should fail chunkArray remainder test
    expect(result.passed).toBe(false);
  });

  test("runs verification on solution and reports success", async () => {
    const sandboxPath = createSandbox("t01-sanity", "t01-01");

    // Copy solution to sandbox
    const solutionFile = join(import.meta.dir, "tiers/t01-sanity/t01-01/solution/utils.ts");
    const destFile = join(sandboxPath, "src/utils.ts");
    const solutionContent = await Bun.file(solutionFile).text();
    await Bun.write(destFile, solutionContent);

    // Verify git diff reflects exactly 1 line changed in src/utils.ts
    const diff = getGitDiff(sandboxPath);
    expect(diff).toContain("diff --git a/src/utils.ts b/src/utils.ts");

    const result = await runVerification("t01-sanity", "t01-01", sandboxPath);
    expect(result.passed).toBe(true);
    expect(result.tests_failed).toBe(0);
  });
});
