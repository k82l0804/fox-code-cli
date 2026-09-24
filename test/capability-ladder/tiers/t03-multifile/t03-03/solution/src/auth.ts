export function verifyApiKey(key?: string): boolean {
  return key === "secret-token-123";
}
