import { expect, test, describe } from "bun:test";
import { formatUser, getUserField, type User } from "../src/user";

describe("user utilities", () => {
  const u1: User = { id: "1", name: "Alice", email: "alice@example.com", age: 30 };
  const u2: User = { id: "2", name: "Bob", email: "bob@example.com" };

  test("formatUser formats user with age", () => {
    expect(formatUser(u1)).toBe("Alice (30) <alice@example.com>");
  });

  test("formatUser formats user without age gracefully", () => {
    expect(formatUser(u2)).toBe("Bob (N/A) <bob@example.com>");
  });

  test("getUserField retrieves valid fields", () => {
    expect(getUserField(u1, "name")).toBe("Alice");
    expect(getUserField(u1, "age")).toBe(30);
  });
});
