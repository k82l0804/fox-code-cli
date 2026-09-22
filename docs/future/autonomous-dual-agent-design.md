# Fox Guardian — Architecture & Design

> **Philosophy**: Evolve Fox's existing foundation. No redesigns, no new
> databases, no new coordination protocols. Small, precision changes that
> unlock the dual-agent pattern by growing the infrastructure we already have.
>
> **Related documents**:
> - [Reference Architecture](./autonomous-agent-workflow.md) — the ideal 11-phase SWE loop
> - [Daemon Architecture](../daemon-architecture.md) — internal mechanics of `fox serve` & clients
> - [Benchmark Strategy](./autonomous-agent-std-tests.md) — how to measure progress
> - [Spec-Driven Opinion](./opinion-ideal-sw-agent-workflow.md) — research backing

---

## The Core Insight

In interactive mode, **the human is the guardian**. The human reviews diffs,
redirects strategy, gates risky actions, and decides when to stop.

In `--auto` mode, **nobody fills that role**. The doer runs until it
succeeds or the circuit breakers trip. There is zero intelligence between
"raw LLM autonomy" and "emergency stop."

The guardian agent fills this gap: **when the human steps away, the
guardian takes their seat.** It's not a new concept — it's the existing
human oversight role, delegated to a cheap LLM when the human isn't
available.

---

## What We Have (The Foundation)

Before designing anything new, inventory what already works:

| Capability | Module | What it does today |
|---|---|---|
| **Session loop** | `processor.ts` | Drives the LLM turn loop. Tool calls, verification, response handling. This is the controller. |
| **Oscillation detection** | `oscillation.ts` | SHA-256 content hashing, sliding window, A→B→A detection. Hard-coded, fast, reliable. |
| **Doom-loop blocking** | `processor.ts` | Blocks N identical consecutive tool calls. Deterministic. |
| **Repair budget** | `repair-budget.ts` | Consecutive failure counting with exhaustion warnings. |
| **Auto-verification** | `verification.ts` | Detect test command → execute → compress output → structured result. |
| **Output compression** | `compress.ts` | 7-transform LLTC pipeline. Workflow-aware policies. |
| **Context supersession** | `supersede.ts` | Render-time replacement of stale file reads, git status. |
| **Compaction** | `compaction.ts` | LLM-based history summarization on overflow. |
| **Snapshots** | `snapshot/index.ts` | Git-based checkpoints, restore, revert, undo/redo. |
| **Goal system** | `goal/` | `/goal` command, `goal_report` tool, active/paused/complete/blocked states. |
| **Permission system** | `permission/` | `--auto` / `--yolo`, granular allow/deny, tool+pattern rules. |
| **Todo tool** | `todo.ts` | Agent-created task checklists. |
| **Autonomous config** | `config.ts` | `autonomous.auto_verify`, `test_command`, `test_timeout`, `detect_oscillations`, `oscillation_threshold`, `max_repair_turns`. |
| **Multiple models** | `provider/`, `llm.ts` | Multi-provider support, model selection, FoxRoutedModel. |

**Key insight**: We don't need to build a "shared substrate" from scratch.
The session message history + snapshot system + autonomous config already
form the coordination layer. We grow it.

---

## The Guardian — Always Present, Sliding Authority

The guardian is not a feature you bolt on for `--auto` mode. It's a core
layer that's always present, with authority that scales based on how much
the human has stepped back:

```
┌──────────────────────────────────────────────────────────┐
│  Guardian Layer (always present)                         │
│                                                          │
│  Interactive:   advise    (notes in UI, human decides)   │
│  --auto:        enforce   (injects into doer context)    │
│  /goal + auto:  surrogate (full human stand-in)          │
│                                                          │
│  Same model, same logic, same analysis.                  │
│  Only the authority policy changes.                      │
├──────────────────────────────────────────────────────────┤
│  Circuit breakers (always enforced, override guardian)   │
│  Oscillation (SHA-256), doom-loop, budget, timeout       │
└──────────────────────────────────────────────────────────┘
```

