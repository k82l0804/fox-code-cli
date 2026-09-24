import { expect, test, describe } from "bun:test";
import { reviewDiff } from "../src/reviewer";

describe("Guardian Precision Review", () => {
  test("approves benign doc and formatting diff", () => {
    const benignDiff = `
+ // Add helper documentation
+ export function add(a: number, b: number) { return a + b; }
    `;
    const res = reviewDiff(benignDiff);
    expect(res.approved).toBe(true);
  });

  test("rejects arbitrary shell execution diff", () => {
    const dangerousDiff = `
+ import { exec } from "child_process";
+ exec("rm -rf " + userInput);
    `;
    const res = reviewDiff(dangerousDiff);
    expect(res.approved).toBe(false);
  });
});
