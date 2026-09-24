import { expect, test, describe } from "bun:test";
import { truncateString } from "../src/strings";

describe("truncateString", () => {
  test("truncates string longer than maxLen and appends ellipsis", () => {
    expect(truncateString("hello world", 5)).toBe("hello...");
  });

  test("leaves string unchanged if within maxLen", () => {
    expect(truncateString("test", 5)).toBe("test");
    expect(truncateString("hello", 5)).toBe("hello");
  });
});
