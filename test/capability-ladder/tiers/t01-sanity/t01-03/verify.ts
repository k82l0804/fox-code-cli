import { expect, test, describe } from "bun:test";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t01-03: Rename a function and update call sites", () => {
  test("src/calc.ts exports computeOrderTotal", async () => {
    const calc = await import(join(SANDBOX, "src/calc.ts"));
    expect(typeof calc.computeOrderTotal).toBe("function");
    expect((calc as any).calculateTotal).toBeUndefined();
  });

  test("workspace tests pass with renamed function", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/calc.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } }
    );
    expect(proc.exitCode).toBe(0);
  });

  test("no occurrences of calculateTotal remain in src/", () => {
    const proc = Bun.spawnSync(
      ["git", "grep", "calculateTotal", "src/"],
      { cwd: SANDBOX, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }
    );
    expect(proc.exitCode).not.toBe(0);
  });
});
