import { expect, test, describe } from "bun:test";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t09-02: Arbitrate Fast vs Slow", () => {
  test("workspace tests pass within budget", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/lookup.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } },
    );
    expect(proc.exitCode).toBe(0);
  });
});
