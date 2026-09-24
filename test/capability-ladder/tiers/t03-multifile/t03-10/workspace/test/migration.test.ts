import { expect, test, describe, spyOn } from "bun:test";
import { fetchUser } from "../src/modern";
import { legacyFetchUserAdapter } from "../src/adapter";
import { fetchUserLegacy } from "../src/legacy";

describe("API migration and deprecation adapter", () => {
  test("modern API returns Promise resolving data", async () => {
    const user = await fetchUser("42");
    expect(user).toEqual({ id: "42", name: "User-42" });
  });

  test("modern API rejects on empty ID", async () => {
    expect(fetchUser("")).rejects.toThrow("Missing ID");
  });

  test("legacy adapter emits deprecation warning and delegates to callback", (done) => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    try {
      legacyFetchUserAdapter("10", (err, res) => {
        expect(err).toBeNull();
        expect(res).toEqual({ id: "10", name: "User-10" });
        expect(warnings.some((w) => w.includes("DEPRECATION WARNING"))).toBe(true);
        done();
      });
    } finally {
      console.warn = originalWarn;
    }
  });

  test("legacy export delegates to adapter", (done) => {
    fetchUserLegacy("99", (err, res) => {
      expect(err).toBeNull();
      expect(res).toEqual({ id: "99", name: "User-99" });
      done();
    });
  });
});
