import { formatDate } from "../utils/format";

export function renderProfile(user: { name: string; joinedAt: number }): string {
  return `${user.name} joined on ${formatDate(user.joinedAt, "YYYY/MM/DD")}`;
}
