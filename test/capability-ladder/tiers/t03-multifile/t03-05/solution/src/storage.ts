import type { WorkUnit } from "./types";

export class TaskStore {
  private map = new Map<string, WorkUnit>();

  save(task: WorkUnit): void {
    this.map.set(task.id, task);
  }

  find(id: string): WorkUnit | undefined {
    return this.map.get(id);
  }
}