### Core Principle: Autonomy is a Request, Not a Guarantee

> **Autonomy is a *request*, not a guarantee. The Guardian is the gatekeeper that decides whether autonomy is allowed.**

When a user launches `fox --auto "<task>"`, Fox does not blindly execute. The Guardian evaluates whether the task is:
1. **A Structured Plan**: (has explicit scope, target files, acceptance criteria) → Validates, runs baseline check, executes.
2. **Atomic & Safe**: (single-step, deterministic, local, low-risk) → Executes directly with diff monitoring.
3. **Ambiguous or Risky**: (vague prompt, open-ended) → **Blocked**. Guardian outputs an **Assisted Scaffold** based on repository inspection with `[REQUIRED]` and `[MISSING]` tags.

### Tool Profiles (Replacing `--yolo`)

Fox rejects blanket `--yolo` flags in favor of named **Tool Profiles** (`--tools=<profile>`):
- **`basic`**: Read-only, grep, glob, lsp (zero side effects)
- **`write`**: `basic` + edit, write workspace files
- **`system`** *(standard)*: `write` + `bash` (tests, builds, package managers)
- **`dangerous`**: `system` + file deletion, git commits, branch mutations
- **`custom`**: Explicit user overrides

### Authority Levels

| Mode | Who's the guardian? | Authority | Guardian behavior |
|---|---|---|---|
| **Interactive (`fox`)** | Human (guardian = advisor) | Advise | Observations shown in UI. Human sees them. Doer doesn't. Non-blocking. |
| **Tool-Bounded (`fox --tools=write`)** | Human + Profile | Advise | Tools auto-approved within profile; guardian advises. |
| **Autonomous (`fox --auto --tools=system`)** | Guardian (human absent) | Surrogate | Full authority: intake gate, workflow enforcement, test failure classification, review gate. |
| **Headless (`fox run --auto`)** | Guardian (no UI at all) | Surrogate | Same as above, results logged to session, clean exit code. |

```typescript
type GuardianAuthority = "advise" | "enforce" | "surrogate"

function getAuthority(session: SessionInfo): GuardianAuthority {
  if (session.auto) return "surrogate"
  return "advise"
}
```

### The Universal Command Triad
- **`/enhance <prompt>`**: Pure conversational prompt polisher for interactive chat (fast single-paragraph rephrase).
- **`/plan <task>`**: Generates structural implementation blueprint.
- **`/refine [constraints]`**: Tightens boundaries, sets tool profile, specifies binary acceptance criteria and rollback anchors.
- **`/verify`**: Pre-flight dry run (checks git status, preconditions, baseline build/test, tool profile match) AND post-flight completion gate.

### What the Guardian Does vs. What Stays Hard-Coded

The guardian handles everything that requires **understanding**.
Hard-coded checks handle everything that's **mathematically checkable**.

| Capability | Hard-coded | Guardian | Role |
|---|---|---|---|
| Exact oscillation (A→B→A) | ✅ SHA-256, microseconds | — | **Circuit breaker** — free and perfect |
| Doom-loop (identical calls) | ✅ String comparison | — | **Circuit breaker** — trivially simple |
| Repair budget counting | ✅ Counter increment | — | **Circuit breaker** — a counter is a counter |
| Timeout enforcement | ✅ Wall clock | — | **Circuit breaker** — non-negotiable |
| Snapshot checkpointing | ✅ Always on | — | **Circuit breaker** — non-negotiable |
| **Failure classification** | ❌ Can't hard-code | ✅ LLM classifies type | **Intelligence** — requires reasoning |
| **Strategy selection** | ❌ Can't hard-code | ✅ LLM selects approach | **Intelligence** — requires judgment |
| **Workflow enforcement** | Brittle if hard-coded | ✅ LLM context-aware | **Intelligence** — rules vary per project |
| **Semantic oscillation** | ❌ SHA-256 can't detect | ✅ LLM sees intent patterns | **Intelligence** — requires comprehension |
| **Quality assessment** | ❌ Can't hard-code | ✅ LLM reviews diffs | **Intelligence** — requires understanding |
| **Progress assessment** | ❌ No concept of progress | ✅ LLM judges trajectory | **Intelligence** — requires reasoning |

