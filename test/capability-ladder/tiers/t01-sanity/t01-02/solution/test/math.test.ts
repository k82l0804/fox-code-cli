import { expect, test, describe } from "bun:test";
import { clamp, lerp, inRange } from "../src/math";

describe("clamp", () => {
  test("clamps below min", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  test("returns value within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  test("clamps above max", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  test("throws if min > max", () => {
    expect(() => clamp(5, 10, 0)).toThrow();
  });
});

describe("lerp", () => {
  test("interpolates halfway", () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
  });

  test("interpolates endpoints", () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
  });
});

describe("inRange", () => {
  test("returns true for in-range values", () => {
    expect(inRange(5, 0, 10)).toBe(true);
    expect(inRange(0, 0, 10)).toBe(true);
    expect(inRange(10, 0, 10)).toBe(true);
  });

  test("returns false for out-of-range values", () => {
    expect(inRange(-1, 0, 10)).toBe(false);
    expect(inRange(11, 0, 10)).toBe(false);
  });
});
