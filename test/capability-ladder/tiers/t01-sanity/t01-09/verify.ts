import { expect, test, describe } from "bun:test";
import { join } from "path";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t01-09: Convert callback to async/await Promise API", () => {
  test("src/reader.ts exports readTextFileAsync as a function", async () => {
    const reader = await import(join(SANDBOX, "src/reader.ts"));
    expect(typeof reader.readTextFileAsync).toBe("function");
    expect(typeof reader.readFileCallback).toBe("function");
  });

  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/reader.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true" } }
    );
    expect(proc.exitCode).toBe(0);
  });
});
