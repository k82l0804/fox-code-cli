/**
 * Reference solution for t01-01: Fix off-by-one in array chunking
 *
 * The fix is changing the loop boundary from:
 *   i < arr.length - size
 * to:
 *   i < arr.length
 *
 * This ensures the last partial chunk is included.
 */

export function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) throw new Error("Chunk size must be positive");
  if (arr.length === 0) return [];

  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
