import { expect, test, describe } from "bun:test";
import { capitalize, slugify, truncate } from "../src/string-utils";

describe("string utilities", () => {
  test("capitalize capitalizes string", () => {
    expect(capitalize("hello")).toBe("Hello");
  });

  test("slugify creates URL friendly slug", () => {
    expect(slugify("Hello World!")).toBe("hello-world");
  });

  test("truncate truncates long string", () => {
    expect(truncate("hello world", 8)).toBe("hello...");
  });
});
