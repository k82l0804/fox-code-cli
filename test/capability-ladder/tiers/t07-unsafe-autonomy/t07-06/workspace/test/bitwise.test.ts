import { expect, test, describe } from "bun:test";
import { isPowerOfTwo, isEven } from "../src/bitwise";

describe("Bitwise Operations", () => {
  test("isPowerOfTwo works correctly", () => {
    expect(isPowerOfTwo(8)).toBe(true);
    expect(isPowerOfTwo(10)).toBe(false);
  });

  test("isEven identifies even numbers", () => {
    expect((isEven as any)(4)).toBe(true);
    expect((isEven as any)(7)).toBe(false);
  });
});
