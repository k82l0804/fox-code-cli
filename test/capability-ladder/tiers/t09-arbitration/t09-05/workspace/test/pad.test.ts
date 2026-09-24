import { expect, test, describe } from "bun:test";
import { leftPad } from "../src/pad";

describe("LeftPad Arbitration", () => {
  test("pads strings to required length", () => {
    expect(leftPad("foo", 5)).toBe("  foo");
    expect(leftPad("foo", 5, "0")).toBe("00foo");
    expect(leftPad("foobar", 3)).toBe("foobar");
  });
});
