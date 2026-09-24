import { levenshteinDistance } from "./math";

export function findClosestWord(query: string, candidates: string[]): string | null {
  if (candidates.length === 0) return null;
  let best = candidates[0];
  let minDistance = levenshteinDistance(query, best);

  for (let i = 1; i < candidates.length; i++) {
    const dist = levenshteinDistance(query, candidates[i]);
    if (dist < minDistance) {
      minDistance = dist;
      best = candidates[i];
    }
  }
  return best;
}
