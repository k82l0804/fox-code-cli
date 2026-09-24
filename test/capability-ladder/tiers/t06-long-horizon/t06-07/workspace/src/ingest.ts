export function ingestRawLines(raw: string): string[] {
  // BUG: Does not filter empty lines, leaving empty string tokens
  return raw.split("\n");
}
