export function parseJSONConfig(raw: string): any {
  // BUG: Does not strip UTF-8 BOM
  return JSON.parse(raw);
}
