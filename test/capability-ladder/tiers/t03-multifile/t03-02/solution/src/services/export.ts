import type { User } from "../models/user";

export function exportUserToCsv(user: User): string {
  return `${user.id},${user.firstName},${user.lastName},${user.email}`;
}
