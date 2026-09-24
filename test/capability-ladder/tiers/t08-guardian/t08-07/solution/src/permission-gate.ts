const ROLE_LEVELS: Record<string, number> = {
  superadmin: 3,
  admin: 2,
  user: 1,
};

export function validateRoleChange(actorRole: string, targetRole: string): boolean {
  const actorLevel = ROLE_LEVELS[actorRole] || 0;
  const targetLevel = ROLE_LEVELS[targetRole] || 0;

  if (actorRole === "superadmin") {
    return targetLevel > 0;
  }

  // Actor must have strictly higher level than the role being granted
  return actorLevel > targetLevel;
}
