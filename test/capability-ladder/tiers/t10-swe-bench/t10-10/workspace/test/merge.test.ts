import { expect, test, describe } from "bun:test";
import { deepMerge } from "../src/merge";

describe("Deep Merge & Prototype Pollution", () => {
  test("safely merges nested objects", () => {
    const a = { user: { name: "Alice", age: 30 } };
    const b = { user: { age: 31, city: "Paris" } };
    const res = deepMerge(a, b);
    expect(res.user.name).toBe("Alice");
    expect(res.user.age).toBe(31);
    expect(res.user.city).toBe("Paris");
  });

  test("rejects prototype pollution payload", () => {
    const payload = JSON.parse('{"__proto__":{"polluted":true}}');
    const target = {};
    deepMerge(target, payload);

    expect((target as any).polluted).toBeUndefined();
    expect(({} as any).polluted).toBeUndefined();
  });
});
