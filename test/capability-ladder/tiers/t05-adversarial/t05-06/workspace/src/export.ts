export function formatCSVHeader(headers: string[]): string {
  // BUG: Joins with semi-colon instead of comma
  return headers.join(";");
}
