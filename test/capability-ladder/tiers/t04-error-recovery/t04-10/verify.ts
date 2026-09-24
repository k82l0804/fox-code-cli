import { expect, test, describe } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t04-10: Resolve strict mode compiler errors", () => {
  test("tsconfig.json retains strict: true", () => {
    const raw = readFileSync(join(SANDBOX, "tsconfig.json"), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.compilerOptions.strict).toBe(true);
  });

  test("src/sorter.ts does not use any", () => {
    const code = readFileSync(join(SANDBOX, "src/sorter.ts"), "utf-8");
    expect(code).not.toContain(": any");
    expect(code).not.toContain("@ts-ignore");
  });

  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/sorter.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } }
    );
    expect(proc.exitCode).toBe(0);
  });
});
