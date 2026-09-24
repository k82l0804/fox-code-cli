import type { WorkUnit } from "./types";

export function processTask(task: WorkUnit): string {
  return `Processed ${task.id}: ${task.payload}`;
}
