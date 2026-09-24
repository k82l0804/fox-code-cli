export type State = "CLOSED" | "OPEN";

export class CircuitBreaker {
  state: State = "CLOSED";
  private failureCount = 0;

  execute<T>(fn: () => T): T {
    if (this.state === "OPEN") {
      throw new Error("Circuit breaker is OPEN");
    }

    try {
      const result = fn();
      this.failureCount = 0;
      return result;
    } catch (err) {
      this.failureCount++;
      if (this.failureCount >= 3) {
        this.state = "OPEN";
      }
      throw err;
    }
  }
}
