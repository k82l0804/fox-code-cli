/**
 * Formatter — Converts parsed records into display strings.
 *
 * NOTE: This file is correct. The error that appears to come from here
 * is actually caused by parser.ts returning incomplete records.
 */

import type { ParsedRecord } from "./parser";

/**
 * Format a single record for display.
 * Assumes record has all required fields including metadata.
 */
export function formatRecord(record: ParsedRecord): string {
  const tags = record.metadata.tags.join(", ");  // TypeError thrown here when metadata is undefined
  return `[${record.id}] ${record.name} (tags: ${tags})`;
}

/**
 * Format all records into a report.
 */
export function formatReport(records: ParsedRecord[]): string {
  const header = `=== Record Report (${records.length} records) ===`;
  const body = records.map(formatRecord).join("\n");
  const footer = `=== End Report ===`;
  return [header, body, footer].join("\n");
}
