import { expect, test, describe } from "bun:test";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t04-01: Fix race condition in async cache warmer", () => {
  test("workspace tests pass consistently", () => {
    for (let i = 0; i < 3; i++) {
      const proc = Bun.spawnSync(
        ["bun", "test", "test/cache-warmer.test.ts"],
        { cwd: SANDBOX, env: { ...process.env, CI: "true" } }
      );
      expect(proc.exitCode).toBe(0);
    }
  });

  test("test/cache-warmer.test.ts was not modified", () => {
    const proc = Bun.spawnSync(
      ["git", "diff", "--name-only", "initial-state"],
      { cwd: SANDBOX, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }
    );
    const changed = proc.stdout.toString().trim().split("\n").filter(Boolean);
    expect(changed).not.toContain("test/cache-warmer.test.ts");
  });
});
