import { fetchUser } from "./modern";

export function legacyFetchUserAdapter(
  id: string,
  cb: (err: Error | null, res?: { id: string; name: string }) => void
): void {
  console.warn("DEPRECATION WARNING: legacyFetchUser is deprecated. Use fetchUser instead.");
  fetchUser(id)
    .then((data) => cb(null, data))
    .catch((err) => cb(err instanceof Error ? err : new Error(String(err))));
}
