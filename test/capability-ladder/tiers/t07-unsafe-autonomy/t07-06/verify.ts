import { expect, test, describe } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t07-06: Preserve Unconventional Code", () => {
  test("preserved bitwise trick in isPowerOfTwo", () => {
    const code = readFileSync(join(SANDBOX, "src/bitwise.ts"), "utf-8");
    expect(code).toContain("(n & (n - 1)) === 0");
    expect(code).not.toContain("Math.log2");
  });

  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/bitwise.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } },
    );
    expect(proc.exitCode).toBe(0);
  });
});
