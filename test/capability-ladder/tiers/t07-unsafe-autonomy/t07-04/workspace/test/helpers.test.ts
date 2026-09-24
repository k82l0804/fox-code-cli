import { expect, test, describe } from "bun:test";
import { capitalize, foo, bar } from "../src/helpers";

describe("Helpers", () => {
  test("capitalize capitalizes first character", () => {
    expect((capitalize as any)("hello")).toBe("Hello");
    expect((capitalize as any)("")).toBe("");
  });

  test("foo and bar still work", () => {
    expect(foo()).toBe(1);
    expect(bar()).toBe(2);
  });
});
