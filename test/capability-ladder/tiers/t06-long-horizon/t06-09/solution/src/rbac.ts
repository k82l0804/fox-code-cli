export type Role = "admin" | "editor" | "viewer";

const ROLE_RANKS: Record<Role, number> = {
  admin: 3,
  editor: 2,
  viewer: 1,
};

export function hasPermission(userRole: Role, requiredRole: Role): boolean {
  const userRank = ROLE_RANKS[userRole] || 0;
  const requiredRank = ROLE_RANKS[requiredRole] || 0;
  return userRank >= requiredRank;
}

export function createRouteGuard(requiredRole: Role) {
  return (user?: { role?: Role }): { allowed: boolean; statusCode: number; error?: string } => {
    if (!user || !user.role) {
      return { allowed: false, statusCode: 401, error: "Unauthorized: Missing authentication" };
    }

    if (!hasPermission(user.role, requiredRole)) {
      return { allowed: false, statusCode: 403, error: "Forbidden: Insufficient privileges" };
    }

    return { allowed: true, statusCode: 200 };
  };
}
