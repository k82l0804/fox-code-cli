import { expect, test, describe } from "bun:test";

const SANDBOX = process.env.AFB_SANDBOX!;

describe("t10-07: Timezone UTC Rollover", () => {
  test("workspace tests pass", () => {
    const proc = Bun.spawnSync(
      ["bun", "test", "test/date.test.ts"],
      { cwd: SANDBOX, env: { ...process.env, CI: "true", TZ: "America/New_York" } },
    );
    expect(proc.exitCode).toBe(0);
  });
});
