import { EventEmitter } from "events";

export const globalEmitter = new EventEmitter();

export function subscribeToUpdates(topic: string, handler: (data: any) => void): () => void {
  globalEmitter.on(topic, handler);
  return () => {
    globalEmitter.off(topic, handler);
  };
}
