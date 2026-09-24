export type State = "CLOSED" | "OPEN";

export class CircuitBreaker {
  state: State = "CLOSED";

  execute<T>(fn: () => T): T {
    // TODO: implement circuit breaker
    return fn();
  }
}
