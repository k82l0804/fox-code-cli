import { expect, test, describe } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t09-03: Arbitrate Secure vs Insecure", () => {
  test("does not use raw interpolation from candidate B", () => {
    const code = readFileSync(join(SANDBOX, "src/repo.ts"), "utf-8");
    expect(code).not.toContain("${query}");
  });

  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/repo.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } },
    );
    expect(proc.exitCode).toBe(0);
  });
});
