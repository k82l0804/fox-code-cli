export function formatDate(timestamp: number, formatStr: string = "YYYY-MM-DD"): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");

  const YYYY = String(d.getFullYear());
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());

  // Incomplete: only returns YYYY-MM-DD
  return `${YYYY}-${MM}-${DD}`;
}
