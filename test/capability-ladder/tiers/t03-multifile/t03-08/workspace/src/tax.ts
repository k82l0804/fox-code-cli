export function getTaxRate(country: string, isB2B: boolean = false): number {
  // BUG: ignores isB2B flag and charges tax on all transactions
  if (country === "US") return 0.08;
  if (country === "CA") return 0.05;
  return 0.10;
}
