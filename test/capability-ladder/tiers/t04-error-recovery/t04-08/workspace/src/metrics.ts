export class GlobalMetrics {
  private count = 0;

  increment(): void {
    this.count++;
  }

  getCount(): number {
    return this.count;
  }
}

export const globalMetrics = new GlobalMetrics();
