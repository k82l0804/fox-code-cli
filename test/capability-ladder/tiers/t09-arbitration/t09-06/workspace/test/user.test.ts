import { expect, test, describe } from "bun:test";
import { parseUserProfile } from "../src/user";

describe("User Profile Arbitration", () => {
  test("validates profile payload strictly", () => {
    const profile = parseUserProfile({ id: "1", name: "Alice", email: "alice@test.com" });
    expect(profile.id).toBe("1");
    expect(profile.name).toBe("Alice");
  });

  test("throws on invalid profile data", () => {
    expect(() => parseUserProfile(null)).toThrow();
    expect(() => parseUserProfile({ id: 123 })).toThrow();
  });
});
