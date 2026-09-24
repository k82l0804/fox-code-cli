import { expect, test, describe } from "bun:test";
import { PluginManager } from "../src/manager";
import { Plugin } from "../src/plugin";

describe("PluginManager", () => {
  test("initializes plugins and isolates failing plugin", async () => {
    const manager = new PluginManager();
    const events: string[] = [];

    const p1: Plugin = {
      name: "auth",
      version: "1.0.0",
      async init() { events.push("auth:init"); },
      async shutdown() { events.push("auth:shutdown"); },
    };

    const pFailing: Plugin = {
      name: "broken",
      version: "1.0.0",
      async init() { throw new Error("Init failure"); },
      async shutdown() { events.push("broken:shutdown"); },
    };

    const p2: Plugin = {
      name: "metrics",
      version: "1.0.0",
      async init() { events.push("metrics:init"); },
      async shutdown() { events.push("metrics:shutdown"); },
    };

    manager.register(p1);
    manager.register(pFailing);
    manager.register(p2);

    const result = await manager.loadAll();
    expect(result.loaded).toEqual(["auth", "metrics"]);
    expect(result.failed).toEqual(["broken"]);
    expect(events).toEqual(["auth:init", "metrics:init"]);

    await manager.unloadAll();
    expect(events).toEqual(["auth:init", "metrics:init", "metrics:shutdown", "auth:shutdown"]);
  });
});
