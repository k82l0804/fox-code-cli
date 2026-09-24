export function containsAll(haystack: string[], needles: string[]): boolean {
  const set = new Set(haystack);
  for (const needle of needles) {
    if (!set.has(needle)) return false;
  }
  return true;
}
