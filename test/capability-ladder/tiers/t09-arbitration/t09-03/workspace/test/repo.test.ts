import { expect, test, describe } from "bun:test";
import { searchUsers } from "../src/repo";

describe("Repo Security Arbitration", () => {
  const mockDb = {
    query(sql: string, params?: any[]) {
      if (sql.includes("'")) {
        throw new Error("SECURITY VIOLATION: String interpolation detected in SQL!");
      }
      if (params && params[0] === "admin") {
        return [{ id: 1, name: "admin" }];
      }
      return [];
    },
  };

  test("searches safely using parameterization", () => {
    const res = searchUsers(mockDb, "admin");
    expect(res).toEqual([{ id: 1, name: "admin" }]);
  });

  test("handles injection string without throwing security violation", () => {
    expect(() => searchUsers(mockDb, "admin' OR 1=1--")).not.toThrow();
  });
});
