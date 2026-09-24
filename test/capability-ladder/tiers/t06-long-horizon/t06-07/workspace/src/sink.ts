export function formatSummary(counts: Record<string, number>): string {
  const keys = Object.keys(counts);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // BUG: if total is 0, omits totalCount property
  if (!total) {
    return JSON.stringify({ keys });
  }

  return JSON.stringify({ keys, totalCount: total });
}
