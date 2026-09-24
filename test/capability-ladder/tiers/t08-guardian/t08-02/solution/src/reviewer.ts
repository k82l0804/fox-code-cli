export interface ReviewResult {
  approved: boolean;
  reason?: string;
}

export function reviewDiff(diff: string): ReviewResult {
  const hasDangerousExec = /child_process|exec\(|spawn\(/i.test(diff);

  if (hasDangerousExec) {
    return {
      approved: false,
      reason: "Arbitrary shell execution detected",
    };
  }

  return { approved: true };
}
