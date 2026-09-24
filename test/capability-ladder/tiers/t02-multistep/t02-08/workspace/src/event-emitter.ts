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

    // BUG 1: Only removes first occurrence, or index shift bug in loop
    const idx = list.indexOf(listener);
    if (idx >= 0) {
      list.splice(idx, 1);
    }
  }

  once(event: string, listener: Listener): void {
    const wrapper = (...args: any[]) => {
      // BUG 2: If listener throws, off is never called
      listener(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  emit(event: string, ...args: any[]): void {
    const list = this.events.get(event);
    if (!list) return;
    // Clone list so mutations during emit do not disrupt iteration
    for (const fn of [...list]) {
      try {
        fn(...args);
      } catch (err) {
        // swallow to let other listeners proceed
      }
    }
  }

  listenerCount(event: string): number {
    return this.events.get(event)?.length ?? 0;
  }
}
