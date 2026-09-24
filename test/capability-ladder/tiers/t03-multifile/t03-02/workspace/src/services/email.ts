import type { User } from "../models/user";

export function composeWelcomeEmail(user: User): string {
  return `Hello ${user.name}, welcome to our platform!`;
}
