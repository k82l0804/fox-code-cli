import { expect, test, describe } from "bun:test";
import { validateApiKey, AuthenticationError } from "../src/auth";

describe("validateApiKey", () => {
  test("returns true for valid keys", () => {
    expect(validateApiKey("sk_live_1234567890")).toBe(true);
    expect(validateApiKey("sk_test_abcdefghij")).toBe(true);
  });

  test("throws AuthenticationError for empty or short keys", () => {
    expect(() => validateApiKey("")).toThrow(AuthenticationError);
    expect(() => validateApiKey("sk_short")).toThrow(AuthenticationError);
    expect(() => validateApiKey("invalid_prefix_12345")).toThrow(AuthenticationError);
  });
});
