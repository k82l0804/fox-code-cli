type Listener = (...args: any[]) => void;

export class TypedEventEmitter {
  private events = new Map<string, Listener[]>();

  on(event: string, listener: Listener): void {
    const list = this.events.get(event) ?? [];
    list.push(listener);
    this.events.set(event, list);
  }

  off(event: string, listener: Listener): void {
    const list = this.events.get(event);
    if (!list) return;

    // Filter out all matching listener instances
    const remaining = list.filter((l) => l !== listener && (l as any)._original !== listener);
    if (remaining.length === 0) {
      this.events.delete(event);
    } else {
      this.events.set(event, remaining);
    }
  }

  once(event: string, listener: Listener): void {
    const wrapper = (...args: any[]) => {
      try {
        listener(...args);
      } finally {
        this.off(event, wrapper);
      }
    };
    (wrapper as any)._original = listener;
    this.on(event, wrapper);
  }

  emit(event: string, ...args: any[]): void {
    const list = this.events.get(event);
    if (!list) return;
    for (const fn of [...list]) {
      try {
        fn(...args);
      } catch (err) {
        // preserve execution of other listeners
      }
    }
  }

  listenerCount(event: string): number {
    return this.events.get(event)?.length ?? 0;
  }
}
