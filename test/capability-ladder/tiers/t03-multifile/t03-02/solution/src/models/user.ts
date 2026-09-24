export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export function getFullName(user: User): string {
  return `${user.firstName} ${user.lastName}`;
}
