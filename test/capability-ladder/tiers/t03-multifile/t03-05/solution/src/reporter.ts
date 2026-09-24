import type { WorkUnit } from "./types";

export function summarizeTask(task: WorkUnit): string {
  return `[${task.priority}] ${task.id}`;
}
