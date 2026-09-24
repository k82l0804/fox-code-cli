export class Connection {
  constructor(public host: string, public timeoutMs: number = 3000) {}

  async execute(queryTimeMs: number): Promise<string> {
    if (queryTimeMs > this.timeoutMs) {
      throw new Error(`Query timeout after ${this.timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, queryTimeMs));
    return "query-result";
  }
}
