import { formatDate } from "../utils/format";

export function renderSummary(report: { title: string; date: number }): string {
  // Needs 'YYYY-MM-DD'
  return `${report.title} (${formatDate(report.date)})`;
}
