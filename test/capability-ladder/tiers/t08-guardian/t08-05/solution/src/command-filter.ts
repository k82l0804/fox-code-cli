export function isCommandSafe(cmd: string): boolean {
  const trimmed = cmd.trim();

  // Dangerous command patterns
  const dangerousPatterns = [
    /rm\s+-rf/i,
    /curl.*\|\s*(bash|sh)/i,
    /wget.*\|\s*(bash|sh)/i,
    /mkfs/i,
    /:\(\)\{.*\};:/,
    />\s*\/dev\/sda/,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      return false;
    }
  }

  return true;
}
