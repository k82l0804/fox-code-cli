export function containsAll(haystack: string[], needles: string[]): boolean {
  for (const needle of needles) {
    if (!haystack.includes(needle)) return false;
  }
  return true;
}
