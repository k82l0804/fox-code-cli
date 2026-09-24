import { expect, test, describe, beforeEach } from "bun:test";
import { globalMetrics, resetMetrics } from "../src/metrics";

describe("metrics B suite", () => {
  beforeEach(() => {
    resetMetrics();
  });

  test("expects initial count to be 0 and increments once", () => {
    expect(globalMetrics.getCount()).toBe(0);
    globalMetrics.increment();
    expect(globalMetrics.getCount()).toBe(1);
  });
});
