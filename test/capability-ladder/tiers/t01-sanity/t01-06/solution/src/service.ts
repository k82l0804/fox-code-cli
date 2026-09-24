import { neededHelper } from "./helpers";

export function processPayload(raw: string): { processed: string; length: number } {
  const processed = neededHelper(raw);
  return { processed, length: processed.length };
}
