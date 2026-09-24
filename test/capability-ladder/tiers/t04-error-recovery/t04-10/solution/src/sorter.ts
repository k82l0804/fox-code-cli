export interface NamedItem {
  id: string;
  name: string;
  score?: number;
}

export function sortItemsByScore(items: NamedItem[]): NamedItem[] {
  return [...items].sort((a: NamedItem, b: NamedItem) => {
    const scoreA = a.score ?? -Infinity;
    const scoreB = b.score ?? -Infinity;
    return scoreB - scoreA;
  });
}
