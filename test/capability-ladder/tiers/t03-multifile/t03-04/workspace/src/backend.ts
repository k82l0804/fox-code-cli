export interface Context {
  user?: string;
  trace: string[];
  response?: string;
}

export async function executeBackend(ctx: Context): Promise<void> {
  ctx.trace.push("backend");
  ctx.response = `Handled for ${ctx.user ?? "anonymous"}`;
}
