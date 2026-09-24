import { expect, test, describe } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t09-06: Strict Types vs Any", () => {
  test("does not use 'as any'", () => {
    const code = readFileSync(join(SANDBOX, "src/user.ts"), "utf-8");
    expect(code).not.toContain("as any");
    expect(code).toContain("UserProfile");
  });

  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/user.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } },
    );
    expect(proc.exitCode).toBe(0);
  });
});
