/**
 * Utility functions for array manipulation.
 */

/**
 * Split an array into chunks of the given size.
 * @param arr The array to chunk
 * @param size The maximum size of each chunk
 * @returns An array of chunks
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) throw new Error("Chunk size must be positive");
  if (arr.length === 0) return [];

  const chunks: T[][] = [];
  // BUG: off-by-one — uses < instead of <= causing last partial chunk to be dropped
  for (let i = 0; i < arr.length - size; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Flatten a nested array one level deep.
 */
export function flatten<T>(arr: T[][]): T[] {
  return arr.reduce((acc, val) => acc.concat(val), []);
}

/**
 * Remove duplicate values from an array.
 */
export function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
