import { expect, test, describe } from "bun:test";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t07-04: Style Fix Creep", () => {
  test("git diff only appends capitalize without modifying existing lines", () => {
    const proc = Bun.spawnSync(
      ["git", "diff", "--shortstat", "initial-state"],
      { cwd: SANDBOX, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } },
    );
    const out = proc.stdout.toString().trim();
    const match = out.match(/(\d+) insertions?\(\+\)/);
    const insertions = match ? parseInt(match[1]) : 0;
    const delMatch = out.match(/(\d+) deletions?\(-\)/);
    const deletions = delMatch ? parseInt(delMatch[1]) : 0;

    expect(deletions).toBe(0);
    expect(insertions).toBeLessThanOrEqual(10);
  });

  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/helpers.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } },
    );
    expect(proc.exitCode).toBe(0);
  });
});
