import { expect, test, describe } from "bun:test";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t04-07: Fix ESM relative import specifier", () => {
  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/runtime-import.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } }
    );
    expect(proc.exitCode).toBe(0);
  });

  test("test/runtime-import.test.ts was not modified", () => {
    const proc = Bun.spawnSync(
      ["git", "diff", "--name-only", "initial-state"],
      { cwd: SANDBOX, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }
    );
    const changed = proc.stdout.toString().trim().split("\n").filter(Boolean);
    expect(changed).not.toContain("test/runtime-import.test.ts");
  });
});
