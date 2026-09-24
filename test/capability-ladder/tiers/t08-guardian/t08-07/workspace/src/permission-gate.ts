export function validateRoleChange(actorRole: string, targetRole: string): boolean {
  // BUG: Allows any role escalation
  return true;
}
