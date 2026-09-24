export interface FetchResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export async function fetchUserProfile(
  fetchFn: () => Promise<{ id: string; name: string }>
): Promise<FetchResult<{ id: string; name: string }>> {
  // BUG: Missing try/catch — unhandled rejection when fetchFn() fails
  const data = await fetchFn();
  return { success: true, data, error: null };
}
