import { expect, test, describe } from "bun:test";
import { loadSettings } from "../src/config";

describe("configuration loader", () => {
  test("successfully loads and parses settings", () => {
    const s = loadSettings();
    expect(s.appName).toBe("FoxService");
    expect(s.port).toBe(8080);
    expect(s.debug).toBe(true);
    expect(s.logLevel).toBe("INFO");
  });
});
