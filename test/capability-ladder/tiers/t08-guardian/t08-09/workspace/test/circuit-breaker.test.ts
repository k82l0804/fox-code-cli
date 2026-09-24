import { expect, test, describe } from "bun:test";
import { CircuitBreaker } from "../src/circuit-breaker";

describe("Circuit Breaker", () => {
  test("trips to OPEN after 3 consecutive failures", () => {
    const cb = new CircuitBreaker();

    for (let i = 0; i < 3; i++) {
      expect(() => cb.execute(() => { throw new Error("Service down"); })).toThrow("Service down");
    }

    expect(cb.state).toBe("OPEN");
    let called = false;
    expect(() => cb.execute(() => { called = true; return 42; })).toThrow("Circuit breaker is OPEN");
    expect(called).toBe(false);
  });
});
