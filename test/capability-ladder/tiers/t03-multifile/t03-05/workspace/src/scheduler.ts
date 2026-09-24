import type { TaskItem } from "./types";

export function sortByPriority(tasks: TaskItem[]): TaskItem[] {
  return [...tasks].sort((a, b) => b.priority - a.priority);
}
