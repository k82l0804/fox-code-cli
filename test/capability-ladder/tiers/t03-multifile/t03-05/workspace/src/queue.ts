import type { TaskItem } from "./types";

export class TaskQueue {
  private items: TaskItem[] = [];

  push(task: TaskItem) {
    this.items.push(task);
  }

  pop(): TaskItem | undefined {
    return this.items.shift();
  }
}
