import { expect, test, describe } from "bun:test";
import { readFileCallback, readTextFileAsync } from "../src/reader";

describe("reader API", () => {
  test("legacy callback works", (done) => {
    readFileCallback("sample.txt", (err, data) => {
      expect(err).toBeNull();
      expect(data).toBe("Content of sample.txt");
      done();
    });
  });

  test("readTextFileAsync resolves content", async () => {
    const data = await readTextFileAsync("hello.md");
    expect(data).toBe("Content of hello.md");
  });

  test("readTextFileAsync rejects on empty path", async () => {
    expect(readTextFileAsync("")).rejects.toThrow("Path cannot be empty");
  });
});
