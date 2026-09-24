import type { Context } from "./backend";

export type Middleware = (ctx: Context, next: () => Promise<void>) => Promise<void>;

export class MiddlewarePipeline {
  private middlewares: Middleware[] = [];

  use(fn: Middleware): this {
    this.middlewares.push(fn);
    return this;
  }

  async execute(ctx: Context, target: (ctx: Context) => Promise<void>): Promise<void> {
    let index = -1;

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error("next() called multiple times");
      index = i;

      if (i < this.middlewares.length) {
        const fn = this.middlewares[i];
        await fn(ctx, () => dispatch(i + 1));
      } else {
        await target(ctx);
      }
    };

    await dispatch(0);
  }
}
