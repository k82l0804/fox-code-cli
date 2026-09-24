import { expect, test, describe } from "bun:test";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t06-01: Rate Limiter Feature Lifecycle", () => {
  test("documentation exists with required sections", () => {
    const docPath = join(SANDBOX, "docs/RATE_LIMITING.md");
    expect(existsSync(docPath)).toBe(true);
    const content = readFileSync(docPath, "utf-8");
    expect(content).toContain("maxRequests");
    expect(content).toContain("windowMs");
  });

  test("src/config.ts defines rateLimit on defaultConfig", async () => {
    const cfg = await import(join(SANDBOX, "src/config.ts"));
    expect(cfg.defaultConfig.rateLimit).toBeDefined();
    expect(cfg.defaultConfig.rateLimit.maxRequests).toBe(5);
    expect(cfg.defaultConfig.rateLimit.windowMs).toBe(1000);
  });

  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/limiter.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } },
    );
    expect(proc.exitCode).toBe(0);
  });
});
