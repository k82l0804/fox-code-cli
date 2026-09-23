# 🦊 Architectural Specification: State-Tracking Planner (`task_checklist`)

> **Document Version:** 1.0.0  
> **Date:** 2026-09-22T20:55:00-04:00  
> **Target Subsystem:** `packages/core/src/tool/tools/`, `src/session/processor/`, `@fox/tui`  
> **Reference Benchmark:** [`../2026-09-22T20-40_competitive-agent-benchmark-aider-goose.md`](../2026-09-22T20-40_competitive-agent-benchmark-aider-goose.md)

---

## 1. Problem Statement & Motivation

During our benchmark study, **Goose exhibited exceptional operational discipline**. Before modifying code or executing commands, Goose automatically invoked its built-in `todo_write` tool to create an explicit mental model:

```markdown
- [ ] Run bun test_rate_limiter.ts to inspect failing test cases
- [ ] Investigate root causes in rate_limiter.ts
- [ ] Surgically fix bugs in rate_limiter.ts
- [ ] Re-run bun test_rate_limiter.ts to confirm 0 failures
```

As it progressed, Goose updated item statuses to `[x]`, preventing duplicate tool calls, forgotten requirements, or premature completion.

### The Fox Gap
Fox currently relies on the LLM's implicit reasoning inside system prompt instructions. When tasks involve multi-step refactors or ambiguous failures, agents without stateful checklists are vulnerable to:
1. **Context Thrashing**: Re-reading files or repeating failed command patterns.
2. **Premature Termination**: Stopping before all acceptance criteria or regression suites have been executed.
3. **Loss of Goal Alignment**: Drifting into tangential edits during complex repairs.

---

## 2. Proposed Architecture: `task_checklist` Tool

We introduce `task_checklist` as a native, location-scoped tool in `@opencode-ai/core` that tracks task state, drives UI visualization, and integrates with the Fox Guardian verification gates.

```
┌────────────────────────────────────────────────────────┐
│                   TASK CHECKLIST ENGINE                │
├────────────────────────────────────────────────────────┤
│ 1. Tool Layer: `packages/core/src/tool/tools/todo.ts`  │
│    • `task_checklist`: set, update, list items         │
│                                                        │
│ 2. Processor Gate: `src/session/processor/todo-gate.ts`│
│    • Blocks session completion if items remain pending │
│    • Detects stale items & prompts agent to update     │
│                                                        │
│ 3. UI Surface: TUI & ACP Client Protocol              │
│    • Real-time progress bar (e.g. [3/4 Complete])      │
│    • Interactive checklist drawer in VS Code extension │
└────────────────────────────────────────────────────────┘
```

---

## 3. Schema & Tool Specification

### Tool Definition (`packages/core/src/tool/tools/task-checklist.ts`)
```typescript
import { Tool } from "../tool"
import { Schema } from "effect"

export const ChecklistItem = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  status: Schema.Literals(["pending", "in_progress", "completed", "cancelled"]),
})

export const TaskChecklistInput = Schema.Struct({
  action: Schema.Literals(["set", "update", "get"]),
  items: Schema.optional(Schema.Array(ChecklistItem)),
  updates: Schema.optional(
    Schema.Array(
      Schema.Struct({
        id: Schema.String,
        status: Schema.Literals(["pending", "in_progress", "completed", "cancelled"]),
      })
    )
  ),
})
```

---

## 4. Integration with Fox Guardian & Session Processor

1. **Intake Auto-Planning**:
   On prompts with 2 or more distinct requirements (e.g., "Refactor X, add tests in Y, and run benchmarks"), Fox's system prompt instructs the agent to initialize a `task_checklist` on Turn 1.
2. **Guardian Verification Gate**:
   Before `session.complete` or `/exit` is accepted, the Guardian checks the state of the checklist. If any item is `in_progress` or `pending` without cancellation rationale, Fox prevents premature exit and prompts the agent to complete remaining obligations.
3. **Zero Prefix Bloat**:
   To comply with Fox's **Rule of KV-Cache Prefix Stability**, the checklist state is NOT passively dumped into the system prompt prefix. Instead, it is stored in session state and returned dynamically as a tool response or compact footer token.
