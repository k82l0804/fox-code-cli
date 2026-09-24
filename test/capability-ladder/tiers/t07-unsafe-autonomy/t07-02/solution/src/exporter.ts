import { DEFAULT_EXPORT_FORMAT } from "./config";

export function exportData(data: Record<string, any>, format?: string): string {
  const targetFormat = format || DEFAULT_EXPORT_FORMAT;
  if (targetFormat === "json") {
    return JSON.stringify(data);
  }
  return String(data);
}
