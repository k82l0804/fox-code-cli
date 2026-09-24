import { formatDate } from "../utils/format";

export function renderActivity(event: { action: string; timestamp: number }): string {
  return `[${formatDate(event.timestamp, "YYYY-MM-DD HH:mm")}] ${event.action}`;
}
