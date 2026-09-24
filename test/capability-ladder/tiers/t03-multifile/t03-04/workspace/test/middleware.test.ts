import { expect, test, describe } from "bun:test";
import { createHandler } from "../src/handler";
import type { Context } from "../src/backend";

describe("middleware pipeline", () => {
  test("executes middleware in onion order around backend", async () => {
    const handler = createHandler([
      async (ctx, next) => {
        ctx.trace.push("m1-before");
        await next();
        ctx.trace.push("m1-after");
      },
      async (ctx, next) => {
        ctx.trace.push("m2-before");
        ctx.user = "Alice";
        await next();
        ctx.trace.push("m2-after");
      }
    ]);

    const ctx: Context = { trace: [] };
    const res = await handler(ctx);

    expect(res.trace).toEqual([
      "m1-before",
      "m2-before",
      "backend",
      "m2-after",
      "m1-after"
    ]);
    expect(res.response).toBe("Handled for Alice");
  });

  test("middleware can short-circuit before backend", async () => {
    const handler = createHandler([
      async (ctx, next) => {
        ctx.trace.push("blocker");
        ctx.response = "Blocked by guard";
        // does not call next()
      }
    ]);

    const ctx: Context = { trace: [] };
    const res = await handler(ctx);

    expect(res.trace).toEqual(["blocker"]);
    expect(res.response).toBe("Blocked by guard");
  });
});
