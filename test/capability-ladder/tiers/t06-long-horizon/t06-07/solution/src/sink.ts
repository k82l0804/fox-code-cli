export function formatSummary(counts: Record<string, number>): string {
  const keys = Object.keys(counts);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return JSON.stringify({ keys, totalCount: total });
}
