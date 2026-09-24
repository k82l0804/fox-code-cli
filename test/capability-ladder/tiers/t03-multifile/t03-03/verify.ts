import { expect, test, describe } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t03-03: Decompose monolith into http, auth, and router modules", () => {
  test("monolith.ts is removed and modular files exist", () => {
    expect(existsSync(join(SANDBOX, "src/monolith.ts"))).toBe(false);
    expect(existsSync(join(SANDBOX, "src/http.ts"))).toBe(true);
    expect(existsSync(join(SANDBOX, "src/auth.ts"))).toBe(true);
    expect(existsSync(join(SANDBOX, "src/router.ts"))).toBe(true);
    expect(existsSync(join(SANDBOX, "src/index.ts"))).toBe(true);
  });

  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/modular.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } }
    );
    expect(proc.exitCode).toBe(0);
  });
});
