import { expect, test, describe } from "bun:test";
import { validateRegistration } from "../src/registration";

describe("validateRegistration", () => {
  const validUser = {
    username: "alice_99",
    email: "alice@example.com",
    password: "Password123!",
    age: 20
  };

  test("accepts completely valid user", () => {
    const res = validateRegistration(validUser);
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
  });

  test("accepts valid user without optional age", () => {
    const { age, ...withoutAge } = validUser;
    const res = validateRegistration(withoutAge);
    expect(res.valid).toBe(true);
  });

  test("validates username format and length", () => {
    const res = validateRegistration({ ...validUser, username: "ab" });
    expect(res.valid).toBe(false);
    expect(res.errors).toContain("Username must be 3-20 alphanumeric characters");

    const res2 = validateRegistration({ ...validUser, username: "invalid-char!" });
    expect(res2.valid).toBe(false);
    expect(res2.errors).toContain("Username must be 3-20 alphanumeric characters");
  });

  test("validates email format", () => {
    const res = validateRegistration({ ...validUser, email: "invalid-email" });
    expect(res.valid).toBe(false);
    expect(res.errors).toContain("Invalid email address format");
  });

  test("validates password length and complexity", () => {
    const res = validateRegistration({ ...validUser, password: "simple" });
    expect(res.valid).toBe(false);
    expect(res.errors).toContain("Password must be at least 8 characters with at least one number and special character");
  });

  test("validates minimum age threshold", () => {
    const res = validateRegistration({ ...validUser, age: 10 });
    expect(res.valid).toBe(false);
    expect(res.errors).toContain("User must be at least 13 years old");
  });
});
