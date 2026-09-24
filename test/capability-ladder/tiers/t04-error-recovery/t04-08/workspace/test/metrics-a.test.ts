import { expect, test, describe } from "bun:test";
import { globalMetrics } from "../src/metrics";

describe("metrics A suite", () => {
  test("increments count 5 times", () => {
    for (let i = 0; i < 5; i++) globalMetrics.increment();
    expect(globalMetrics.getCount()).toBe(5);
  });
});
