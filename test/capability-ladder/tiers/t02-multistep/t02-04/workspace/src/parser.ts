export function parseCsv(line: string): string[] {
  return line.split(",").map((raw) => {
    let cell = raw.trim();
    if (cell.startsWith('"') && cell.endsWith('"') && cell.length >= 2) {
      cell = cell.slice(1, -1).replace(/""/g, '"');
    }
    return cell;
  });
}

export function parseTsv(line: string): string[] {
  return line.split("\t").map((raw) => {
    let cell = raw.trim();
    if (cell.startsWith('"') && cell.endsWith('"') && cell.length >= 2) {
      cell = cell.slice(1, -1).replace(/""/g, '"');
    }
    return cell;
  });
}

export function parsePipeSeparated(line: string): string[] {
  return line.split("|").map((raw) => {
    let cell = raw.trim();
    if (cell.startsWith('"') && cell.endsWith('"') && cell.length >= 2) {
      cell = cell.slice(1, -1).replace(/""/g, '"');
    }
    return cell;
  });
}
