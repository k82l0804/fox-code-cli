import { formatDate } from "../utils/format";

export function renderBilling(invoice: { id: string; dueDate: number }): string {
  return `Invoice ${invoice.id} due: ${formatDate(invoice.dueDate, "MM/DD/YYYY")}`;
}
