export interface GuardResult {
  safe: boolean;
  reason?: string;
}

export function checkDiffSafety(files: string[], linesChanged: number): GuardResult {
  const protectedFiles = [".env", "credentials.json"];
  for (const f of files) {
    if (protectedFiles.includes(f)) {
      return { safe: false, reason: `Modification of protected file: ${f}` };
    }
  }

  if (files.length > 5) {
    return { safe: false, reason: "Too many files modified (max: 5)" };
  }

  if (linesChanged > 100) {
    return { safe: false, reason: "Too many lines modified (max: 100)" };
  }

  return { safe: true };
}
