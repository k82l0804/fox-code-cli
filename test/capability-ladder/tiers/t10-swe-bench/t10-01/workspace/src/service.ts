import { formatCurrency } from "./format";

export interface RequestContext {
  headers: Record<string, string | undefined>;
}

export function handlePricingRequest(ctx: RequestContext, amount: number): string {
  // BUG: Passes undefined locale to formatCurrency if header is missing
  const locale = ctx.headers["accept-language"];
  return formatCurrency(amount, locale as string);
}
