import { expect, test, describe } from "bun:test";
import { formatUser } from "../src/formatter";
import { renderA } from "../src/consumers/consumerA";
import { renderB } from "../src/consumers/consumerB";

describe("Backwards Compatibility", () => {
  test("legacy consumers work without modification", () => {
    expect(renderA()).toBe("User: Alice");
    expect(renderB()).toBe("Member: Bob");
  });

  test("new options object call works", () => {
    expect((formatUser as any)("charlie", { uppercase: true, prefix: "Admin" })).toBe("Admin: CHARLIE");
  });
});
