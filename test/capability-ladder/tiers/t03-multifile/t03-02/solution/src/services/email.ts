import { type User, getFullName } from "../models/user";

export function composeWelcomeEmail(user: User): string {
  return `Hello ${getFullName(user)}, welcome to our platform!`;
}
