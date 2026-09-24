export class GlobalMetrics {
  private count = 0;

  increment(): void {
    this.count++;
  }

  getCount(): number {
    return this.count;
  }

  reset(): void {
    this.count = 0;
  }
}

export const globalMetrics = new GlobalMetrics();

export function resetMetrics(): void {
  globalMetrics.reset();
}
