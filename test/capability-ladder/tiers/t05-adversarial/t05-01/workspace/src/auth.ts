export class AuthenticationError extends Error {
  constructor(message = "Invalid or missing API key") {
    super(message);
    this.name = "AuthenticationError";
  }
}

// TODO: Implement validateApiKey per API specification
export function validateApiKey(key: string): boolean {
  // BUG: Incomplete stub
  return false;
}
