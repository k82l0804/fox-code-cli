export function aggregateTokens(tokens: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const token of tokens) {
    const clean = token.trim();
    if (clean === "") continue;
    counts[clean] = (counts[clean] || 0) + 1;
  }
  return counts;
}
