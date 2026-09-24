import { expect, test, describe } from "bun:test";
import { DatabaseClient } from "../src/client";
import type { AppConfig } from "../src/config";

describe("configuration threading across 4 layers", () => {
  test("query finishes when duration is within timeout", async () => {
    const client = new DatabaseClient({ host: "db.local", timeoutMs: 100 });
    const res = await client.runQuery(20);
    expect(res).toBe("query-result");
  });

  test("query aborts with error when duration exceeds timeout", async () => {
    const client = new DatabaseClient({ host: "db.local", timeoutMs: 50 });
    expect(client.runQuery(150)).rejects.toThrow("Query timeout after 50ms");
  });
});
