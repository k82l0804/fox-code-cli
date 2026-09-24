import { expect, test, describe } from "bun:test";
import { OrderStateMachine, InvalidStateTransitionError } from "../src/order-machine";

describe("OrderStateMachine", () => {
  test("executes happy path PENDING -> PROCESSING -> COMPLETED", () => {
    const sm = new OrderStateMachine();
    expect(sm.getState()).toBe("PENDING");
    expect(sm.isTerminal()).toBe(false);

    sm.startProcessing();
    expect(sm.getState()).toBe("PROCESSING");

    sm.complete();
    expect(sm.getState()).toBe("COMPLETED");
    expect(sm.isTerminal()).toBe(true);

    const history = sm.getHistory();
    expect(history.length).toBe(2);
    expect(history[0].from).toBe("PENDING");
    expect(history[0].to).toBe("PROCESSING");
    expect(history[1].from).toBe("PROCESSING");
    expect(history[1].to).toBe("COMPLETED");
  });

  test("cancels from PENDING state with reason", () => {
    const sm = new OrderStateMachine();
    sm.cancel("Customer changed mind");
    expect(sm.getState()).toBe("CANCELLED");
    expect(sm.isTerminal()).toBe(true);
    expect(sm.getHistory()[0].reason).toBe("Customer changed mind");
  });

  test("cancels from PROCESSING state", () => {
    const sm = new OrderStateMachine();
    sm.startProcessing();
    sm.cancel("Item out of stock");
    expect(sm.getState()).toBe("CANCELLED");
  });

  test("throws InvalidStateTransitionError on invalid complete from PENDING", () => {
    const sm = new OrderStateMachine();
    expect(() => sm.complete()).toThrow(InvalidStateTransitionError);
  });

  test("throws InvalidStateTransitionError when cancelling a COMPLETED order", () => {
    const sm = new OrderStateMachine();
    sm.startProcessing();
    sm.complete();
    expect(() => sm.cancel("Too late")).toThrow(InvalidStateTransitionError);
  });
});
