export type Role = "admin" | "editor" | "viewer";

export function hasPermission(userRole: Role, requiredRole: Role): boolean {
  // TODO: implement role hierarchy
  return false;
}

export function createRouteGuard(requiredRole: Role) {
  return (user?: { role?: Role }) => {
    return { allowed: false, statusCode: 500 };
  };
}
