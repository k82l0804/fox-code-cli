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
    return this.currentState === "COMPLETED" || this.currentState === "CANCELLED";
  }

  startProcessing(): void {
    if (this.currentState !== "PENDING") {
      throw new InvalidStateTransitionError(this.currentState, "startProcessing");
    }
    this.recordTransition("PROCESSING");
  }

  complete(): void {
    if (this.currentState !== "PROCESSING") {
      throw new InvalidStateTransitionError(this.currentState, "complete");
    }
    this.recordTransition("COMPLETED");
  }

  cancel(reason: string): void {
    if (this.currentState !== "PENDING" && this.currentState !== "PROCESSING") {
      throw new InvalidStateTransitionError(this.currentState, "cancel");
    }
    this.recordTransition("CANCELLED", reason);
  }

  private recordTransition(to: OrderState, reason?: string): void {
    this.history.push({
      from: this.currentState,
      to,
      timestamp: Date.now(),
      reason,
    });
    this.currentState = to;
  }
}
