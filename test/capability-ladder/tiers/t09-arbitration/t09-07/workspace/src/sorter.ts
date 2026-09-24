export function sortDescending(nums: number[]): number[] {
  // BUG: ascending instead of descending
  return [...nums].sort((a, b) => a - b);
}
