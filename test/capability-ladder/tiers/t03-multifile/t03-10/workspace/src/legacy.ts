export function fetchUserLegacy(
  id: string,
  cb: (err: Error | null, res?: { id: string; name: string }) => void
): void {
  // Legacy callback code
  if (!id) {
    cb(new Error("Missing ID"));
    return;
  }
  cb(null, { id, name: `User-${id}` });
}
