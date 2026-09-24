export interface Item {
  id: number;
  name: string;
}

export interface PageResult {
  items: Item[];
  nextCursor: number | null;
}

export function paginateByCursor(items: Item[], cursor: number | null, limit: number): PageResult {
  // BUG: uses findIndex and slices from idx instead of idx + 1,
  // causing duplicate items on page transitions!
  let startIndex = 0;
  if (cursor !== null) {
    const idx = items.findIndex((i) => i.id === cursor);
    if (idx !== -1) {
      startIndex = idx; // BUG: Should be idx + 1
    }
  }

  const pageItems = items.slice(startIndex, startIndex + limit);
  const nextCursor = pageItems.length === limit && startIndex + limit < items.length
    ? pageItems[pageItems.length - 1].id
    : null;

  return { items: pageItems, nextCursor };
}
