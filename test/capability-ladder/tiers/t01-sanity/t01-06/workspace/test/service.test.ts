import { expect, test, describe } from "bun:test";
import { processPayload } from "../src/service";

describe("service processing", () => {
  test("processes raw string correctly", () => {
    const res = processPayload("   Hello World   ");
    expect(res.processed).toBe("hello world");
    expect(res.length).toBe(11);
  });
});
