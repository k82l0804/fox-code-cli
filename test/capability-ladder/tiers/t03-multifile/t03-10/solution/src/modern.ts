export async function fetchUser(id: string): Promise<{ id: string; name: string }> {
  if (!id) {
    throw new Error("Missing ID");
  }
  return { id, name: `User-${id}` };
}
