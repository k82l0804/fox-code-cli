import { formatDate } from "../utils/format";

export function renderAudit(entry: { message: string; timestamp: number }): string {
  return `${formatDate(entry.timestamp, "YYYY-MM-DD HH:mm:ss")} - ${entry.message}`;
}
