export interface User {
  id: number;
  username: string;
}

export interface DatabaseClient {
  query(sql: string, params?: any[]): User[];
}

export function findUserByName(db: DatabaseClient, username: string): User | null {
  // BUG: unhandled stub
  return null;
}
