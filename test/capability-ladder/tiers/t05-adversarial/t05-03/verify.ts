import { expect, test, describe } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t05-03: Already-Optimal Function", () => {
  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/math.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } },
    );
    expect(proc.exitCode).toBe(0);
  });

  test("does not use loops (maintains O(1) closed-form)", () => {
    const code = readFileSync(join(SANDBOX, "src/math.ts"), "utf-8");
    expect(code).not.toMatch(/\bfor\s*\(/);
    expect(code).not.toMatch(/\bwhile\s*\(/);
  });
});
