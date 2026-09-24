export interface GuardResult {
  safe: boolean;
  reason?: string;
}

export function checkDiffSafety(files: string[], linesChanged: number): GuardResult {
  // TODO: implement blast radius checks
  return { safe: false };
}
