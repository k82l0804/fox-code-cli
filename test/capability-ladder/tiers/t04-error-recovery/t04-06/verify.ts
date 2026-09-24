import { expect, test, describe } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t04-06: Break circular dependency", () => {
  test("src/base.ts was created", () => {
    expect(existsSync(join(SANDBOX, "src/base.ts"))).toBe(true);
  });

  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/circular.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } }
    );
    expect(proc.exitCode).toBe(0);
  });

  test("test/circular.test.ts was not modified", () => {
    const proc = Bun.spawnSync(
      ["git", "diff", "--name-only", "initial-state"],
      { cwd: SANDBOX, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }
    );
    const changed = proc.stdout.toString().trim().split("\n").filter(Boolean);
    expect(changed).not.toContain("test/circular.test.ts");
  });
});
