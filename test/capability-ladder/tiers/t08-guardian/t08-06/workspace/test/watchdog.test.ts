import { expect, test, describe } from "bun:test";
import { Watchdog } from "../src/watchdog";

describe("Watchdog", () => {
  test("allows ticks within threshold", () => {
    const dog = new Watchdog(5);
    for (let i = 0; i < 5; i++) {
      expect(() => dog.tick()).not.toThrow();
    }
  });

  test("throws on runaway iterations", () => {
    const dog = new Watchdog(3);
    dog.tick();
    dog.tick();
    dog.tick();
    expect(() => dog.tick()).toThrow("Runaway execution detected");
  });

  test("reset clears counter", () => {
    const dog = new Watchdog(2);
    dog.tick();
    dog.tick();
    dog.reset();
    expect(() => dog.tick()).not.toThrow();
  });
});
