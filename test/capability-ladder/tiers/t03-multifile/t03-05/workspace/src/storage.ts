import type { TaskItem } from "./types";

export class TaskStore {
  private map = new Map<string, TaskItem>();

  save(task: TaskItem): void {
    this.map.set(task.id, task);
  }

  find(id: string): TaskItem | undefined {
    return this.map.get(id);
  }
}
