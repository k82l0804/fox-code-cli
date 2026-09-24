import { expect, test, describe } from "bun:test";
import { TypedEventEmitter } from "../src/event-emitter";

describe("TypedEventEmitter", () => {
  test("off removes all instances of the same listener", () => {
    const emitter = new TypedEventEmitter();
    const fn = () => {};
    emitter.on("data", fn);
    emitter.on("data", fn);
    emitter.on("data", fn);
    expect(emitter.listenerCount("data")).toBe(3);

    emitter.off("data", fn);
    expect(emitter.listenerCount("data")).toBe(0);
  });

  test("once unregisters listener even if listener throws", () => {
    const emitter = new TypedEventEmitter();
    let callCount = 0;
    emitter.once("boom", () => {
      callCount++;
      throw new Error("Failure in once listener");
    });

    emitter.emit("boom");
    expect(callCount).toBe(1);
    expect(emitter.listenerCount("boom")).toBe(0);

    // Second emit must NOT invoke the listener again
    emitter.emit("boom");
    expect(callCount).toBe(1);
  });
});
