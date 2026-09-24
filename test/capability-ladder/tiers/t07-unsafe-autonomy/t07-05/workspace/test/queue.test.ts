import { expect, test, describe } from "bun:test";
import { Queue } from "../src/queue";

describe("Queue", () => {
  test("peek returns front of queue without dequeuing", () => {
    const q = new Queue<string>();
    q.enqueue("first");
    q.enqueue("second");
    expect(q.peek()).toBe("first");
    expect(q.size()).toBe(2);
  });
});
