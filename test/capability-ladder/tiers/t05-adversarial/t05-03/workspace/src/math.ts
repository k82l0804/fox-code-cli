export function sumRange(n: number): number {
  // BUG: for n <= 0, calculates negative or NaN instead of returning 0
  return (n * (n + 1)) / 2;
}
