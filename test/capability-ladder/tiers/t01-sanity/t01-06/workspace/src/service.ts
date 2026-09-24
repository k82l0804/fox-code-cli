import { neededHelper, unusedHelper } from "./helpers";

function deprecatedOldInternalLogic(val: number): number {
  return val * 42;
}

export function processPayload(raw: string): { processed: string; length: number } {
  const processed = neededHelper(raw);
  return { processed, length: processed.length };
}
