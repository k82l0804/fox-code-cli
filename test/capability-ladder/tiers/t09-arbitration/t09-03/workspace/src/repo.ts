export interface DB {
  query(sql: string, params?: any[]): any[];
}

export function searchUsers(db: DB, query: string): any[] {
  // TODO: Select secure candidate
  return [];
}
