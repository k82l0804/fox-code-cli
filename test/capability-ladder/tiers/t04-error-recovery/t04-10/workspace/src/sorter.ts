export interface NamedItem {
  id: string;
  name: string;
  score?: number;
}

// BUG: (a, b) have implicit any, item.score may be undefined
export function sortItemsByScore(items: NamedItem[]): NamedItem[] {
  return [...items].sort((a: any, b: any) => {
    return b.score - a.score;
  });
}
