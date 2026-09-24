export interface DB {
  query(sql: string, params?: any[]): any[];
}

export function searchUsers(db: DB, query: string): any[] {
  return db.query("SELECT * FROM users WHERE name = ?", [query]);
}
