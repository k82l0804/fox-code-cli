export function sanitizeInput(raw: string): string {
  return raw.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
