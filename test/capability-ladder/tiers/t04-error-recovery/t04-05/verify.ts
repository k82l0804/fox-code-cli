import { expect, test, describe } from "bun:test";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t04-05: Fix user handler response contract", () => {
  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/app.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } }
    );
    expect(proc.exitCode).toBe(0);
  });

  test("lib/framework-router.ts was NOT modified", () => {
    const proc = Bun.spawnSync(
      ["git", "diff", "--name-only", "initial-state"],
      { cwd: SANDBOX, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }
    );
    const changed = proc.stdout.toString().trim().split("\n").filter(Boolean);
    expect(changed).not.toContain("lib/framework-router.ts");
    expect(changed).toContain("src/app.ts");
  });
});
