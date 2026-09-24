import { expect, test, describe } from "bun:test";
import { sanitizeInput } from "../src/sanitizer";

describe("Sanitizer", () => {
  test("escapes HTML tags", () => {
    expect(sanitizeInput("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});
