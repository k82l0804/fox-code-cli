import type { User } from "../models/user";

export function registerUser(id: string, firstName: string, lastName: string, email: string): User {
  return { id, firstName, lastName, email };
}
