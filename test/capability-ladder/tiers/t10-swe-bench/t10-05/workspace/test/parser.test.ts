import { expect, test, describe } from "bun:test";
import { parseJSONConfig } from "../src/parser";

describe("JSON Parser BOM Support", () => {
  test("parses standard JSON", () => {
    expect(parseJSONConfig('{"name":"test"}')).toEqual({ name: "test" });
  });

  test("parses JSON with UTF-8 BOM prefix", () => {
    const withBOM = "\uFEFF" + '{"active":true,"count":10}';
    expect(parseJSONConfig(withBOM)).toEqual({ active: true, count: 10 });
  });
});
