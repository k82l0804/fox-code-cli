export function aggregateTokens(tokens: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const token of tokens) {
    // BUG: drops valid keys if they have leading/trailing spaces
    if (token === "") continue;
    counts[token] = (counts[token] || 0) + 1;
  }
  return counts;
}
