import { expect, test, describe, beforeEach } from "bun:test";
import { getPort } from "../src/app";

describe("Environment Config", () => {
  beforeEach(() => {
    delete process.env.PORT;
  });

  test("reads port dynamically from env after module load", () => {
    process.env.PORT = "8080";
    expect(getPort()).toBe(8080);

    process.env.PORT = "9000";
    expect(getPort()).toBe(9000);
  });

  test("falls back to default 3000 when PORT is unset", () => {
    expect(getPort()).toBe(3000);
  });
});
