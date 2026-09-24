import { formatDate } from "../utils/format";

export function renderSummary(report: { title: string; date: number }): string {
  return `${report.title} (${formatDate(report.date, "YYYY-MM-DD")})`;
}
