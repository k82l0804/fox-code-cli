import { expect, test, describe } from "bun:test";
import { processInput } from "../src/pipeline";
import { parseRecord, parseAll } from "../src/parser";

describe("Pipeline", () => {
  test("processes records with tags", () => {
    const input = "1|Alice|2024-01-01|admin,user";
    const result = processInput(input);
    expect(result).toContain("[1] Alice");
    expect(result).toContain("admin, user");
  });

  test("processes records without tags", () => {
    // This is the failing test — records with empty tags should still work
    const input = "2|Bob|2024-01-02|";
    const result = processInput(input);
    expect(result).toContain("[2] Bob");
    expect(result).toContain("(tags: )");
  });

  test("processes mixed records", () => {
    const input = [
      "1|Alice|2024-01-01|admin,user",
      "2|Bob|2024-01-02|",
      "3|Charlie|2024-01-03|viewer",
    ].join("\n");
    const result = processInput(input);
    expect(result).toContain("3 records");
    expect(result).toContain("[1] Alice");
    expect(result).toContain("[2] Bob");
    expect(result).toContain("[3] Charlie");
  });
});

describe("Parser", () => {
  test("parses record with tags", () => {
    const record = parseRecord("1|Alice|2024-01-01|admin,user");
    expect(record).not.toBeNull();
    expect(record!.id).toBe("1");
    expect(record!.name).toBe("Alice");
    expect(record!.metadata).toBeDefined();
    expect(record!.metadata.tags).toEqual(["admin", "user"]);
  });

  test("parses record without tags — metadata must still exist", () => {
    const record = parseRecord("2|Bob|2024-01-02|");
    expect(record).not.toBeNull();
    expect(record!.id).toBe("2");
    expect(record!.name).toBe("Bob");
    expect(record!.metadata).toBeDefined();
    expect(record!.metadata.created).toBe("2024-01-02");
    expect(record!.metadata.tags).toEqual([]);
  });

  test("returns null for malformed input", () => {
    expect(parseRecord("bad")).toBeNull();
    expect(parseRecord("only|two")).toBeNull();
  });
});
