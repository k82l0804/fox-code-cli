import { expect, test, describe } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t01-07: Fix broken JSON configuration file", () => {
  test("config/settings.json is valid JSON", () => {
    const content = readFileSync(join(SANDBOX, "config/settings.json"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.appName).toBe("FoxService");
    expect(parsed.port).toBe(8080);
  });

  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/config.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } }
    );
    expect(proc.exitCode).toBe(0);
  });

  test("only config/settings.json was modified", () => {
    const proc = Bun.spawnSync(
      ["git", "diff", "--name-only", "initial-state"],
      { cwd: SANDBOX, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }
    );
    const changed = proc.stdout.toString().trim().split("\n").filter(Boolean);
    expect(changed.length).toBe(1);
    expect(changed[0]).toBe("config/settings.json");
  });
});
