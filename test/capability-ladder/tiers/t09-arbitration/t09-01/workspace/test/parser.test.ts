import { expect, test, describe } from "bun:test";
import { parseTokens } from "../src/parser";

describe("Parser Arbitration", () => {
  test("parses non-empty tokens", () => {
    expect(parseTokens("a,b,c")).toEqual(["a", "b", "c"]);
  });

  test("returns empty array for empty or blank input", () => {
    expect(parseTokens("")).toEqual([]);
    expect(parseTokens("   ")).toEqual([]);
  });
});
