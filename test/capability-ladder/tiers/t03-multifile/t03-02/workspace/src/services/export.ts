import type { User } from "../models/user";

export function exportUserToCsv(user: User): string {
  return `${user.id},${user.name},${user.email}`;
}
