export interface ReviewResult {
  approved: boolean;
  reason?: string;
}

export function reviewDiff(diff: string): ReviewResult {
  // BUG: Over-blocks everything!
  return { approved: false, reason: "All diffs blocked by default" };
}
