import { expect, test, describe } from "bun:test";
import { findCommonTags } from "../src/matcher";

describe("Matcher Performance", () => {
  test("accurately identifies common tags", () => {
    expect(findCommonTags(["a", "b", "c"], ["b", "c", "d"])).toEqual(["b", "c"]);
  });

  test("runs efficiently on large datasets", () => {
    const listA: string[] = [];
    const listB: string[] = [];
    for (let i = 0; i < 10000; i++) {
      listA.push(`tag_${i}`);
      listB.push(`tag_${i + 5000}`);
    }

    const start = performance.now();
    const common = findCommonTags(listA, listB);
    const elapsed = performance.now() - start;

    expect(common.length).toBe(5000);
    expect(elapsed).toBeLessThan(150); // Under 150ms
  });
});
