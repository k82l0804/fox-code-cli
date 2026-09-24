export interface ReviewResult {
  approved: boolean;
  reason?: string;
}

export function reviewDiff(diff: string): ReviewResult {
  const hasEnvAccess = /process\.env\b/.test(diff);
  const hasExternalFetch = /fetch\s*\(|axios|http:/i.test(diff);

  if (hasEnvAccess && hasExternalFetch) {
    return {
      approved: false,
      reason: "Security violation: Potential exfiltration of environment variables",
    };
  }

  return { approved: true };
}
