import { expect, test, describe } from "bun:test";
import { migrateData } from "../src/migrator";

describe("Plan Selection Arbitration", () => {
  test("migrates additively without dropping existing fields", () => {
    const input = [{ first: "Jane", last: "Doe", id: 1 }];
    const output = migrateData(input);

    expect(output[0].first).toBe("Jane");
    expect(output[0].last).toBe("Doe");
    expect(output[0].displayName).toBe("Jane Doe");
  });
});
