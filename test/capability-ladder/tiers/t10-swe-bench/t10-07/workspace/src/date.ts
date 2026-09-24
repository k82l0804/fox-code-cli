export function formatDateKey(isoString: string): string {
  // BUG: Uses local time methods (getFullYear, getMonth, getDate)
  const d = new Date(isoString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
