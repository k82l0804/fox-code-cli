export function parseJSONConfig(raw: string): any {
  let clean = raw;
  if (clean.charCodeAt(0) === 0xfeff) {
    clean = clean.slice(1);
  }
  return JSON.parse(clean);
}
