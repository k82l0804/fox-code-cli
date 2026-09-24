// Candidate B: Claimed "Enterprise Fast Sort" (BUG: fails on negative numbers!)
export function sortDescending(nums: number[]): number[] {
  return [...nums].sort((a, b) => Math.abs(b) - Math.abs(a));
}
