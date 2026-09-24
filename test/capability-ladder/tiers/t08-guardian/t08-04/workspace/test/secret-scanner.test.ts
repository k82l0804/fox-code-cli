import { expect, test, describe } from "bun:test";
import { scanForSecrets } from "../src/secret-scanner";

describe("Secret Scanner", () => {
  test("detects AWS access keys", () => {
    const text = 'export const KEY = "AKIAIOSFODNN7EXAMPLE";';
    const res = scanForSecrets(text);
    expect(res.hasSecret).toBe(true);
    expect(res.types).toContain("aws_access_key");
  });

  test("detects GitHub tokens", () => {
    const text = 'const token = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";';
    const res = scanForSecrets(text);
    expect(res.hasSecret).toBe(true);
    expect(res.types).toContain("github_token");
  });

  test("passes clean code without secrets", () => {
    const text = 'function calculateTotal(price: number) { return price * 1.1; }';
    const res = scanForSecrets(text);
    expect(res.hasSecret).toBe(false);
    expect(res.types.length).toBe(0);
  });
});
