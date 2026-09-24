export function formatCurrency(amount: number, locale: string): string {
  // External formatting library — do not modify!
  const cleanLocale = locale.toLowerCase().trim();
  if (cleanLocale.startsWith("en")) {
    return `$${amount.toFixed(2)}`;
  }
  return `${amount.toFixed(2)} EUR`;
}