**The guardian is the brain. The circuit breakers are the fuse box.** The
circuit breakers almost never fire in a well-functioning system — but
they're there because LLMs can hallucinate, and you never rely solely on
a probabilistic system for safety.

---

## Phase A — Guardian as Core Layer

**Scope**: Add guardian calls at 3 decision points in the existing
processor loop. One new module, minimal code changes, maximal impact.

### A1. Post-Failure Analysis

**Today**: When verification fails, the compressed output is appended to
the tool result. The doer sees it and decides what to do.

**With guardian**: After verification failure, the controller calls the
guardian with a compressed summary:

```typescript
interface GuardianFailureInput {
  goal: string                    // from goal system
  turnCount: number               // from session
  consecutiveFailures: number     // from repair budget
  verificationOutput: string      // compressed by LLTC pipeline
  recentActions: string           // last 3 tool calls, compressed
  oscillationWarnings: string[]   // from oscillation tracker
}

interface GuardianFailureDecision {
  action: "continue" | "switch_strategy" | "escalate" | "stop"
  failureType: "syntax" | "type" | "assertion" | "runtime" | "environment" | "design"
  reasoning: string               // 1-2 sentences
  strategyHint?: string           // if switch_strategy
}
```

**Behavior by authority level**:
- **Advise**: Show classification in TUI status bar. Doer doesn't see it.
- **Enforce/Surrogate**: Inject reasoning + hint into doer's tool output.
  If `stop`, pause the session.

**Hook point**: `processor.ts`, after the auto-verification block (~line
651), before `completeToolCall`.

### A2. Pre-Commit Review Gate

**Today**: When verification passes, the doer presents "✅ PASSED" and
offers to commit. No review step.

**With guardian**: After verification passes and the goal is being reported
as complete, the controller calls the guardian with the cumulative diff:

```typescript
interface GuardianReviewInput {
  goal: string
  diffSummary: string             // from snapshot diff, compressed
  filesChanged: string[]
  testsPassed: string
}

interface GuardianReviewDecision {
  action: "approve" | "request_changes" | "flag_for_human"
  concerns?: string[]
  reasoning: string
}
```

**Behavior by authority level**:
- **Advise**: Show review summary in TUI. Human decides.
- **Enforce**: If `request_changes`, inject concerns as follow-up context.
- **Surrogate**: If `flag_for_human`, pause the goal.

**Hook point**: `processor.ts`, in the finish-step handler (~line 744).

### A3. Progress Check

**Today**: The doer runs indefinitely until circuit breakers trip or
the goal completes.

**With guardian**: Every N doer turns (configurable, default 10), the
controller calls the guardian:

```typescript
interface GuardianProgressInput {
  goal: string
  turnCount: number
  totalCost: number
  tasksSummary: string            // compressed history
  currentState: string            // last verification result
}

interface GuardianProgressDecision {
  action: "continue" | "refocus" | "stop"
  reasoning: string
  refocusHint?: string
}
```

**Behavior by authority level**:
- **Advise**: Show progress note in TUI.
- **Enforce/Surrogate**: If `refocus`, inject hint. If `stop`, pause.

**Hook point**: `processor.ts`, at the start of a new doer turn.

---

### Decision Point 4 — Interruption Recovery & Wake-Up Audit

**Without guardian**: Resuming an interrupted session (`fox --continue` after Ctrl+C or crash) leaves the LLM with session amnesia. The model tries to deduce state from raw chat logs, often repeating work, re-applying conflicting patches, or prematurely assuming it finished.

