import { expect, test, describe } from "bun:test";
import { getDatabaseUrl } from "../src/config-loader";

describe("Config Loader", () => {
  test("uses local override when set", () => {
    expect(getDatabaseUrl()).toBe("localhost:5432");
  });
});
