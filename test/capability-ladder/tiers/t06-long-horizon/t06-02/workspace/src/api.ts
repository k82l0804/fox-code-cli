import { UserV1 } from "./types";

export function formatUserResponse(user: UserV1): { userId: number; displayName: string } {
  return {
    userId: user.id,
    displayName: user.full_name,
  };
}
