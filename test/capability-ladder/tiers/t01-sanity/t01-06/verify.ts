import { expect, test, describe } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t01-06: Delete dead code and unused imports", () => {
  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/service.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } }
    );
    expect(proc.exitCode).toBe(0);
  });

  test("dead code and unused import are removed", () => {
    const content = readFileSync(join(SANDBOX, "src/service.ts"), "utf-8");
    expect(content).not.toContain("unusedHelper");
    expect(content).not.toContain("deprecatedOldInternalLogic");
    expect(content).toContain("neededHelper");
    expect(content).toContain("processPayload");
  });

  test("src/helpers.ts was not modified", () => {
    const proc = Bun.spawnSync(
      ["git", "diff", "--name-only", "initial-state"],
      { cwd: SANDBOX, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }
    );
    const changed = proc.stdout.toString().trim().split("\n").filter(Boolean);
    expect(changed).not.toContain("src/helpers.ts");
  });
});
