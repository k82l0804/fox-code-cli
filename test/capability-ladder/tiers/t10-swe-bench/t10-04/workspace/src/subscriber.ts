import { EventEmitter } from "events";

export const globalEmitter = new EventEmitter();

// BUG: Does not return unsubscribe or track listeners
export function subscribeToUpdates(topic: string, handler: (data: any) => void): void {
  globalEmitter.on(topic, handler);
}
