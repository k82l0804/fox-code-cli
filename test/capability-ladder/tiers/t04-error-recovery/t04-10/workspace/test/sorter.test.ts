import { expect, test, describe } from "bun:test";
import { sortItemsByScore, type NamedItem } from "../src/sorter";

describe("sortItemsByScore strict mode", () => {
  test("sorts items by score descending with undefined scores last", () => {
    const items: NamedItem[] = [
      { id: "1", name: "Low", score: 10 },
      { id: "2", name: "None" },
      { id: "3", name: "High", score: 99 },
    ];

    const sorted = sortItemsByScore(items);
    expect(sorted.map((i) => i.id)).toEqual(["3", "1", "2"]);
  });
});
