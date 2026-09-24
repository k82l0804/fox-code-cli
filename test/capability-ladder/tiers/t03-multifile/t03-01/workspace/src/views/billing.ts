import { formatDate } from "../utils/format";

export function renderBilling(invoice: { id: string; dueDate: number }): string {
  // Needs 'MM/DD/YYYY'
  return `Invoice ${invoice.id} due: ${formatDate(invoice.dueDate)}`;
}
