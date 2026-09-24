import { expect, test, describe } from "bun:test";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t06-05: Decompose Monolith", () => {
  test("ARCHITECTURE.md exists and documents services", () => {
    const archPath = join(SANDBOX, "ARCHITECTURE.md");
    expect(existsSync(archPath)).toBe(true);
    const text = readFileSync(archPath, "utf-8");
    expect(text).toContain("AuthService");
    expect(text).toContain("TelemetryService");
    expect(text).toContain("NotificationService");
  });

  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/refactor.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } },
    );
    expect(proc.exitCode).toBe(0);
  });
});
