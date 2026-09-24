import { expect, test, describe } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t05-02: Hidden README Constraint", () => {
  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/dedup.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } },
    );
    expect(proc.exitCode).toBe(0);
  });

  test("does not use Set per README constraint", () => {
    const code = readFileSync(join(SANDBOX, "src/dedup.ts"), "utf-8");
    expect(code).not.toContain("new Set");
    expect(code).not.toContain("Set<");
  });
});
