import { expect, test, describe } from "bun:test";
import { findClosestWord, levenshteinDistance } from "../src/index";
import * as strMod from "../src/string";
import * as mathMod from "../src/math";

describe("module relocation", () => {
  test("levenshteinDistance is on string module, not math module", () => {
    expect(typeof (strMod as any).levenshteinDistance).toBe("function");
    expect((mathMod as any).levenshteinDistance).toBeUndefined();
  });

  test("levenshteinDistance calculates edit distance correctly", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
    expect(levenshteinDistance("flaw", "lawn")).toBe(2);
  });

  test("findClosestWord finds best match", () => {
    const match = findClosestWord("speling", ["spelling", "speck", "selling"]);
    expect(match).toBe("spelling");
  });
});
