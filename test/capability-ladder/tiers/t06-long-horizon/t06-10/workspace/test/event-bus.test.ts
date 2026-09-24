import { expect, test, describe } from "bun:test";
import { AsyncEventBus } from "../src/event-bus";

describe("AsyncEventBus", () => {
  test("awaits async handlers and handles once", async () => {
    const bus = new AsyncEventBus();
    const calls: string[] = [];

    bus.on("data", async (val) => {
      await new Promise((r) => setTimeout(r, 20));
      calls.push(`on:${val}`);
    });

    bus.once("data", async (val) => {
      calls.push(`once:${val}`);
    });

    await bus.emit("data", "first");
    expect(calls).toEqual(["on:first", "once:first"]);

    await bus.emit("data", "second");
    expect(calls).toEqual(["on:first", "once:first", "on:second"]);
  });

  test("isolates errors across multiple handlers and throws AggregateError", async () => {
    const bus = new AsyncEventBus();
    let secondRan = false;

    bus.on("error-test", async () => {
      throw new Error("handler 1 failed");
    });

    bus.on("error-test", async () => {
      secondRan = true;
    });

    try {
      await bus.emit("error-test", null);
      expect(true).toBe(false); // Should not reach here
    } catch (err: any) {
      expect(err.name).toBe("AggregateError");
      expect(err.errors.length).toBe(1);
      expect(secondRan).toBe(true);
    }
  });
});
