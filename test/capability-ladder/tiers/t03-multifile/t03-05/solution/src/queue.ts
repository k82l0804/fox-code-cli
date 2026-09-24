import type { WorkUnit } from "./types";

export class TaskQueue {
  private items: WorkUnit[] = [];

  push(task: WorkUnit) {
    this.items.push(task);
  }

  pop(): WorkUnit | undefined {
    return this.items.shift();
  }
}
