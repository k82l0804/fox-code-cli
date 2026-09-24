import { expect, test, describe } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t09-01: Arbitrate Clean vs Leaky", () => {
  test("does not contain global leak from patch B", () => {
    const code = readFileSync(join(SANDBOX, "src/parser.ts"), "utf-8");
    expect(code).not.toContain("globalThis");
    expect(code).not.toContain("leakedCache");
  });

  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/parser.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } },
    );
    expect(proc.exitCode).toBe(0);
  });
});
