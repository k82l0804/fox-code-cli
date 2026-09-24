export function findCommonTags(listA: string[], listB: string[]): string[] {
  // BUG: O(N*M) quadratic scan using nested includes/loops
  const result: string[] = [];
  for (const item of listA) {
    if (listB.includes(item) && !result.includes(item)) {
      result.push(item);
    }
  }
  return result;
}
