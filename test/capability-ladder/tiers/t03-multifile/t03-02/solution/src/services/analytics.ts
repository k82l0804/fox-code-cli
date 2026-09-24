import { type User, getFullName } from "../models/user";

export function trackUserLogin(user: User): { event: string; user: string } {
  return { event: "LOGIN", user: getFullName(user) };
}
