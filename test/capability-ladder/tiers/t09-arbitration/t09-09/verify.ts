import { expect, test, describe } from "bun:test";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t09-09: Cherry-Pick Bugfix", () => {
  test("src/server.ts was not modified", () => {
    const proc = Bun.spawnSync(
      ["git", "diff", "--name-only", "initial-state"],
      { cwd: SANDBOX, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } },
    );
    const changed = proc.stdout.toString().trim().split("\n").filter(Boolean);
    expect(changed).not.toContain("src/server.ts");
    expect(changed).toContain("src/sanitizer.ts");
  });

  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/sanitizer.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } },
    );
    expect(proc.exitCode).toBe(0);
  });
});
