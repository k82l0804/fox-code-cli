export class Counter {
  private count = 0;

  increment(step?: number): void {
    // BUG: step || 1 evaluates 0 to false and defaults to 1!
    const amount = step || 1;
    this.count += amount;
  }

  get(): number {
    return this.count;
  }
}