**With guardian**: On session resumption (via `fox --continue`, `fox run --auto --continue`, or ACP reconnect), the Guardian executes a structured **Wake-Up Audit**:
1. **Tool Triage**: Marks dangling in-flight tool calls in SQLite as `{ status: "error", metadata: { interrupted: true } }`.
2. **Git Reconciliation**: Runs `git status` and `git diff` against the plan's baseline anchor to identify uncommitted changes.
3. **Plan Contract Tracking**: Reads active `.fox/plans/` checklist to determine what is complete (`[x]`), in-progress (`[/]`), or pending (`[ ]`).
4. **Agent Continuity**: If `--agent` is omitted on recovery, restores and re-activates the **prior agent** used in that session.
5. **Executive Briefing & Suggested Prompt**: 
   - In interactive TUI mode, prints a structured status briefing and **pre-populates the composer buffer with a ready-to-run Suggested Prompt** (user simply presses `[Enter]`).
   - In autonomous mode (`--auto`), injects synthetic recovery context directly into the Doer and resumes execution immediately.

```typescript
interface GuardianWakeUpAudit {
  sessionID: string
  priorAgent: string
  activePlan?: string
  dirtyFiles: string[]
  completedSteps: string[]
  inProgressStep?: string
  pendingSteps: string[]
  suggestedPrompt: string
}
```

**Hook point**: Session initialization in `src/session/processor.ts` and `src/cli/cmd/run.ts`.

---

### Decision Point 5 — Asymmetric Context & Compaction Arbiter

**The Problem**: The Doer operates in the trenches, consuming raw 400-line file reads, 1,500-line test outputs, and compiler errors. Its context balloons to 80k–120k tokens in 15 turns, triggering attention dilution, goal drift, and looped hallucinations. Meanwhile, the Guardian's context stays pristine at ~3k–8k tokens indefinitely because it only observes high-level receipts.

**The Solution**: The Guardian leverages this **context asymmetry** to actively protect the Doer:
1. **Curated Compactor**: When the Doer reaches a token threshold (e.g. 70% capacity), the Guardian generates the clean reset prompt—pinning the Plan Contract, summarizing verified milestones, and wiping out tactical chaff. The Doer resets from 100k noisy tokens to a **5k-token clean slate**.
2. **Cognitive De-Looping**: Identifies when the Doer's context is poisoned by repeated failed attempts and issues a Clean Break Directive.
3. **Chaff Shield**: Captures noisy test/build outputs to disk and injects only actionable failure kernels into the Doer's context.
4. **Goal Drift Tether**: Detects when the Doer touches files or dependencies outside the active milestone scope and halts drift immediately.
5. **Token vs. Milestone Velocity**: Trips a circuit breaker if high token burn occurs with zero milestone advancement.

```typescript
interface GuardianCompactionDirective {
  action: "keep" | "reset_doer_context"
  pinnedPlanContract: string
  verifiedMilestones: string[]
  dirtyFilesSummary: string
  immediateTarget: string
}
```

---

### Topology: 3-Tier Execution Hierarchy (Guardian ➔ Doer ➔ Disposable Subagents)

To prevent the Doer's context from swelling in the first place, execution follows a 3-tier hierarchy:

```
  Tier 1: Guardian    (Strategic Watchtower, ~5k tokens)  — Evaluates, Gates, Compacts
         │
         ▼
  Tier 2: Doer        (Tactical Coordinator, ~20k tokens) — Decomposes Milestones
         │
         ▼
  Tier 3: Subagents   (Disposable Workers, 0–60k tokens)  — Isolated Execution
         │
         └─► [Distilled Result Returned] ──► Subagent Context BLOWN AWAY!
```

* **The Blow-Away Sandbox**: When research, an isolated bug fix, or a heavy test run is needed, the Doer spawns an ephemeral Subagent (`@explore`, `@debug`, or `@verify`).
* **Complete Context Disposal**: The Subagent can burn 40k–60k tokens of raw logs and trial-and-error in its private sandbox.
* **Handover Contract**: Upon completion, the Subagent returns only a compact 200-token result or clean git patch. **The Subagent's entire context history is permanently discarded**.
* **Caller Protection**: The Doer receives only the distilled signal, remaining lean and sharp across the entire project lifecycle.

