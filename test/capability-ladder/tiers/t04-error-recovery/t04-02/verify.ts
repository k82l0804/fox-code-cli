/**
 * AFB Verification: t04-02 — Misleading error, bug is elsewhere
 */
import { expect, test, describe } from "bun:test";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t04-02: Misleading error — bug is elsewhere", () => {
  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/pipeline.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } },
    );
    expect(proc.exitCode).toBe(0);
  });

  test("src/formatter.ts was NOT modified (it was correct)", () => {
    const proc = Bun.spawnSync(
      ["git", "diff", "--name-only", "HEAD"],
      { cwd: SANDBOX, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } },
    );
    const changed = proc.stdout.toString().trim().split("\n").filter(Boolean);
    expect(changed).not.toContain("src/formatter.ts");
  });

  test("src/parser.ts WAS modified (root cause)", () => {
    const proc = Bun.spawnSync(
      ["git", "diff", "--name-only", "HEAD"],
      { cwd: SANDBOX, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } },
    );
    const changed = proc.stdout.toString().trim().split("\n").filter(Boolean);
    expect(changed).toContain("src/parser.ts");
  });

  test("parser returns metadata for empty tags", async () => {
    const mod = await import(join(SANDBOX, "src/parser.ts"));
    const record = mod.parseRecord("2|Bob|2024-01-02|");
    expect(record).not.toBeNull();
    expect(record.metadata).toBeDefined();
    expect(record.metadata.tags).toEqual([]);
  });

  test("test file was not modified", () => {
    const proc = Bun.spawnSync(
      ["git", "diff", "--name-only", "HEAD"],
      { cwd: SANDBOX, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } },
    );
    const changed = proc.stdout.toString().trim().split("\n").filter(Boolean);
    expect(changed).not.toContain("test/pipeline.test.ts");
  });
});
