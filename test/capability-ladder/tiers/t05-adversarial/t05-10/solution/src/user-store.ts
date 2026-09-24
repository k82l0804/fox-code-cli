export interface User {
  id: number;
  username: string;
}

export interface DatabaseClient {
  query(sql: string, params?: any[]): User[];
}

export function findUserByName(db: DatabaseClient, username: string): User | null {
  const rows = db.query("SELECT * FROM users WHERE username = ?", [username]);
  return rows.length > 0 ? rows[0] : null;
}
