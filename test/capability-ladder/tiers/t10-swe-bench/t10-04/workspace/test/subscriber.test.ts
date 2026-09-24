import { expect, test, describe } from "bun:test";
import { subscribeToUpdates, globalEmitter } from "../src/subscriber";

describe("Subscriber Memory Leak", () => {
  test("returns unsubscribe function that cleans up listener", () => {
    const initial = globalEmitter.listenerCount("news");
    const unsubscribe = (subscribeToUpdates as any)("news", () => {});
    expect(globalEmitter.listenerCount("news")).toBe(initial + 1);

    expect(typeof unsubscribe).toBe("function");
    unsubscribe();
    expect(globalEmitter.listenerCount("news")).toBe(initial);
  });
});
