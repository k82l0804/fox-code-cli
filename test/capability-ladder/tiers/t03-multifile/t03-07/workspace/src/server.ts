import { defaultConfig, type ServerConfig } from "./config";
import type { RequestContext } from "./context";

export class ApiServer {
  constructor(public config: ServerConfig = defaultConfig) {}

  handleRequest(ctx: RequestContext): { status: number; body: string } {
    return { status: 200, body: `Success: ${ctx.path}` };
  }
}
