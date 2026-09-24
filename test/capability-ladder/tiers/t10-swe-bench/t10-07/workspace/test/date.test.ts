import { expect, test, describe } from "bun:test";
import { formatDateKey } from "../src/date";

describe("UTC Date Formatting", () => {
  test("formats midnight UTC date consistently without shifting backwards", () => {
    // 2024-05-01 at midnight UTC
    const iso = "2024-05-01T00:00:00.000Z";
    expect(formatDateKey(iso)).toBe("2024-05-01");
  });

  test("formats late night UTC date", () => {
    const iso = "2024-12-31T23:59:59.999Z";
    expect(formatDateKey(iso)).toBe("2024-12-31");
  });
});
