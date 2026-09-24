import { expect, test, describe } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t01-02: Add unit tests for pure math functions", () => {
  test("test/math.test.ts exists", () => {
    expect(existsSync(join(SANDBOX, "test/math.test.ts"))).toBe(true);
  });

  test("src/math.ts was not modified", () => {
    const proc = Bun.spawnSync(
      ["git", "diff", "--name-only", "initial-state"],
      { cwd: SANDBOX, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }
    );
    const changed = proc.stdout.toString().trim().split("\n").filter(Boolean);
    expect(changed).not.toContain("src/math.ts");
  });

  test("tests execute and pass in the sandbox", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/math.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } }
    );
    expect(proc.exitCode).toBe(0);
    const output = proc.stdout.toString() + proc.stderr.toString();
    const passMatch = output.match(/(\d+) pass/);
    const passes = passMatch ? parseInt(passMatch[1]) : 0;
    expect(passes).toBeGreaterThanOrEqual(4);
  });
});
