import { formatDate } from "../utils/format";

export function renderProfile(user: { name: string; joinedAt: number }): string {
  // Needs 'YYYY/MM/DD'
  return `${user.name} joined on ${formatDate(user.joinedAt)}`;
}
