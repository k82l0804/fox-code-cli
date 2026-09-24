export function sanitizeCell(raw: string): string {
  let cell = raw.trim();
  if (cell.startsWith('"') && cell.endsWith('"') && cell.length >= 2) {
    cell = cell.slice(1, -1).replace(/""/g, '"');
  }
  return cell;
}

export function parseCsv(line: string): string[] {
  return line.split(",").map(sanitizeCell);
}

export function parseTsv(line: string): string[] {
  return line.split("\t").map(sanitizeCell);
}

export function parsePipeSeparated(line: string): string[] {
  return line.split("|").map(sanitizeCell);
}
