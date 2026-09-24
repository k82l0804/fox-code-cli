export function exportData(data: Record<string, any>, format?: string): string {
  // BUG: Throws error when format is undefined instead of checking config default
  if (!format) {
    throw new Error("Missing format");
  }
  if (format === "json") {
    return JSON.stringify(data);
  }
  return String(data);
}
