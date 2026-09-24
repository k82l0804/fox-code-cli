import { expect, test, describe } from "bun:test";
import { UserApplication } from "../src/app";

describe("UserApplication", () => {
  test("executes without crashing inside framework dispatcher", () => {
    const app = new UserApplication();
    expect(app.execute()).toBe("[200] User payload");
  });
});