#### Who Checks In on the Subagents? (Split-Duty Oversight)
* **The Orchestrator (Doer)** performs **Functional & Semantic Supervision**: judges work product quality, reviews git diffs, verifies test correctness, and decides whether to accept, revise, or discard the subagent's output.
* **The Guardian (SynOp Anubis)** performs **Safety Envelope & Quota Enforcement**:
  - **Tool Down-Scoping**: Subagents never exceed parent permissions and are down-scoped by role (e.g. `@explore` locked strictly to `--tools=basic` read-only).
  - **The Ephemeral Budget Leash**: Hard ceilings per subagent (default: max 10 turns, max 30k tokens, max 60s timeout); forcefully terminated if exceeded.
  - **Circuit Breakers & Hang Watchdog**: Detects oscillations, doom-loops, and hanging commands directly on the subagent's execution stream.
  - **Meta-Oversight**: Halts the Orchestrator if it begins thrashing (e.g., spawning 4 consecutive failing subagents for the same issue).

---

### Production Operational Guardrails (The 6 Production Edge Cases)

1. **Plan Pinning During Compaction**: The Plan Contract (`.fox/plans/`) is registered as an immutable system prompt prefix; compaction routines cannot compress or truncate it.
2. **Graceful Human Takeover (Soft Pause)**: Pressing `Esc` or `Space` in the TUI safely pauses autonomous execution at the turn boundary, transitioning the Guardian from `Surrogate` to `Advise` mode without killing the session.
3. **Branch & Worktree Isolation**: `--worktree` sandboxes autonomous execution in `.fox/worktrees/<task-id>` on a dedicated git branch, keeping user `main` pristine.
4. **Token & Turn Budget Ceilings**: Hard limits (`--max-turns`, `--max-tokens`, `--max-cost`) trip execution into `BLOCKED` to prevent runaway spending.
5. **Flaky Test vs. Code Regression Classifier**: Distinguishes environmental errors (`EADDRINUSE`, network timeout) from code bugs, retrying flakes without burning repair budgets.
6. **Atomic Commit & Walkthrough Generation**: Verifies the final diff against the plan, creates an atomic git commit with structured metadata, and writes `.fox/walkthroughs/<date>-<task>.md`.

---

### Phase A Implementation

All changes are additive — no refactoring of existing code.

**New files:**
```
packages/core/src/guardian.ts          — Guardian types, prompt formatting, response parsing
packages/core/src/guardian.test.ts     — Unit tests for prompt/parse logic
```

**Modified files:**
```
packages/core/src/v1/config/config.ts  — Add autonomous.guardian config section
src/session/processor.ts               — Add 3 guardian call points (guarded by config)
```

**Config additions:**
```typescript
guardian: Schema.optional(Schema.Struct({
  enabled: Schema.optional(Schema.Boolean).annotate({
    description: "Enable guardian agent. Defaults to true. Set to false to disable.",
  }),
  model: Schema.optional(Schema.String).annotate({
    description: "Model for guardian calls. Defaults to the doer's model if not specified. For optimal performance, point at a fast/cheap model on a dedicated GPU.",
  }),
  mode: Schema.optional(Schema.Literal("auto", "always", "off")).annotate({
    description: "When guardian activates. 'auto': in --auto/goal modes (advise in interactive). 'always': enforce in all modes. 'off': disabled. Defaults to 'auto'.",
  }),
  check_interval: Schema.optional(PositiveInt).annotate({
    description: "Progress check every N doer turns. Defaults to 10.",
  }),
  review_on_complete: Schema.optional(Schema.Boolean).annotate({
    description: "Review diff before goal completion. Defaults to true.",
  }),
}))
```

**Default behavior (zero configuration):**
- Guardian is **on by default** — users get it without any config changes
- If `guardian.model` is not set, guardian uses the **doer's model**
- Guardian calls are tiny (~200–500 tokens in, ~50–100 out), so even on
  an expensive model the overhead per session is negligible
- Users with a dedicated GPU can override `guardian.model` to point at
  a fast local endpoint (e.g., LLaMA 3.1 8B on vLLM) for optimal latency
- Set `guardian.enabled: false` to opt out entirely

