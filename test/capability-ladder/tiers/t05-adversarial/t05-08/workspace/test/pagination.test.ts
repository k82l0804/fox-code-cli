import { expect, test, describe } from "bun:test";
import { paginate } from "../src/pagination";

describe("paginate", () => {
  const items = [1, 2, 3, 4, 5, 6, 7];

  test("paginates 1-indexed correctly", () => {
    const res = paginate(items, 1, 3);
    expect(res.data).toEqual([1, 2, 3]);
    expect(res.total).toBe(7);
    expect(res.totalPages).toBe(3);
    expect(res.page).toBe(1);
    expect(res.pageSize).toBe(3);
  });

  test("handles last page and out of bounds", () => {
    const last = paginate(items, 3, 3);
    expect(last.data).toEqual([7]);

    const oob = paginate(items, 4, 3);
    expect(oob.data).toEqual([]);
    expect(oob.totalPages).toBe(3);
  });
});
