import type { TaskItem } from "./types";

export function processTask(task: TaskItem): string {
  return `Processed ${task.id}: ${task.payload}`;
}
