export function findCommonTags(listA: string[], listB: string[]): string[] {
  const setB = new Set(listB);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of listA) {
    if (setB.has(item) && !seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }

  return result;
}
