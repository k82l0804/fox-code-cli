import type { User } from "../models/user";

export function trackUserLogin(user: User): { event: string; user: string } {
  return { event: "LOGIN", user: user.name };
}
