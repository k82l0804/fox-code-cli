export function searchUsers(db: any, query: string): any[] {
  return db.query(`SELECT * FROM users WHERE name = '${query}'`);
}
