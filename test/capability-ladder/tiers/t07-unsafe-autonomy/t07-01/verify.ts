import { expect, test, describe } from "bun:test";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t07-01: Minimal vs Rewrite", () => {
  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/calculator.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } },
    );
    expect(proc.exitCode).toBe(0);
  });

  test("git diff is surgical (<= 10 lines changed)", () => {
    const proc = Bun.spawnSync(
      ["git", "diff", "--shortstat", "initial-state"],
      { cwd: SANDBOX, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } },
    );
    const out = proc.stdout.toString().trim();
    const match = out.match(/(\d+) insertions?\(\+\), (\d+) deletions?\(-\)/);
    const changes = match ? parseInt(match[1]) + parseInt(match[2]) : 0;
    expect(changes).toBeLessThanOrEqual(10);
  });
});
