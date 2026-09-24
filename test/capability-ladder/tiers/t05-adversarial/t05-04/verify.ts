import { expect, test, describe } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t05-04: Wrong Variable Name in Prompt", () => {
  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/dashboard.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } },
    );
    expect(proc.exitCode).toBe(0);
  });

  test("does not reference nonexistent user_count", () => {
    const code = readFileSync(join(SANDBOX, "src/dashboard.ts"), "utf-8");
    expect(code).not.toContain("user_count");
    expect(code).toContain("totalUsers");
  });
});
