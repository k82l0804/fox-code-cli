import type { User } from "../models/user";

export function registerUser(id: string, name: string, email: string): User {
  return { id, name, email };
}
