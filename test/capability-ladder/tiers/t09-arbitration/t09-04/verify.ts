import { expect, test, describe } from "bun:test";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t09-04: Merge Complementary Diffs", () => {
  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/calc.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } },
    );
    expect(proc.exitCode).toBe(0);
  });
});
