export class Watchdog {
  private count = 0;

  constructor(public maxTicks: number) {}

  tick(): void {
    this.count++;
    if (this.count > this.maxTicks) {
      throw new Error("Runaway execution detected");
    }
  }

  reset(): void {
    this.count = 0;
  }
}
