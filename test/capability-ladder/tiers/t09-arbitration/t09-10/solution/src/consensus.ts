export function resolveConsensus<T>(outputs: T[]): T {
  if (outputs.length === 0) throw new Error("Empty outputs");

  const counts = new Map<T, number>();
  for (const item of outputs) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }

  for (const [item, count] of counts.entries()) {
    if (count >= 2) {
      return item;
    }
  }

  return outputs[0];
}
