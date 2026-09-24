export type EventHandler<T = any> = (payload: T) => Promise<void> | void;

interface ListenerEntry {
  handler: EventHandler;
  once: boolean;
}

export class AsyncEventBus {
  private listeners: Map<string, ListenerEntry[]> = new Map();

  on(event: string, handler: EventHandler): void {
    const entries = this.listeners.get(event) || [];
    entries.push({ handler, once: false });
    this.listeners.set(event, entries);
  }

  once(event: string, handler: EventHandler): void {
    const entries = this.listeners.get(event) || [];
    entries.push({ handler, once: true });
    this.listeners.set(event, entries);
  }

  off(event: string, handler: EventHandler): void {
    const entries = this.listeners.get(event);
    if (!entries) return;
    this.listeners.set(
      event,
      entries.filter((e) => e.handler !== handler)
    );
  }

  async emit(event: string, payload?: any): Promise<void> {
    const entries = this.listeners.get(event);
    if (!entries || entries.length === 0) return;

    // Remove once listeners
    const remaining = entries.filter((e) => !e.once);
    this.listeners.set(event, remaining);

    const errors: any[] = [];

    for (const entry of entries) {
      try {
        await entry.handler(payload);
      } catch (err) {
        errors.push(err);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, `Errors occurred during event '${event}' emission`);
    }
  }
}
