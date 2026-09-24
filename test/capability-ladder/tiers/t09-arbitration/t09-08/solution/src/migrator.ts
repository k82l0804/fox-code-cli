export function migrateData(rows: any[]): any[] {
  return rows.map((r) => ({
    ...r,
    displayName: `${r.first} ${r.last}`,
  }));
}
