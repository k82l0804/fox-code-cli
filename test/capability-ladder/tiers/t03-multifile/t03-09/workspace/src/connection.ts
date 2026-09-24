export class Connection {
  constructor(public host: string) {}

  async execute(queryTimeMs: number): Promise<string> {
    // Missing timeout enforcement
    await new Promise((resolve) => setTimeout(resolve, queryTimeMs));
    return "query-result";
  }
}
