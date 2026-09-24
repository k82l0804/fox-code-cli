import { expect, test, describe } from "bun:test";
import { isValidEmail, isValidSlug, isValidPort } from "../src/validator";

describe("validators", () => {
  test("isValidEmail checks email format", () => {
    expect(isValidEmail("test@example.com")).toBe(true);
    expect(isValidEmail("invalid")).toBe(false);
  });

  test("isValidSlug accepts valid slugs", () => {
    expect(isValidSlug("hello-world")).toBe(true);
    expect(isValidSlug("page-123")).toBe(true);
    expect(isValidSlug("single")).toBe(true);
  });

  test("isValidSlug rejects malformed slugs", () => {
    expect(isValidSlug("-leading")).toBe(false);
    expect(isValidSlug("trailing-")).toBe(false);
    expect(isValidSlug("double--hyphen")).toBe(false);
    expect(isValidSlug("UpperCase")).toBe(false);
    expect(isValidSlug("has space")).toBe(false);
    expect(isValidSlug("")).toBe(false);
  });

  test("isValidPort checks port range", () => {
    expect(isValidPort(80)).toBe(true);
    expect(isValidPort(0)).toBe(false);
    expect(isValidPort(70000)).toBe(false);
  });
});
