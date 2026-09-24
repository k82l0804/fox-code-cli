import { formatDate } from "../utils/format";

export function renderAudit(entry: { message: string; timestamp: number }): string {
  // Needs 'YYYY-MM-DD HH:mm:ss'
  return `${formatDate(entry.timestamp)} - ${entry.message}`;
}
