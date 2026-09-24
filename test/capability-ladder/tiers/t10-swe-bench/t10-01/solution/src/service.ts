import { formatCurrency } from "./format";

export interface RequestContext {
  headers: Record<string, string | undefined>;
}

export function handlePricingRequest(ctx: RequestContext, amount: number): string {
  const locale = ctx.headers["accept-language"] || "en-US";
  return formatCurrency(amount, locale);
}
