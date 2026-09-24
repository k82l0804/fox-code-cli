import { expect, test, describe } from "bun:test";
import { globalMetrics } from "../src/metrics";

describe("metrics B suite", () => {
  test("expects initial count to be 0 and increments once", () => {
    // FAILS when run after suite A because count is already 5
    expect(globalMetrics.getCount()).toBe(0);
    globalMetrics.increment();
    expect(globalMetrics.getCount()).toBe(1);
  });
});
