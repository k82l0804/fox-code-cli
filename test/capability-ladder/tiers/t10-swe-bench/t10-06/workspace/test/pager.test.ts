import { expect, test, describe } from "bun:test";
import { paginateByCursor, Item } from "../src/pager";

describe("Cursor Pagination", () => {
  const dataset: Item[] = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

  test("pages sequentially without duplicates", () => {
    // Page 1: items 1, 2
    const p1 = paginateByCursor(dataset, null, 2);
    expect(p1.items.map((i) => i.id)).toEqual([1, 2]);
    expect(p1.nextCursor).toBe(2);

    // Page 2: items 3, 4
    const p2 = paginateByCursor(dataset, p1.nextCursor, 2);
    expect(p2.items.map((i) => i.id)).toEqual([3, 4]);
    expect(p2.nextCursor).toBe(4);

    // Page 3: item 5
    const p3 = paginateByCursor(dataset, p2.nextCursor, 2);
    expect(p3.items.map((i) => i.id)).toEqual([5]);
    expect(p3.nextCursor).toBeNull();
  });
});
