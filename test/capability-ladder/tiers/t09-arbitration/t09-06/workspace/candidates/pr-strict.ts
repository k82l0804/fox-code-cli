export interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export function parseUserProfile(data: unknown): UserProfile {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid profile payload");
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.id !== "string" || typeof obj.name !== "string" || typeof obj.email !== "string") {
    throw new Error("Malformed profile properties");
  }
  return { id: obj.id, name: obj.name, email: obj.email };
}
