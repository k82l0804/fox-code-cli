// Candidate A: Simple comparator fix
export function sortDescending(nums: number[]): number[] {
  return [...nums].sort((a, b) => b - a);
}
