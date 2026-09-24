export interface User {
  id: string;
  name: string;
  email: string;
  age?: number;
}

export function formatUser(user: User): string {
  // BUG: user.age is optional/undefined, toFixed(0) will fail typecheck under strict mode
  return `${user.name} (${user.age.toFixed(0)}) <${user.email}>`;
}

// BUG: key: string cannot index User under strict mode
export function getUserField(user: User, key: string): unknown {
  return user[key];
}
