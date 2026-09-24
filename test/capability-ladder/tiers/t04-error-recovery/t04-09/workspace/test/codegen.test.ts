import { expect, test, describe } from "bun:test";
import { generateInterface } from "../src/codegen";

describe("interface code generation", () => {
  test("generates valid export interface with semicolons", () => {
    const code = generateInterface("UserProfile", [
      { name: "id", type: "string" },
      { name: "age", type: "number", optional: true },
      { name: "active", type: "boolean" },
    ]);

    expect(code).toBe([
      "export interface UserProfile {",
      "  id: string;",
      "  age?: number;",
      "  active: boolean;",
      "}",
    ].join("\n"));
  });
});