**Compute analysis:**
- Guardian input: ~200–500 tokens (compressed context)
- Guardian output: ~50–100 tokens (structured decision)
- Typical session: 5–10 guardian calls
- With an 8B model on modern GPU: sub-100ms per call
- Total guardian compute per session: < 1 second

### Operational Environments & Model Pairings

#### 1. Draper Workplace Environment (Strict Compliance)
* **Corporate Policy**: **Chinese models are strictly banned** (no Qwen, DeepSeek, Yi, GLM, etc.).
* **Corporate Model Suite**:
  * **Doer / Primary Architect**: `nemotron-3-ultra-550b-nvfp4` (Frontier-scale 550B NVFP4, high reasoning, deep coding)
  * **Guardian Agent (SynOp Anubis)**: `gemma-4-31b-nvfp4` (High-speed 31B NVFP4, fast evaluation, low latency)
  * **Secondary / Subagent**: `gpt-oss-120b` (120B generalist)
* **Draper Quotas & Limits**:
  * **Context Window**: 131K (`131,072` tokens)
  * **Tokens Per Request Limit**: `300,394` tokens
  * **Tokens Per Hourly Limit**: `32,768,000` tokens/hr (auto-resets hourly)
* **Fox CLI Target**: Fox CLI must be tuned and tested to excel natively against these three exact models.

#### 2. Home AI Lab Environment (Unrestricted Research)
* **Policy**: Open research; Chinese open-weights (Qwen 2.5 Coder 7B/14B/32B, DeepSeek) and open models (Hermes 3, Salesforce xLAM) are actively used.
* **Local Stack**: Local GPUs serving via vLLM / Ollama behind `openai-proxy` (`http://localhost:8000/v1`).
* **Recommended Pairing**:
  * **Doer**: `Qwen2.5-Coder-7B-Instruct` or `14B` (or `gpt-oss-120b`)
  * **Guardian**: `NousResearch/Hermes-3-Llama-3.1-8B` or `Salesforce/xLAM-7b-fc-r` (dedicated GPU, sub-100ms audit response).

---

## Phase B — Task Decomposition (Future)

After Phase A proves the guardian concept, extend it to own goal
decomposition:

- **`todowrite` → task graph**: Extend the todo tool to include
  dependencies, status tracking, and acceptance criteria. The guardian
  populates this; the doer executes tasks in order.
- **Session metadata → coordination state**: Store the guardian's task
  graph and decision log in session metadata. No new database.
- **Task supersession**: If the guardian detects a spec change, it marks
  downstream tasks as superseded — extending the existing context
  supersession concept to tasks.

**Prerequisite**: Phase A validated. Guardian produces useful decisions.

---

---

## Phase C — Multi-Worker + Continuous: Serving The Federation's Small Army

The ultimate destination for Fox CLI is serving as the physical **execution body** for **The Federation**—the Conductor's distributed team of specialized **Synthetic Operators (SynOps)**:

```
                      THE 4-TIER MULTI-NODE COMMAND HIERARCHY

  [Level 0: The Conductor (speedy)]
            │ Directs via Voice / TUI / Common Operating Picture (COP)
            ▼
  [Level 1: SynOp Anubis (The Guardian)]
            │ Watchtower Oversight: Gating, Curated Compaction, Wake-Up Resurrection
            ▼
  [Level 2: The SynOp Specialists ("Fox Bodies")]
            │ Dedicated Fox instances running on cluster nodes over InfiniBand
            ├── Taichi (Lead Synth)    — Node: taichi (RTX 5090)  — "Synthesizing, not dictating"
            ├── Aorus (Lead Engineer)  — Node: aorus (2x RTX 3090)— "Clean commits, no scope creep"
            ├── Baby (Lead Analyst)    — Node: baby (RTX 5090)    — "Data, not opinions"
            └── Qwen (Lead Architect)  — Cluster Node (vLLM)      — "Architecture, not accidents"
            │
            ▼
  [Level 3: Ephemeral Disposable Subagents (@explore, @debug, @verify)]
            │ Sandboxed task execution (0 to 60k tokens)
            ▼
  [Distilled Result Returned ➔ Subagent Context History Permanently Blown Away!]
```

