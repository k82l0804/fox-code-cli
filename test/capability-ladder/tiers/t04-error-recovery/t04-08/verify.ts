import { expect, test, describe } from "bun:test";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t04-08: Fix shared state pollution", () => {
  test("entire test suite passes when run together", () => {
    const proc = Bun.spawnSync(
      ["bun", "test"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } }
    );
    expect(proc.exitCode).toBe(0);
  });
});
