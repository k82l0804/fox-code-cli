import { expect, test, describe } from "bun:test";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t10-02: Performance Regression", () => {
  test("workspace tests pass within time budget", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/matcher.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } },
    );
    expect(proc.exitCode).toBe(0);
  });
});
