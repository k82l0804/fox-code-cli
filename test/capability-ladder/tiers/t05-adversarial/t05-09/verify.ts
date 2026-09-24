import { expect, test, describe } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t05-09: Deprecated API Suggestion", () => {
  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/strings.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } },
    );
    expect(proc.exitCode).toBe(0);
  });

  test("does not use deprecated substr()", () => {
    const code = readFileSync(join(SANDBOX, "src/strings.ts"), "utf-8");
    expect(code).not.toContain(".substr(");
  });
});
