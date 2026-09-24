import { defaultConfig, type ServerConfig } from "./config";
import type { RequestContext } from "./context";
import { RateLimiter } from "./rate-limiter";

export class ApiServer {
  private limiter?: RateLimiter;

  constructor(public config: ServerConfig = defaultConfig) {
    if (config.rateLimit) {
      this.limiter = new RateLimiter(
        config.rateLimit.maxRequests,
        config.rateLimit.windowMs
      );
    }
  }

  handleRequest(ctx: RequestContext): { status: number; body: string } {
    if (this.limiter && !this.limiter.isAllowed(ctx.clientIp)) {
      return { status: 429, body: "Too Many Requests" };
    }
    return { status: 200, body: `Success: ${ctx.path}` };
  }
}
