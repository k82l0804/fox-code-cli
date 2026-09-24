import { expect, test, describe } from "bun:test";
import { hashPassword } from "../src/auth/service";

describe("hashPassword", () => {
  test("prepends hashed prefix", () => {
    expect(hashPassword("secret123")).toBe("hashed:secret123");
  });
});
