export function hashPassword(plain: string): string {
  // BUG: returns plain password without hashed: prefix
  return plain;
}