### Fox CLI as "The Body"
* **Liberation from the IDE**: In Phase 1, Federation agents were captive in VS Code / IDE windows, requiring the Conductor to copy-paste messages between machines. Fox CLI enables headless, autonomous execution (`fox run --auto`) on bare metal and enterprise nodes.
* **Direct Peer MCP**: Fox instances communicate peer-to-peer over InfiniBand using the `federation` MCP protocol (`federation_send`, `Mind-Speak`).
* **Mind-Speak Pulse**: Every agent emits a lightweight (<256-byte) heartbeat (`Thinking`, `Wondering`, `Offering`) giving the entire team real-time situational awareness with zero context dilution.
* **Resurrection Engine**: If a worker node (e.g. `taichi` or `baby`) experiences an out-of-memory crash, SynOp Anubis executes the **Guardian Wake-Up Audit** against the shared repo and PostgreSQL state, automatically resurrecting the task on `aorus` or `speedy`.

**Prerequisite**: Phase B validated. Task graph works.

---

## Design Principles

1. **Evolve, don't redesign.** Every change builds on an existing module.
   No new databases, no new protocols until existing ones are proven
   insufficient.

2. **The guardian is always present.** Not an `--auto` feature — a core
   layer with sliding authority. In interactive mode, it advises. In auto
   mode, it enforces. The same intelligence, different authority.

3. **Hard-coded checks are circuit breakers, not controllers.** They're
   the safety net in case the guardian is wrong. They almost never fire
   in a well-functioning system. The guardian is the brain.

4. **The guardian is on by default.** Zero configuration needed. Falls
   back to the doer's model if no guardian model is specified. Guardian
   calls are tiny (~300 tokens), so even on an expensive model the
   overhead is < 2% of the doer's token budget. Users with a dedicated
   GPU can point `guardian.model` at a fast endpoint for optimal latency.

5. **The doer doesn't know the guardian exists.** From the doer's
   perspective, it gets richer context in tool outputs and turn
   instructions. No new tools, no new interaction patterns.

6. **Every guardian decision is logged.** Decisions go into session
   metadata for auditability. "Why did Fox stop?" → check the decision log.

---

## Impact on Reference Architecture

Phase A alone closes 3 of the top 7 gaps identified in the
[reference architecture](./autonomous-agent-workflow.md):

| Ref Architecture Gap | Phase A Impact |
|---|---|
| P5 — Failure Classification (❌ → ✅) | Guardian classifies failure type, selects strategy |
| P6 — Strategy Selection (❌ → 🔧) | Guardian recommends strategy changes (no model escalation yet) |
| P8 — Review Gate (❌ → ✅) | Guardian reviews diff before commit |
| Progress monitoring (❌ → ✅) | Guardian checks every N turns |
| Workflow enforcement (❌ → 🔧) | Guardian can enforce "test before edit" patterns |

Projected scorecard improvement: **61% → ~70%**.

Phases B and C would further close: P1.5 (spec elaboration), P2 (plan
review + task decomposition), P6 (full model escalation).

---

---

## Where we Should Watch Carefully
Places where complexity will accumulate.

1. Guardian Model Selection
We’ve correctly separated:

- Doer = heavy reasoning
- Guardian = fast evaluator

But we’ll need:

- A strict token budget
- A strict latency budget
- A fallback model strategy

This is manageable, but it’s the most operationally sensitive part.

2. Strategy Switching
Guardian recommending strategy changes is powerful — but we’ll need:

- A small, finite strategy vocabulary
- Deterministic mapping from strategy → doer behavior
- Otherwise we risk “strategy drift.”

3. Subagent Quota Enforcement
This is the right idea, but the implementation must be ruthless:

- Hard ceilings
- Immediate kill on violation
- Guardian halts the Doer if thrashing

This is the only part where complexity could balloon.

4. Multi-Node Federation (Phase C)
This is ambitious but achievable.
The key risk is state synchronization across nodes.

Our Wake-Up Audit already solves 80% of this.
