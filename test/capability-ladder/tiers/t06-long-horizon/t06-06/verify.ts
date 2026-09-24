import { expect, test, describe } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t06-06: Sub-Package Scaffolding", () => {
  test("package.json exists in packages/logger", () => {
    expect(existsSync(join(SANDBOX, "packages/logger/package.json"))).toBe(true);
  });

  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/logger.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } },
    );
    expect(proc.exitCode).toBe(0);
  });
});
