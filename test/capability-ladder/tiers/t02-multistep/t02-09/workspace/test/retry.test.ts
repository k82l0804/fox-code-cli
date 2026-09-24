import { expect, test, describe } from "bun:test";
import { withRetry } from "../src/retry";

describe("withRetry", () => {
  test("returns immediately on success", async () => {
    let calls = 0;
    const res = await withRetry(async () => {
      calls++;
      return "ok";
    });
    expect(res).toBe("ok");
    expect(calls).toBe(1);
  });

  test("retries until success within limit", async () => {
    let calls = 0;
    const res = await withRetry(async () => {
      calls++;
      if (calls < 3) throw new Error("Temporary error");
      return "recovered";
    }, { initialDelayMs: 10, backoffFactor: 1.5, maxRetries: 3 });

    expect(res).toBe("recovered");
    expect(calls).toBe(3);
  });

  test("rethrows last error when retries exhausted", async () => {
    let calls = 0;
    expect(withRetry(async () => {
      calls++;
      throw new Error(`Failure on attempt ${calls}`);
    }, { initialDelayMs: 10, maxRetries: 2 })).rejects.toThrow("Failure on attempt 3");
  });

  test("stops retrying if retryIf returns false", async () => {
    let calls = 0;
    expect(withRetry(async () => {
      calls++;
      const err = new Error("Fatal unrecoverable error");
      (err as any).fatal = true;
      throw err;
    }, {
      initialDelayMs: 10,
      maxRetries: 5,
      retryIf: (err: any) => !err.fatal
    })).rejects.toThrow("Fatal unrecoverable error");

    expect(calls).toBe(1);
  });
});
