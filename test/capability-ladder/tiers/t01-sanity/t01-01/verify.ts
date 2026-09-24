/**
 * AFB Verification: t01-01 — Fix off-by-one in array chunking
 *
 * Checks that the chunkArray function correctly handles all cases
 * after the agent's fix, and that only the source file was modified.
 */
import { expect, test, describe } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t01-01: Fix off-by-one in array chunking", () => {
  test("src/utils.ts exists", () => {
    expect(existsSync(join(SANDBOX, "src/utils.ts"))).toBe(true);
  });

  test("test/utils.test.ts was not modified", async () => {
    // Check git diff to ensure test file wasn't touched
    const proc = Bun.spawnSync(
      ["git", "diff", "--name-only", "initial-state"],
      {
        cwd: SANDBOX,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      },
    );
    const changedFiles = proc.stdout.toString().trim().split("\n").filter(Boolean);
    expect(changedFiles).not.toContain("test/utils.test.ts");
  });

  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/utils.test.ts"],
      {
        cwd: SANDBOX,
        env: { ...process.env, CI: "true" },
      },
    );
    expect(proc.exitCode).toBe(0);
  });

  test("chunkArray handles remainder correctly", async () => {
    // Dynamic import from the sandbox to verify actual behavior
    const mod = await import(join(SANDBOX, "src/utils.ts"));
    expect(mod.chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test("chunkArray handles single-element remainder", async () => {
    const mod = await import(join(SANDBOX, "src/utils.ts"));
    expect(mod.chunkArray([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
  });

  test("chunkArray handles chunk size > array length", async () => {
    const mod = await import(join(SANDBOX, "src/utils.ts"));
    expect(mod.chunkArray([1, 2], 5)).toEqual([[1, 2]]);
  });

  test("only src/utils.ts was changed (blast radius = 1)", () => {
    const proc = Bun.spawnSync(
      ["git", "diff", "--name-only", "initial-state"],
      {
        cwd: SANDBOX,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      },
    );
    const changedFiles = proc.stdout.toString().trim().split("\n").filter(Boolean);
    expect(changedFiles.length).toBeLessThanOrEqual(1);
    if (changedFiles.length === 1) {
      expect(changedFiles[0]).toBe("src/utils.ts");
    }
  });
});
