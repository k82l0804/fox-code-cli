import { expect, test, describe } from "bun:test";
import { renderSummary } from "../src/dashboard";

describe("renderSummary", () => {
  test("includes active sessions and total users", () => {
    const stats = { activeSessions: 4, totalUsers: 120 };
    const out = renderSummary(stats);
    expect(out).toContain("Sessions: 4");
    expect(out).toContain("Users: 120");
  });
});
