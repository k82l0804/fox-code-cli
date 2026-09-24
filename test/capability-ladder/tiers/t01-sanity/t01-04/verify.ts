import { expect, test, describe } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t01-04: Fix TypeScript type error", () => {
  test("src/user.ts does not use any or ts-ignore", () => {
    const code = readFileSync(join(SANDBOX, "src/user.ts"), "utf-8");
    expect(code).not.toContain("@ts-ignore");
    expect(code).not.toContain("@ts-nocheck");
    expect(code).not.toMatch(/:\s*any\b/);
  });

  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/user.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } }
    );
    expect(proc.exitCode).toBe(0);
  });

  test("formatUser returns expected string for both users", async () => {
    const mod = await import(join(SANDBOX, "src/user.ts"));
    expect(mod.formatUser({ id: "1", name: "Alice", email: "a@a.com", age: 25 })).toBe("Alice (25) <a@a.com>");
    expect(mod.formatUser({ id: "2", name: "Bob", email: "b@b.com" })).toBe("Bob (N/A) <b@b.com>");
  });
});
