import { MiddlewarePipeline, type Middleware } from "./middleware";
import { executeBackend, type Context } from "./backend";

export function createHandler(middlewares: Middleware[] = []) {
  const pipeline = new MiddlewarePipeline();
  for (const m of middlewares) {
    pipeline.use(m);
  }

  return async function handle(ctx: Context): Promise<Context> {
    await pipeline.execute(ctx, executeBackend);
    return ctx;
  };
}
