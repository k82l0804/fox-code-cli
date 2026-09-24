export class Counter {
  private count = 0;

  increment(step?: number): void {
    const amount = step !== undefined ? step : 1;
    this.count += amount;
  }

  get(): number {
    return this.count;
  }
}
