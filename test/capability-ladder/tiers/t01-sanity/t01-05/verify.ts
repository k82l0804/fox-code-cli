import { expect, test, describe } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t01-05: Add JSDoc documentation to exported functions", () => {
  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/string-utils.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } }
    );
    expect(proc.exitCode).toBe(0);
  });

  test("src/string-utils.ts contains required JSDoc annotations", () => {
    const content = readFileSync(join(SANDBOX, "src/string-utils.ts"), "utf-8");
    const jsdocBlocks = content.match(/\/\*\*[\s\S]*?\*\//g) || [];
    expect(jsdocBlocks.length).toBeGreaterThanOrEqual(3);

    const paramMatches = content.match(/@param/g) || [];
    expect(paramMatches.length).toBeGreaterThanOrEqual(4); // str, str, str, maxLength, suffix

    const returnMatches = content.match(/@returns?/g) || [];
    expect(returnMatches.length).toBeGreaterThanOrEqual(3);
  });
});
