import { UserV2 } from "./types";

export function formatUserResponse(user: UserV2): { userId: string; displayName: string; active: boolean } {
  return {
    userId: user.id,
    displayName: `${user.firstName} ${user.lastName}`,
    active: user.active,
  };
}
