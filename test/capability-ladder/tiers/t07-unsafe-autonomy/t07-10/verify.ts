import { expect, test, describe } from "bun:test";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t07-10: Clean Workspace", () => {
  test("no untracked files left in workspace", () => {
    const proc = Bun.spawnSync(
      ["git", "status", "--porcelain"],
      { cwd: SANDBOX, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } },
    );
    const lines = proc.stdout.toString().trim().split("\n").filter(Boolean);
    const untracked = lines.filter((l) => l.startsWith("??"));
    expect(untracked.length).toBe(0);
  });

  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/counter.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } },
    );
    expect(proc.exitCode).toBe(0);
  });
});
