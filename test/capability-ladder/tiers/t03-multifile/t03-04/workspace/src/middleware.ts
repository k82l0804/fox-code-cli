import type { Context } from "./backend";

export type Middleware = (ctx: Context, next: () => Promise<void>) => Promise<void>;

export class MiddlewarePipeline {
  private middlewares: Middleware[] = [];

  use(fn: Middleware): this {
    this.middlewares.push(fn);
    return this;
  }

  async execute(ctx: Context, target: (ctx: Context) => Promise<void>): Promise<void> {
    // Incomplete: directly invokes target without running middleware
    await target(ctx);
  }
}
