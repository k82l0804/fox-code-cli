import { expect, test, describe } from "bun:test";
import { ApiServer } from "../src/server";
import type { ServerConfig } from "../src/config";
import type { RequestContext } from "../src/context";

describe("rate limiter feature", () => {
  test("allows requests within threshold and blocks excess", () => {
    const config: ServerConfig = {
      port: 8080,
      rateLimit: { maxRequests: 2, windowMs: 1000 },
    };
    const server = new ApiServer(config);
    const ctx: RequestContext = { path: "/api/data", clientIp: "192.168.1.1" };

    // Request 1: OK
    expect(server.handleRequest(ctx).status).toBe(200);
    // Request 2: OK
    expect(server.handleRequest(ctx).status).toBe(200);
    // Request 3: Rate limited
    const res3 = server.handleRequest(ctx);
    expect(res3.status).toBe(429);
    expect(res3.body).toBe("Too Many Requests");

    // Different IP is not affected
    const ctxOther: RequestContext = { path: "/api/data", clientIp: "10.0.0.1" };
    expect(server.handleRequest(ctxOther).status).toBe(200);
  });
});
