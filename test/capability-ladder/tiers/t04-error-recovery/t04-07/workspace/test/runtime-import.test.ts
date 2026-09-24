import { expect, test, describe } from "bun:test";
import { getSecuredData } from "../src/index";

describe("runtime import resolution", () => {
  test("loads and executes getSecuredData", () => {
    expect(getSecuredData("payload")).toBe("hash-payload");
  });
});
