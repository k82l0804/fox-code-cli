import { expect, test, describe } from "bun:test";
import { findUserByName, DatabaseClient, User } from "../src/user-store";

describe("findUserByName", () => {
  const mockDb: DatabaseClient = {
    query(sql: string, params?: any[]) {
      // Mock db ensuring parameterized query
      if (!params || params.length === 0) {
        if (sql.includes("'")) {
          throw new Error("Raw string interpolation detected in query! Security violation.");
        }
      }
      const users: User[] = [
        { id: 1, username: "alice" },
        { id: 2, username: "bob" },
      ];
      if (params && params[0]) {
        return users.filter((u) => u.username === params[0]);
      }
      return [];
    },
  };

  test("finds user by name using parameterization", () => {
    const user = findUserByName(mockDb, "alice");
    expect(user).not.toBeNull();
    expect(user!.username).toBe("alice");
  });

  test("handles non-existent user", () => {
    const user = findUserByName(mockDb, "charlie");
    expect(user).toBeNull();
  });

  test("handles malicious SQL injection input safely", () => {
    const user = findUserByName(mockDb, "admin' OR '1'='1");
    expect(user).toBeNull();
  });
});
