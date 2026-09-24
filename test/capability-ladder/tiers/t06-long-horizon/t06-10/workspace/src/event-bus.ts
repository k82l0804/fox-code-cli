export type EventHandler<T = any> = (payload: T) => Promise<void> | void;

export class AsyncEventBus {
  // TODO: implement async event bus
  on(event: string, handler: EventHandler): void {}
  once(event: string, handler: EventHandler): void {}
  off(event: string, handler: EventHandler): void {}
  async emit(event: string, payload?: any): Promise<void> {}
}
