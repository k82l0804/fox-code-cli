import type { WorkUnit } from "./types";

export function sortByPriority(tasks: WorkUnit[]): WorkUnit[] {
  return [...tasks].sort((a, b) => b.priority - a.priority);
}
