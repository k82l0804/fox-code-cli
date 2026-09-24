/**
 * Parser — Converts raw CSV-like input into structured records.
 */

export interface ParsedRecord {
  id: string;
  name: string;
  metadata: {
    created: string;
    tags: string[];
  };
}

/**
 * Parse a raw input line into a structured record.
 *
 * Format: "id|name|created|tag1,tag2,tag3"
 */
export function parseRecord(line: string): ParsedRecord | null {
  const parts = line.split("|");
  if (parts.length < 4) return null;

  const [id, name, created, tagStr] = parts;

  // BUG: Returns object without the `metadata` property when tags are empty.
  // The formatter expects `record.metadata.tags` to always exist.
  if (!tagStr || tagStr.trim() === "") {
    return {
      id: id.trim(),
      name: name.trim(),
      // Missing `metadata` property — this causes the downstream TypeError
    } as ParsedRecord;  // unsafe cast hides the bug
  }

  return {
    id: id.trim(),
    name: name.trim(),
    metadata: {
      created: created.trim(),
      tags: tagStr.split(",").map((t) => t.trim()),
    },
  };
}

/**
 * Parse multiple lines.
 */
export function parseAll(input: string): ParsedRecord[] {
  return input
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map(parseRecord)
    .filter((r): r is ParsedRecord => r !== null);
}
