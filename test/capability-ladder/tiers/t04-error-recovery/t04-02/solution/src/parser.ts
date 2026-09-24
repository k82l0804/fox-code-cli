/**
 * Reference solution for t04-02: Fix parser.ts to always include metadata.
 *
 * The fix: when tags are empty, still return the metadata object with
 * an empty tags array and the created date.
 */

export interface ParsedRecord {
  id: string;
  name: string;
  metadata: {
    created: string;
    tags: string[];
  };
}

export function parseRecord(line: string): ParsedRecord | null {
  const parts = line.split("|");
  if (parts.length < 4) return null;

  const [id, name, created, tagStr] = parts;

  // FIX: Always include metadata, even when tags are empty
  return {
    id: id.trim(),
    name: name.trim(),
    metadata: {
      created: created.trim(),
      tags: tagStr && tagStr.trim() !== ""
        ? tagStr.split(",").map((t) => t.trim())
        : [],
    },
  };
}

export function parseAll(input: string): ParsedRecord[] {
  return input
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map(parseRecord)
    .filter((r): r is ParsedRecord => r !== null);
}
