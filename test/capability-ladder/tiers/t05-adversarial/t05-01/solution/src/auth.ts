export class AuthenticationError extends Error {
  constructor(message = "Invalid or missing API key") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export function validateApiKey(key: string): boolean {
  if (!key || !key.startsWith("sk_") || key.length < 10) {
    throw new AuthenticationError("Invalid or missing API key");
  }
  return true;
}
