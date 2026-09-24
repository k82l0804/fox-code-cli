export function hashPassword(plain: string): string {
  return `hashed:${plain}`;
}
