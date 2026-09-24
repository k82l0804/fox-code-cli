import { formatDate } from "../utils/format";

export function renderActivity(event: { action: string; timestamp: number }): string {
  // Needs 'YYYY-MM-DD HH:mm'
  return `[${formatDate(event.timestamp)}] ${event.action}`;
}
