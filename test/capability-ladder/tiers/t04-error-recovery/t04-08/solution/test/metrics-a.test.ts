import { expect, test, describe, beforeEach } from "bun:test";
import { globalMetrics, resetMetrics } from "../src/metrics";

describe("metrics A suite", () => {
  beforeEach(() => {
    resetMetrics();
  });

  test("increments count 5 times", () => {
    for (let i = 0; i < 5; i++) globalMetrics.increment();
    expect(globalMetrics.getCount()).toBe(5);
  });
});
