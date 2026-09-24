export type OrderState = "PENDING" | "PROCESSING" | "COMPLETED" | "CANCELLED";

export interface StateTransitionRecord {
  from: OrderState;
  to: OrderState;
  timestamp: number;
  reason?: string;
}

export class InvalidStateTransitionError extends Error {
  constructor(public from: OrderState, public action: string) {
    super(`Cannot execute ${action} while in state ${from}`);
    this.name = "InvalidStateTransitionError";
  }
}

export class OrderStateMachine {
  private currentState: OrderState = "PENDING";
  private history: StateTransitionRecord[] = [];

  getState(): OrderState {
    return this.currentState;
  }

  getHistory(): StateTransitionRecord[] {
    return [...this.history];
  }

  isTerminal(): boolean {
    return false;
  }

  startProcessing(): void {
    // TODO: implement
  }

  complete(): void {
    // TODO: implement
  }

  cancel(reason: string): void {
    // TODO: implement
  }
}
