import type { TaskItem } from "./types";

export function summarizeTask(task: TaskItem): string {
  return `[${task.priority}] ${task.id}`;
}
