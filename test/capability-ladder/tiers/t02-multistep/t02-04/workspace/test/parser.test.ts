import { expect, test, describe } from "bun:test";
import { parseCsv, parseTsv, parsePipeSeparated } from "../src/parser";

describe("table parsers", () => {
  test("parseCsv splits and unescapes quotes", () => {
    expect(parseCsv('Alice, "Bob", "Charlie \"\"Chuck\""')).toEqual(["Alice", "Bob", 'Charlie "Chuck"']);
  });

  test("parseTsv splits tab values", () => {
    expect(parseTsv('1\t "Item"\t 99.9')).toEqual(["1", "Item", "99.9"]);
  });

  test("parsePipeSeparated splits pipes", () => {
    expect(parsePipeSeparated('A | "B" | C')).toEqual(["A", "B", "C"]);
  });

  test("sanitizeCell function is exported and works", async () => {
    const mod = await import("../src/parser");
    expect(typeof (mod as any).sanitizeCell).toBe("function");
    expect((mod as any).sanitizeCell('  "quoted text"  ')).toBe("quoted text");
    expect((mod as any).sanitizeCell(' "escaped \"\"quotes\"" ')).toBe('escaped "quotes"');
  });
});
