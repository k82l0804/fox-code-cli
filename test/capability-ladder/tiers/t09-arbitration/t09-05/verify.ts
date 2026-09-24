import { expect, test, describe } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t09-05: Reject Hallucinated Dependency", () => {
  test("does not import fake library", () => {
    const code = readFileSync(join(SANDBOX, "src/pad.ts"), "utf-8");
    expect(code).not.toContain("super-pad-lib");
  });

  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/pad.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } },
    );
    expect(proc.exitCode).toBe(0);
  });
});
