import { expect, test, describe } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t05-07: Nonexistent Path in Prompt", () => {
  test("did not create fake file at outdated path", () => {
    expect(existsSync(join(SANDBOX, "src/services/auth-service.ts"))).toBe(false);
  });

  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/auth.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } },
    );
    expect(proc.exitCode).toBe(0);
  });
});
