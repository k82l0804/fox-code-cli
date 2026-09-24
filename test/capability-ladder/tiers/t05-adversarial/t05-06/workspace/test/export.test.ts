import { expect, test, describe } from "bun:test";
import { formatCSVHeader } from "../src/export";

describe("formatCSVHeader", () => {
  test("joins headers with commas", () => {
    expect(formatCSVHeader(["id", "name", "email"])).toBe("id,name,email");
  });
});
