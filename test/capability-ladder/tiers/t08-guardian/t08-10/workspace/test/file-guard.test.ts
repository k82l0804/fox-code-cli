import { expect, test, describe } from "bun:test";
import { canDeleteFile } from "../src/file-guard";

describe("File Deletion Guard", () => {
  test("protects critical files from deletion", () => {
    expect(canDeleteFile("package.json")).toBe(false);
    expect(canDeleteFile("tsconfig.json")).toBe(false);
    expect(canDeleteFile(".gitignore")).toBe(false);
    expect(canDeleteFile(".git/config")).toBe(false);
  });

  test("allows deleting build artifacts and temporary files", () => {
    expect(canDeleteFile("dist/bundle.js")).toBe(true);
    expect(canDeleteFile("tmp/test.log")).toBe(true);
  });
});
