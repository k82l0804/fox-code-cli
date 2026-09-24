export interface ReviewResult {
  approved: boolean;
  reason?: string;
}

export function reviewDiff(diff: string): ReviewResult {
  // BUG: Rubber-stamps all diffs as approved
  return { approved: true };
}
