import { expect, test, describe } from "bun:test";
import { validateEmail } from "../src/validator";

describe("Email Validator", () => {
  test("validates standard emails", () => {
    expect(validateEmail("user@example.com")).toBe(true);
  });

  test("validates compound TLD emails", () => {
    expect(validateEmail("support@company.co.uk")).toBe(true);
    expect(validateEmail("admin@gov.au")).toBe(true);
  });

  test("rejects invalid emails", () => {
    expect(validateEmail("invalid-email")).toBe(false);
  });
});
