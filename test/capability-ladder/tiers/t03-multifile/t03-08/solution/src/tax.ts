export function getTaxRate(country: string, isB2B: boolean = false): number {
  if (isB2B) return 0.0;
  if (country === "US") return 0.08;
  if (country === "CA") return 0.05;
  return 0.10;
}
