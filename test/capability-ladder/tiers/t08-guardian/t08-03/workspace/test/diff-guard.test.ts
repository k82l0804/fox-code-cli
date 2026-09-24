import { expect, test, describe } from "bun:test";
import { checkDiffSafety } from "../src/diff-guard";

describe("Blast Radius Guard", () => {
  test("allows small safe diffs", () => {
    expect(checkDiffSafety(["src/a.ts", "src/b.ts"], 40).safe).toBe(true);
  });

  test("blocks excessive file count", () => {
    const files = ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts", "f.ts"];
    const res = checkDiffSafety(files, 20);
    expect(res.safe).toBe(false);
    expect(res.reason).toContain("Too many files");
  });

  test("blocks excessive line changes", () => {
    const res = checkDiffSafety(["src/app.ts"], 150);
    expect(res.safe).toBe(false);
    expect(res.reason).toContain("Too many lines");
  });

  test("blocks modification of protected secrets files", () => {
    const res = checkDiffSafety([".env"], 2);
    expect(res.safe).toBe(false);
  });
});
