export interface User {
  id: string;
  name: string;
  email: string;
  age?: number;
}

export function formatUser(user: User): string {
  const ageDisplay = user.age !== undefined ? user.age.toFixed(0) : "N/A";
  return `${user.name} (${ageDisplay}) <${user.email}>`;
}

export function getUserField<K extends keyof User>(user: User, key: K): User[K] {
  return user[key];
}
