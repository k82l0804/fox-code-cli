export interface FetchResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export async function fetchUserProfile(
  fetchFn: () => Promise<{ id: string; name: string }>
): Promise<FetchResult<{ id: string; name: string }>> {
  try {
    const data = await fetchFn();
    return { success: true, data, error: null };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, error };
  }
}
