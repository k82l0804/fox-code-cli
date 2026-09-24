import { expect, test, describe } from "bun:test";
import { type WorkUnit } from "../src/types";
import { TaskQueue } from "../src/queue";
import { processTask } from "../src/worker";
import { sortByPriority } from "../src/scheduler";
import { summarizeTask } from "../src/reporter";
import { TaskStore } from "../src/storage";

describe("WorkUnit system", () => {
  const unit1: WorkUnit = { id: "WU-1", payload: "data1", priority: 1 };
  const unit2: WorkUnit = { id: "WU-2", payload: "data2", priority: 5 };

  test("queue stores and retrieves work units", () => {
    const q = new TaskQueue();
    q.push(unit1);
    expect(q.pop()).toEqual(unit1);
  });

  test("worker processes work unit", () => {
    expect(processTask(unit1)).toBe("Processed WU-1: data1");
  });

  test("scheduler sorts work units by priority", () => {
    expect(sortByPriority([unit1, unit2])[0]).toEqual(unit2);
  });

  test("reporter summarizes work unit", () => {
    expect(summarizeTask(unit2)).toBe("[5] WU-2");
  });

  test("store saves and finds work unit", () => {
    const store = new TaskStore();
    store.save(unit1);
    expect(store.find("WU-1")).toEqual(unit1);
  });
});
