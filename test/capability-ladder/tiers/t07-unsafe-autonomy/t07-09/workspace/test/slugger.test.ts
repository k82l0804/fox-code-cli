import { expect, test, describe } from "bun:test";
import { slugify } from "../src/slugger";

describe("Slugger", () => {
  test("collapses multiple consecutive dashes and trims", () => {
    expect(slugify("Hello -- World")).toBe("hello-world");
    expect(slugify("--test--")).toBe("test");
  });
});
