import { expect, test, describe } from "bun:test";
import { Counter } from "../src/counter";

describe("Counter", () => {
  test("handles 0 step correctly without defaulting to 1", () => {
    const c = new Counter();
    c.increment(0);
    expect(c.get()).toBe(0);

    c.increment();
    expect(c.get()).toBe(1);

    c.increment(5);
    expect(c.get()).toBe(6);
  });
});
