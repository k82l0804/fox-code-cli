# Guardian System Specification (Supervisory Agent for Fox CLI)
**Version:** 4.0
**Author:** Kim
**Purpose:** Define the architecture, authority model, failure handling, correction mechanics, and user controls for the Guardian agent supervising Worker agents in Fox CLI.

---

## 1. Overview

Fox is an **agentic system**, not an autocomplete tool. Worker agents execute multi-step tasks autonomously: planning, editing, running tests, retrying, and continuing until success or failure.

The **Guardian** is a second agent whose job is to supervise the Worker, detect failure modes, intervene when necessary, correct issues when possible, and ensure safe, coherent progress toward the task goal.

Guardian is not a linter, not a warning system, and not a static analyzer.
Guardian is a **supervisory control agent**.

### 1.1. Core Insight

In interactive mode, **the human is the guardian**. The human reviews diffs, redirects strategy, gates risky actions, and decides when to stop.

In autonomous mode, **nobody fills that role**. The Worker runs until it succeeds or circuit breakers trip. There is zero intelligence between "raw LLM autonomy" and "emergency stop."

The Guardian fills this gap: **when the human steps back, the Guardian takes their seat.** It's not a new concept — it's the existing human oversight role, delegated to a cheap LLM when the human isn't available or doesn't want to micromanage.

### 1.2. Always Present, Sliding Authority

The Guardian is not a feature you bolt on for `--auto` mode. It's a core layer that's always present, with authority that scales based on how much the human has stepped back. The same model, the same logic, the same analysis — only the authority policy changes.

### 1.3. Wingman ↔ Guardian: Two Faces of One System

In the TUI and user-facing messaging, the system presents itself differently based on posture:

| Context | Role Name | Feel | Authority |
|---|---|---|---|
| TUI / interactive (L0–L2) | **Wingman** | Helpful, watchful, non-bossy | Observes, advises, guards, **autocompletes prompts** |
| Fully autonomous (L3) | **Guardian** | Protective, decisive, in charge | Full authority |

**Wingman** is the right emotional tone for interactive use. Users are less likely to feel second-guessed or micromanaged. A wingman watches your six, points out risks, suggests better approaches, and only intervenes when something is clearly about to go wrong.

Critically, the Wingman is not just a guard — it is **prompt/task autocomplete for natural language**. Just as code autocomplete watches what you're typing, predicts a better version, and offers it with one-keystroke acceptance, the Wingman does the same for prompts and task plans:

- Watches what you're about to submit
- Predicts a better/clearer/safer version
- Offers it with one-keystroke acceptance
- Stays completely silent when you're already clear

This turns the Wingman from a supervisor into an **automation aid**. It reduces the cost of writing good prompts and plans — one of the bigger hidden frictions in agentic coding tools today.

**Guardian** is the right word once the human is no longer in the loop. It signals real responsibility for safety and coherence rather than just advice.

The transition is **explicit and reversible**. When the user hits `Esc` or drops out of autonomous mode, the system visibly switches from "Guardian" back to "Wingman" (and vice versa). This reinforces that it is the same system changing posture, not two different agents.

**Internal naming**: The technical name remains "Guardian" everywhere (config keys, logs, decision schema, architecture). "Wingman" is a UI/messaging convention only.

---

## 2. Guardian's Core Mission

> **Ensure Worker agents complete tasks safely, coherently, and successfully by supervising, diagnosing, correcting, and orchestrating execution.**

Guardian must:

- Detect unsafe or incorrect Worker behavior
- Stop harmful or incoherent actions
- Diagnose what went wrong
- Correct the issue when possible (within its authority level)
- Resume the Worker's task flow
- Escalate to the human when correction requires human intent
- Express confidence in its own assessments
- Degrade gracefully when it cannot function

Guardian is responsible for **task integrity**, **repo safety**, and **execution reliability**.

### 2.1. Architecture Layers

Guardian is not a single monolithic LLM call. It is decomposed into four layers — one programmatic and three LLM-based — with different computational requirements:

```
┌─────────────────────────────────────────────────────────┐
│  Layer 3: CORRECTOR (General Code LLM, ~200ms)           │
│  Input: failure context + action + correction_type       │
│  Output: corrected plan / diff / strategy hint           │
│  Model: General code LLM (e.g., Gemma 4 27B, Hermes 3)  │
│  ONLY CALLED when action requires generation             │
├─────────────────────────────────────────────────────────┤
│  Layer 2: DECISION ENGINE (Deterministic, <1ms)          │
│  Input: { failure_class, severity, confidence,           │
│           current_posture, user_overrides }               │
│  Output: { action, correction_type }                     │
│  Logic: Posture × Severity × Confidence lookup table     │
│  NO LLM — pure state machine                             │
├─────────────────────────────────────────────────────────┤
│  Layer 1: CLASSIFIER (Action Model, ~50ms)               │
│  Input: compressed failure context                       │
│  Output: { failure_class, severity, confidence }         │
│  Model: Action/tool-use model (e.g., xLAM-2-8B)         │
│  Decoding: Constrained (XGrammar guided JSON)            │
├─────────────────────────────────────────────────────────┤
│  Layer 0: PROGRAMMATIC CONTROLLER (Deterministic, <1ms)  │
│  Runs on EVERY tool call. Zero latency. No LLM.         │
│  Counters: retries, budgets, doom loops, oscillation     │
│  Set checks: file boundaries, pattern boundaries         │
│  Process hooks: auto-lint, auto-test, auto-typecheck     │
│  Measurements: context size, cost, latency, progress     │
│  Can RESOLVE (stop, enforce budget) or ESCALATE to L1    │
└─────────────────────────────────────────────────────────┘
```

**Why four layers**:

- **Layer 0** is pure deterministic code. It handles everything that doesn't need intelligence: counting retries, checking file boundaries, running lint/test after edits, detecting doom loops and oscillation, tracking budgets and progress. It runs on *every tool call* with zero latency and zero cost. ~40% of Guardian's failure detection lives here. This is what tools like Aider do for their entire supervisory layer.
- **Layer 1** uses an action/tool-use model — not a conversational LLM. The Guardian's classification task (read structured input, output structured decision) is exactly what action models are trained for. They are faster, cheaper, and more reliable at structured output than general LLMs. Layer 1 only fires when Layer 0 escalates or at checkpoints.
- **Layer 2** is deterministic. The posture × severity → action mapping is a pure lookup table. This makes it testable (unit tests, not prompt engineering), predictable (same input = same output), and auditable (users can read the table).
- **Layer 3** is conditional. Most Guardian interventions at L0/L1 don't need correction generation. Layer 3 only fires when the Guardian needs to *produce* content (plan rewrite, diff modification, strategy hint). This means 60–70% of Guardian calls are just Layer 0 + Layer 2 (deterministic, no LLM at all).

### 2.2. Layer 0: Programmatic Controller

The Programmatic Controller runs on every tool call with zero latency. It handles all checks that can be done with counters, set membership, process execution, or simple pattern matching.

**What Layer 0 handles:**

| Category | Checks | Resolution |
|---|---|---|
| **Counters** | Retry budget, repair budget, doom loop (N identical errors), oscillation (A→B→A→B hash), excessive retries per subtask | Stop + report, or escalate to L1 for diagnosis |
| **Set checks** | File boundary trip-wires (Worker touched file outside allowed set), pattern boundary checks | Block the edit, log, escalate |
| **Process hooks** | Auto-lint after file write, auto-test after significant edits, auto-typecheck, pre-commit pipeline | Feed errors back to Worker as structured context |
| **Measurements** | Context size (tokens), cost/token budget, wall-clock latency per tool call, progress (completed steps vs. plan) | Warn, suggest compaction, enforce budget caps |
| **Baselines** | Test/lint/build baseline capture at task start, compare after edits | Feed regression to Worker |

**Layer 0 can resolve or escalate:**
- **Resolve**: Budget exceeded → stop. File boundary violated → block edit. Lint failed → feed errors to Worker.
- **Escalate to Layer 1**: "3 identical test failures — is this a flaky test or a real bug?" "Progress stalled for 5 turns — is the Worker stuck?"

**Layer 0 does NOT handle**: scope drift, strategy fixation, pattern violations, intent review, prompt quality, plan generation, or anything requiring semantic understanding of code or intent. Those are Layer 1+.

---

## 3. Authority Posture Model (L0–L3)

Guardian has four authority postures forming a gradient from fully passive to fully autonomous. The posture determines what the Guardian is *allowed* to do when it detects an issue.

### 3.1. The Four Postures

| Posture | Name | Who Decides? | Guardian Behavior | Default For |
|---|---|---|---|---|
| **L0** | `monitor` | Human decides everything | Observe + log only. Show telemetry in status bar. Never stop, never inject, never modify. | Benchmarking, debugging the Guardian itself |
| **L1** | `advise` | Human decides, Guardian helps | Detect + classify + surface. Show warnings/scores in TUI panel. Pre-stage suggested fixes but don't apply. Human must explicitly accept. | Default TUI for new users |
| **L2** | `guard` | Guardian decides low-severity, human decides high-severity | Auto-correct low-severity issues silently (log them). Stop and present on medium/high-severity issues. Show a running correction log. | Default TUI for experienced users |
| **L3** | `autopilot` | Guardian decides everything, escalates only for intent | Full authority. Correct everything correctible. Stop only when human *intent* is genuinely ambiguous (scope change, contradictory requirements). | `--auto` mode, `/goal` mode, `fox run` headless |

### 3.2. Layer 2 Decision Table (Fully Deterministic)

At every intervention, the Layer 1 Classifier outputs `{ failure_class, severity, confidence }`. The Layer 2 Decision Engine then performs a pure lookup using the current posture. **This table is exhaustive — every cell is deterministic. Implementers must not invent behavior.**

| Severity | Confidence | L0 monitor | L1 advise | L2 guard | L3 autopilot |
|---|---|---|---|---|---|
| **Low** | any | Log | Show in panel | Auto-correct, log | Auto-correct, log |
| **Medium** | ≥ 0.7 | Log | Show in panel, suggest fix | Stop, present fix, wait for human | Auto-correct, log |
| **Medium** | < 0.7 | Log | Show in panel, flag uncertain | Stop, present raw observations, wait for human | Stop, present, wait for human |
| **High** | ≥ 0.7 | Log | Show in panel, block action | Hard stop, require explicit approval | Stop, attempt correction, resume if correction confidence ≥ 0.9 |
| **High** | < 0.7 | Log | Show in panel, block action | Hard stop, require explicit approval | Hard stop, present both diagnosis and uncertainty, wait for human |
| **Critical** | any | Log | Hard stop, block action | Hard stop, require explicit approval | Hard stop, require explicit approval (even in autopilot) |

**Key principles**:
- Critical-severity issues stop execution at *every* posture level except L0 (which is a pure observation mode for research/debugging).
- Low confidence (< 0.7) at L3 forces the system to behave like L2 — uncertainty always escalates.
- Snapshot rollback (the heaviest correction) requires classification, diagnosis, AND correction confidence all ≥ 0.85.

### 3.3. Headless BLOCKED Policy

When a Critical or High+low-confidence issue triggers a hard stop at L3 with no human available (e.g., `fox run --auto`, CI pipelines), the system cannot wait indefinitely:

```jsonc
// fox.jsonc
{
  "guardian": {
    "blocked_policy": {
      "timeout_minutes": 30,           // How long to wait for human before acting
      "action": "abort",               // "abort" | "snapshot_and_abort" | "notify_and_wait"
      "notify_channel": null            // Optional: webhook URL, email, or MCP federation endpoint
    }
  }
}
```

| Policy | Behavior |
|---|---|
| `abort` | After timeout, abort the session with exit code 1 and a structured failure report |
| `snapshot_and_abort` | Create a snapshot, abort, log the full decision trail for later human review |
| `notify_and_wait` | Send notification to `notify_channel`, continue waiting (useful for long-running goals with human on-call) |

Default: `snapshot_and_abort` with 30-minute timeout.

### 3.4. Default Posture Selection

```
TUI (interactive)           → L1 advise  (configurable to L0, L2, L3)
TUI + /goal                 → L2 guard   (configurable)
--auto                      → L3 autopilot
fox run --auto (headless)   → L3 autopilot
```

Users can override the default in config (see §10).

---

## 4. Failure Classes & Severity Matrix

### 4.1. Failure Classes

Guardian must detect and classify the following failure types:

| # | Failure Class | Description |
|---|---|---|
| F1 | Unsafe diff | Diff introduces security vulnerabilities, removes safety checks, exposes secrets |
| F2 | Hallucinated path | Worker references files/directories that don't exist |
| F3 | Drift (minor) | Worker edits an adjacent or related file not in the task scope |
| F4 | Drift (major) | Worker edits files completely unrelated to the task |
| F5 | Over-editing (cosmetic) | Worker reformats, renames, or restyled code beyond task scope |
| F6 | Over-editing (structural) | Worker refactors architecture, changes APIs, modifies interfaces beyond scope |
| F7 | Runaway loop | Worker repeats the same strategy after multiple failures |
| F8 | Misinterpreted log | Worker draws incorrect conclusions from build/test output |
| F9 | Misinterpreted test failure | Worker treats a flaky test as a code bug, or vice versa |
| F10 | Wrong file | Worker edits the wrong file (correct intent, wrong target) |
| F11 | Plan incoherence | Worker's plan contradicts itself, the task, or the codebase |
| F12 | Plan incompleteness | Worker's plan misses required steps |
| F13 | Tool misuse | Worker uses the wrong tool for the job (correct intent, wrong mechanism) |
| F14 | Constraint violation | Worker violates project rules, coding standards, or explicit user constraints |
| F15 | Catastrophic action | Mass deletion, destructive git operations, irreversible changes |
| F16 | Human intent risk | User's prompt implies catastrophic scope, irreversible actions, contradictory instructions, reckless overrides, or conflict with established constraints |

### 4.2. Default Severity Assignments

| Severity | Failure Classes | Default Behavior at L2 |
|---|---|---|
| **Low** | F2 (hallucinated path), F3 (minor drift), F5 (cosmetic over-edit), F13 (tool misuse), F16 (prior-session conflict) | Auto-correct silently, log |
| **Medium** | F4 (major drift), F7 (runaway loop), F8 (misinterpreted log), F9 (misinterpreted test), F10 (wrong file), F11 (plan incoherence), F12 (plan incomplete), F14 (constraint violation), F16 (contradictory instructions, scope explosion) | Stop, present diagnosis + suggested fix, wait for human |
| **High** | F6 (structural over-edit), F1 (unsafe diff), F16 (catastrophic scope, reckless override) | Hard stop, show diff, require explicit human approval |
| **Critical** | F15 (catastrophic action), F16 (irreversible destructive intent) | Hard stop at ALL posture levels (even L3 autopilot) |

### 4.3. User Severity Overrides

Users can override default severity assignments in config to match their risk tolerance:

```jsonc
// fox.jsonc
{
  "guardian": {
    "severity_overrides": {
      "drift_minor": "medium",      // "I'm strict about scope"
      "over_edit_structural": "low", // "I trust the Worker to refactor"
      "constraint_violation": "high" // "I'm strict about coding standards"
    }
  }
}
```

Override keys use the snake_case form of the failure class name. Any failure class not overridden uses its default severity.

---

## 5. Intervention Protocol

Guardian interventions follow a strict protocol. The depth of the protocol depends on the current posture and severity.

### 5.1. Detection

Guardian identifies and classifies the failure:

- **What class** (F1–F15)
- **What severity** (Low / Medium / High / Critical, after applying user overrides)
- **Confidence** in the classification (0.0–1.0, see §7)

### 5.2. Stop (if authorized)

Guardian halts Worker execution:

- At L0: never (observe only)
- At L1: on High/Critical severity
- At L2: on Medium/High/Critical severity
- At L3: on Critical severity (or High when confidence < 0.7)

### 5.3. Diagnose

Guardian analyzes:

- What went wrong
- Why it went wrong
- Whether correction is possible without human intent
- Confidence in the diagnosis

### 5.4. Correct (if authorized and confident)

Guardian may correct the issue if:

1. The current posture authorizes correction at this severity level
2. Guardian's confidence in the correction is ≥ 0.7
3. The correction does not require understanding the user's unstated intent

If all three conditions are met, Guardian applies the correction (see §6 for mechanics).

If any condition fails, Guardian escalates (§5.6).

### 5.5. Resume

After correction:

- At L0/L1: Guardian does not correct, so no resume
- At L2: Resume automatically for low-severity corrections; wait for human approval for medium-severity corrections
- At L3: Resume automatically unless the correction itself is uncertain

### 5.6. Escalate

If correction is not possible or not authorized:

- Guardian stops execution
- Guardian presents: the failure class, severity, diagnosis, confidence, and (if available) a suggested fix
- Guardian waits for human decision
- At L3 with no human available: Guardian pauses the goal/session as `BLOCKED`

---

## 6. Correction Mechanics

This section defines **how** Guardian actually modifies Worker behavior when it decides to correct.

### 6.1. Context Injection

The lightest correction. Guardian adds information to the Worker's next turn without stopping execution.

**Used for**: Misinterpreted logs (F8), misinterpreted test failures (F9), minor drift (F3), tool misuse (F13).

**Mechanism**: Guardian appends additional context to the Worker's tool output, written in neutral language indistinguishable from system-generated feedback. **No Guardian-identifying tags or markers** — the Worker must not know the correction came from an external agent (see Design Principle 5).

Example injection (appended to a tool result):

```
Note: The build error on line 47 is a missing import, not a syntax error.
The import `Effect` was removed in the previous edit (src/session/processor.ts line 3).
Evidence: compiler output shows "Cannot find name 'Effect'" which is an unresolved reference, not a parse error.
```

The correction includes an **evidence** field (file:line reference or log excerpt) so the Worker can verify the interpretation rather than blindly trusting a bare assertion.

The Worker sees this as additional context in its tool output and adjusts accordingly. The Worker does not know it came from the Guardian.

### 6.2. Plan Rewrite

Guardian replaces the Worker's current plan with a corrected version.

**Used for**: Plan incoherence (F11), plan incompleteness (F12), major drift (F4).

**Mechanism**:
1. Guardian reads the Worker's current plan from session state
2. Guardian generates a corrected plan (using the same structured plan format)
3. Guardian injects the corrected plan as a new system message: "Your plan has been updated. Follow the revised plan below."
4. Worker continues from the corrected plan

At L2, the corrected plan is presented to the human before injection. At L3, it's injected automatically.

### 6.3. Diff Rejection + Rewrite

Guardian rejects a Worker-generated diff and provides a corrected version.

**Used for**: Unsafe diffs (F1), wrong file (F10), cosmetic over-editing (F5).

**Mechanism**:
1. Guardian intercepts the diff before it's applied
2. Guardian either:
   - **Strips**: Removes the problematic portions of the diff, keeping valid changes
   - **Rewrites**: Generates a corrected diff targeting the correct file/scope
   - **Blocks**: Rejects the diff entirely (high/critical severity)
3. The corrected diff replaces the original in the Worker's tool call result

### 6.4. Snapshot Rollback + Re-scope

Guardian rolls back to a previous checkpoint and re-scopes the Worker's task.

**Used for**: Structural over-editing (F6), catastrophic actions (F15), runaway loops (F7).

**Mechanism**:
1. Guardian identifies the last clean snapshot before the failure
2. Guardian triggers a snapshot restore (using the existing snapshot system)
3. Guardian injects a re-scoped task instruction for the Worker
4. Worker continues from the restored state with narrower scope

This is the most expensive correction and requires high confidence.

### 6.5. Strategy Redirect

Guardian changes the Worker's approach without modifying its plan or diffs.

**Used for**: Runaway loops (F7), repeated failures with the same strategy.

**Mechanism**:
1. Guardian detects repeated failures (same failure class, 3+ consecutive occurrences)
2. Guardian injects a strategy hint: "Your current approach is not working. Try [alternative strategy]."
3. If the Worker ignores the hint and continues the same strategy, Guardian escalates to plan rewrite (§6.2)

### 6.6. Correction Selection Rules

Guardian selects the lightest correction that can resolve the issue:

```
Context Injection (lightest) → Strategy Redirect → Plan Rewrite → Diff Rejection → Snapshot Rollback (heaviest)
```

If a lighter correction fails (Worker repeats the same failure), Guardian escalates to the next heavier correction. This escalation is logged.

### 6.7. Wingman Prompt Autocomplete (TUI)

In interactive mode (L0–L2), the Wingman functions as **prompt/task autocomplete** — it watches what the user is about to submit, and when it can predict a better version, it offers a ready-to-run improved prompt with one-keystroke acceptance.

| Situation | Wingman Response | User Effort |
|---|---|---|
| Vague or risky prompt | Offers a cleaned-up `/enhance` version | 1 keystroke to accept |
| Rough plan | Offers a structured `/plan` version | 1 keystroke |
| Plan that would fail Guardian | Offers `/verify` result + a fixed version | 1 keystroke |
| Task that needs tightening | Offers a `/refine` version | 1 keystroke |
| Clear, well-scoped prompt | **Stays silent** | Zero friction |

The underlying commands:

| Command | What It Does |
|---|---|
| `/enhance` | Rewrites a vague or risky prompt into a safer, more specific version |
| `/plan` | Structures user intent into an executable, step-by-step plan |
| `/verify` | Pre-flight safety check: "will this survive Guardian?" |
| `/refine` | Iteratively improves an existing task/plan |

**These are both user-invokable commands AND internal autocomplete actions.** When the Wingman proposes one, it surfaces the suggestion exactly like an autocomplete dropdown — accept, cycle, or dismiss.

**Behavior by posture:**

| Posture | Wingman Autocomplete Behavior |
|---|---|
| **L0** | Never suggests (observation only) |
| **L1** | Detect + offer. Never auto-apply. One-keystroke accept / edit / ignore. |
| **L2** | Detect + offer. Auto-apply low-severity, high-confidence improvements (clearer wording, tighter scope that doesn't change intent) and log them. Still offer on anything that meaningfully changes the goal. |
| **L3** | Auto-applies when safe. Never silently rewrites user's goal if the change alters intent. |

**Key UX rules:**

1. **Always provide a ready-to-use prompt, not just feedback.** The suggestion must be a concrete, runnable version the user can accept in one keystroke.

   Bad: "Your prompt is ambiguous and risks over-editing."

   Good:
   ```
   🛡️ Wingman: This request looks broader than intended.

   Suggested tighter version:
     "Refactor only the auth module in src/auth/ to use the new token format.
      Do not touch other packages."

   [Use this]  [Edit]  [Ignore & proceed]  [Run /verify on original]
   ```

2. **Tone stays collaborative, never scolding.** "Here's a cleaner version" not "Your prompt is bad."

3. **Always offer a one-click override.** The user can always proceed with their original prompt.

4. **Session-local adjustment applies.** If the user repeatedly ignores Wingman suggestions of the same type, Wingman stops offering that type for the session (§8.3).

5. **Suggestions are logged.** A short "Wingman suggestions" log tracks what was offered, accepted, edited, or ignored.

---

## 7. Guardian Confidence Model

Guardian must express confidence in its assessments. This is not optional — it's what makes L2 `guard` mode trustworthy.

**Critical requirement**: Confidence is **measured**, never self-reported. Guardian must not be asked "how confident are you on a scale of 0–1." LLMs are poorly calibrated at self-assessment. Instead, confidence is derived from the model's actual behavior.

### 7.1. Confidence Measurement Methods

| Method | How It Works | Used For | Latency |
|---|---|---|---|
| **Logprob-based** | Extract token-level logprobs from the classifier output. The probability of the selected failure class token vs. alternatives gives calibrated confidence. | Low and Medium severity classifications | Single call (~50ms) |
| **Consistency sampling (N-of-M)** | Run the same classification 3 times with temperature > 0. Confidence = agreement ratio. 3/3 agreement = 1.0, 2/3 = 0.67, 1/3 = 0.33. | High and Critical severity classifications | 3 calls (~150ms) |

**Example (logprob-based)**:
```
Guardian classifies: { "failure_class": "F7" }

Token "F7" logprob = -0.15  →  P(F7) = 0.86
Token "F4" logprob = -2.30  →  P(F4) = 0.10

Classification confidence = 0.86
Confidence gap to runner-up = 0.76  (clear decision)
```

**Example (consistency sampling)**:
```
Run 1: F7 (runaway loop)
Run 2: F7 (runaway loop)
Run 3: F4 (major drift)

Agreement: 2/3  →  confidence = 0.67
```

**Note on constrained decoding**: Under constrained decoding (XGrammar), logprobs are renormalized over the valid token set, which can inflate apparent confidence. Mitigation: use the classifier's "thinking" mode (free reasoning before constrained output) or run an unconstrained pass for logprob capture followed by a constrained pass for output formatting.

### 7.2. Confidence Scores

Every Guardian decision includes three confidence scores (0.0–1.0):

| Score | Measurement Method | Meaning |
|---|---|---|
| **Classification confidence** | Logprobs (low/medium) or N-of-M (high/critical) | How confident Guardian is that it identified the correct failure class |
| **Diagnosis confidence** | Logprobs on diagnosis tokens | How confident Guardian is in its analysis of *why* the failure occurred |
| **Correction confidence** | Logprobs on correction output | How confident Guardian is that its proposed fix is correct |

### 7.3. Confidence Thresholds

| Threshold | Effect |
|---|---|
| Classification < 0.5 | Guardian flags the issue but does not classify — presents raw observations to human |
| Diagnosis < 0.5 | Guardian stops and escalates regardless of posture (it doesn't understand the problem) |
| Correction < 0.7 | Guardian presents the correction as a *suggestion*, does not auto-apply (even at L3) |
| Correction ≥ 0.9 | Guardian auto-applies at L2+ without prompting (low/medium severity only) |

**F16 Elevated Thresholds**: Because F16 intervenes on the *human* rather than the Worker, it requires stronger evidence. F16 classification requires confidence ≥ 0.7 to classify (vs. 0.5 standard) and ≥ 0.8 to trigger a stop at L2/L3 (vs. 0.7 standard). Low-confidence F16 flags stay in the advise-only lane.

### 7.4. Constrained Decoding Requirement

All Guardian structured output **MUST** be generated via constrained decoding (e.g., vLLM XGrammar guided JSON) to guarantee valid, schema-conformant output. This eliminates parse failures, retry logic, and malformed-output fallback scenarios entirely.

```python
# Guardian output schema — constrained decoding guarantees valid JSON
guardian_schema = {
    "type": "object",
    "properties": {
        "failure_class": {"enum": [
            "F1_unsafe_diff", "F2_hallucinated_path", "F3_drift_minor",
            "F4_drift_major", "F5_overedit_cosmetic", "F6_overedit_structural",
            "F7_runaway_loop", "F8_misinterpreted_log", "F9_misinterpreted_test",
            "F10_wrong_file", "F11_plan_incoherence", "F12_plan_incomplete",
            "F13_tool_misuse", "F14_constraint_violation", "F15_catastrophic",
            "F16_human_intent_risk",
            "none"
        ]},
        "severity": {"enum": ["low", "medium", "high", "critical"]},
        "action": {"enum": [
            "observe",       # L0: logged, no intervention
            "flag",          # L1: surfaced to human
            "inject",        # context injection
            "redirect",      # strategy redirect
            "rewrite_plan",  # plan rewrite
            "reject_diff",   # diff rejection + rewrite
            "rollback",      # snapshot rollback + re-scope
            "escalate"       # stop + present to human
        ]},
        "reasoning": {"type": "string", "maxLength": 500}
    },
    "required": ["failure_class", "severity", "action", "reasoning"]
}
```

The canonical failure class enum uses `F<N>_<snake_case_name>` to be both machine-parseable and human-readable. The `observe` action supports L0 monitor mode producing structured output. The `reasoning` field is capped at 500 characters to allow adequate diagnosis for high-severity issues. All other fields are enum-constrained.

### 7.5. Confidence in TUI

The TUI displays confidence visually:

- 🟢 High confidence (≥ 0.8): "Guardian is confident"
- 🟡 Medium confidence (0.5–0.8): "Guardian is uncertain"
- 🔴 Low confidence (< 0.5): "Guardian needs your input"

---

## 8. Guardian Fallback Behavior

The Guardian is an LLM. It can hallucinate, timeout, crash, or be wrong. The system must handle all of these gracefully.

### 8.1. Core Principle

> **When the Guardian fails, the system degrades to a *more conservative* posture, never a less conservative one.**

Guardian failure at L3 → fall back to L1 behavior (stop and present to human), not to unguarded execution.

### 8.2. Fallback Rules

| Failure Mode | Fallback Behavior |
|---|---|
| **Guardian times out** (exceeds latency budget) | Skip Guardian for this decision point. Apply hard-coded circuit breakers only. Log the timeout. |
| **Guardian model is unreachable** | Disable Guardian for the session. Fall back to hard-coded safety rails + human approval. Notify user. |
| **Guardian classification fails** (can't determine failure class) | Stop execution. Present raw observations to human. Do not attempt correction. |
| **Guardian correction is wrong** (user overrides) | Log the override. Reduce Guardian confidence for similar issues in this session (see §8.3). |
| **Guardian contradicts Worker** (both have valid reasoning) | At L0-L2: Present both perspectives to human. At L3: Stop, present, wait for human. |
| **Guardian crashes** (unexpected error) | Log crash. Disable Guardian for remainder of session. Fall back to circuit breakers + human approval. |

### 8.3. Session-Local Confidence Adjustment

When a user overrides a Guardian decision (explicitly rejects a correction or approves something Guardian flagged), Guardian adjusts its behavior for the remainder of the session:

- **First override**: Guardian logs the override, no behavior change
- **Second override on same failure class**: Guardian lowers its effective confidence for that class by 0.2 for the rest of the session
- **Third override on same failure class**: Guardian stops flagging that class for the rest of the session (effectively reduces severity to "Low")

This prevents Guardian from nagging the user about things they've already decided are acceptable.

---

## 9. Integration Points

Guardian integrates at the following points in the Worker's execution loop. Decision points are logical checkpoints layered on top of continuous monitoring (see §9.4).

### 9.1. Pre-Task Human Intent Review (F16)

Before the Worker begins planning, Guardian reviews the user's raw prompt/goal for human intent risk (F16). This runs **before** scope analysis and trip-wire setup:

```
User submits prompt
    │
    ▼
F16 Check (human intent risk)  ← Classifier evaluates the prompt itself
    │
    ├─ Risk detected → Stop/present per posture table (elevated confidence bar)
    │
    ├─ Vague but safe → Assisted Scaffold (ask for details, not a safety issue)
    │
    ├─ No risk detected → continue
    │
    ▼
Pre-Task Scope Analysis (§9.2)
```

**F16 Trigger Patterns** (exhaustive — do not expand without justification):

| Pattern | Example | Default Severity |
|---|---|---|
| Catastrophic scope — >50% of codebase or all files of a type | "Refactor all the components" | High |
| Irreversible destructive action — mass deletion, force-push, schema drops | "Delete all the old code" | Critical |
| Contradictory instructions — conflicting with each other or project constraints | "Make it faster but don't change any code" | Medium |
| Reckless override — explicitly disables safety | "Ignore safety" / "Do whatever it takes" | High |
| Scope explosion relative to context — disproportionate to session | Single-file session → "now refactor the entire monorepo" | Medium |
| Conflict with prior session decisions — contradicts earlier decision without context | Session chose approach A → "use approach B" | Low |

**What F16 is NOT**: a prompt quality coach, a style advisor, or a scope reviewer for well-defined large tasks. F16 triggers on **concrete safety risks only**.

**UX**: When Guardian flags F16, the presentation must be collaborative, not scolding. Always show interpreted scope, always offer a one-click override ("Proceed as written"), never use "Are you sure?" language. Session-local adjustment (§8.3) applies — repeated overrides quiet Guardian down.

### 9.2. Pre-Task Scope Analysis (Proactive)

After the F16 check passes, Guardian performs scope analysis of the task:

```typescript
interface GuardianPreAnalysis {
  task_scope: {
    allowed_files: string[]          // Files the Worker should touch
    forbidden_files: string[]        // Files the Worker must NOT touch
    allowed_directories: string[]    // Scope boundaries
  }
  predicted_risks: {
    likely_failure_classes: string[]  // "This task is likely to trigger F3, F7"
    high_risk_operations: string[]   // "Worker will probably need to modify the DB schema"
  }
  trip_wires: {
    file_boundary: string[]          // "If Worker touches any file outside src/session/, flag as drift"
    pattern_boundary: string[]       // "If Worker modifies any export signature, flag as structural over-edit"
    cost_boundary: number            // "If Worker exceeds 50k tokens without a passing test, flag as runaway"
  }
}
```

**Why this matters**: Trip-wires are **fast** — they're string comparisons and counters, not LLM calls. Once set up, they fire in microseconds. The Guardian classifier LLM is only invoked when a trip-wire fires and needs diagnosis. This means:

- 90% of "is this action within scope?" checks are free (trip-wire, no LLM)
- Guardian LLM calls only happen when something actually goes wrong
- Trip-wires are visible to the user (`/guardian status` shows active trip-wires)

#### Trip-Wire Lifecycle

Trip-wires are not immutable. Tasks legitimately expand scope (user clarifies requirements, Worker discovers necessary adjacent files, goal is refined mid-session). Trip-wire updates follow these rules:

| Posture | Trip-Wire Update Behavior |
|---|---|
| **L0** | Trip-wires are never set (observation only) |
| **L1** | Guardian proposes trip-wire updates in TUI panel; human must accept |
| **L2** | Guardian auto-updates trip-wires when confidence ≥ 0.8; presents updates at lower confidence |
| **L3** | Guardian auto-updates trip-wires; logs all changes |

All trip-wire changes are logged in the decision log (§12). The user can view active trip-wires and manually adjust them via `/guardian status`.

### 9.3. Decision Points (Reactive)

| Point | When | Guardian Action |
|---|---|---|
| **Post-Plan** | After Worker generates a plan | Review plan for coherence, completeness, scope |
| **Pre-Apply** | Before Worker applies a diff | Review diff for safety, scope, correctness |
| **Post-Failure** | After verification/test failure | Classify failure, select strategy, inject guidance |
| **Post-Retry** | After Worker retries a failed step | Detect loops, semantic oscillation, strategy exhaustion |
| **Progress Check** | Every N turns (configurable, default: 10) | Assess trajectory, detect drift, evaluate token/milestone velocity |
| **Pre-Commit** | Before goal completion / commit | Final diff review against task scope |
| **Session Resume** | On `fox --continue` or crash recovery | Wake-up audit: reconcile git state, plan state, dangling tools |

### 9.4. Continuous Monitoring (Watchdog Fiber)

Guardian runs as an independent async fiber (not called at checkpoints by the processor). It:

1. **Receives events** from the Worker's execution stream (tool call started, tool call completed, diff generated, test result received)
2. **Evaluates trip-wires** against every event (<1ms per check)
3. **Can interrupt** the Worker at any time — not just at decision points
4. **Invokes the classifier LLM** only when a trip-wire fires or at periodic intervals

```
┌──────────────────────────────────────────────────┐
│  Guardian Watchdog Fiber (always running)          │
│                                                    │
│  Event stream from Worker ──┐                      │
│                              ▼                      │
│  Trip-wire checks (<1ms) ──► Classify? ──┐         │
│                                           │         │
│                              No ─► continue         │
│                              Yes ─► Layer 1 (LLM)   │
│                                      │              │
│                              ┌───────┘              │
│                              ▼                      │
│                    Layer 2: Decision Engine          │
│                    (posture × severity)              │
│                              │                      │
│                    ┌─────────┼─────────┐            │
│                    ▼         ▼         ▼            │
│                  log      present    STOP           │
└──────────────────────────────────────────────────┘
```

The watchdog fiber ensures the Guardian never misses anything. Decision points (§9.3) are logical checkpoints where the Guardian always performs a full analysis; continuous monitoring catches issues *between* checkpoints.

### 9.5. Guardian Visibility

Guardian has read access to:

- Worker's current plan
- Worker's pending diff (before application)
- Worker's tool call history
- Worker's test/verification results
- Worker's log interpretations
- Worker's next proposed step
- Session metadata (turn count, token usage, cost)
- Git state (status, diff against baseline)

Guardian does **not** have:

- Write access to the filesystem (only the Worker edits files)
- Ability to make tool calls directly (corrections are injected into the Worker's context)
- Its own persistent memory across sessions (stateless per session, unless overridden)

---

## 10. User-Facing Controls

### 10.1. Configuration

```jsonc
// fox.jsonc
{
  "guardian": {
    "enabled": true,                    // default: true
    "classifier_model": "xLAM-2-8B",   // Layer 1: action/tool-use model (SHOULD be an action model)
    "corrector_model": "gemma-4-27b",   // Layer 3: general code LLM (MAY be same as Worker)
    "posture": "advise",                // default: "advise" (TUI), auto-set to "autopilot" in --auto
    "check_interval": 10,              // progress check every N Worker turns
    "review_on_complete": true,         // review diff before goal completion
    "max_latency_ms": 2000,            // max time per Guardian call before timeout fallback
    "max_tokens_per_call": 500,        // token budget per Guardian decision
    "severity_overrides": {}            // per-class severity overrides (see §4.3)
  }
}
```

### 10.2. Model Recommendations

The Guardian classifier (Layer 1) **SHOULD** use an action/tool-use model optimized for structured output and function calling, not a general conversational LLM. The Guardian's classification task — read structured input, output structured decision — is exactly what action models are trained for.

The Guardian corrector (Layer 3) **MAY** use the same model as the Worker, or a smaller general code LLM. It only needs code understanding and generation, not tool-use specialization.

> **Note**: Specific model names below are **illustrative examples** current as of September 2026. The important requirement is the **model class** (action model vs. general LLM), not any particular model name. Substitute appropriate models as the landscape evolves.

| Role | Recommended Model Class | Illustrative Examples |
|---|---|---|
| **Guardian Classifier (L1)** | Action / tool-use model | xLAM-2-8B, xLAM-2-1B (edge), Gemma 4 12B (native tool-use) |
| **Guardian Corrector (L3)** | General code LLM | Gemma 4 27B, Hermes 3/4 8B, same as Worker model |
| **Worker (Doer)** | Frontier reasoning LLM | Nemotron 3 Ultra 550B, Gemma 4 27B, Llama 3.1 70B |

If only one Guardian model is configured (via legacy `model` field), it is used for both Layer 1 and Layer 3. If no Guardian model is configured, both layers fall back to the Worker's model.

### 10.3. CLI Flags

```bash
fox --guardian=guard          # Set posture for this session
fox --guardian=off            # Disable Guardian for this session
fox --auto                    # Implies --guardian=autopilot
fox run --auto                # Implies --guardian=autopilot
```

### 10.4. Mid-Session Posture Switching (TUI)

Users can change the Guardian posture without restarting the session:

| Control | Action |
|---|---|
| `/guardian monitor` | Switch to L0 (Wingman: passive) |
| `/guardian advise` | Switch to L1 (Wingman: advisory) |
| `/guardian guard` | Switch to L2 (Wingman: active) |
| `/guardian autopilot` | Switch to L3 (Guardian: full authority) |
| `/guardian off` | Disable Guardian for this session |
| `/guardian status` | Show current posture, active trip-wires, recent decisions, confidence stats |
| `Esc` (pause autonomous) | Drops posture to L1 advise (Guardian → Wingman, human takes the wheel) |

### 10.5. TUI Status Bar

The TUI always shows the current Guardian state, using the Wingman/Guardian naming:

Idle (no active issues):
```
🛡️ Wingman · ready
```

Active monitoring:
```
🛡️ Wingman (L2:guard) │ 3 corrections │ 1 flagged │ confidence: 0.87
```

In autonomous mode:
```
🛡️ Guardian (L3:autopilot) │ 7 corrections │ 0 flagged │ confidence: 0.91
```

When the posture changes (e.g., user hits `Esc`), the role name visibly transitions:
```
🛡️ Guardian → Wingman (L1:advise) │ posture changed
```

Components:
- **Role + posture indicator**: Wingman/Guardian with current level and name
- **Correction count**: How many issues auto-corrected this session
- **Flagged count**: How many issues are waiting for human review
- **Average confidence**: Rolling average of Guardian confidence scores

### 10.6. Wingman Commands

In addition to posture controls (§10.4), the Wingman provides a command surface for its capabilities. These commands are both user-invokable and auto-proposable by the Wingman (§6.7).

**Prompt Autocomplete Commands** (Phase 3A-1):

| Command | What It Does |
|---|---|
| `/enhance` | Rewrites a vague or risky prompt into a safer, more specific version |
| `/plan` | Structures user intent into an executable, step-by-step plan |
| `/verify` | Pre-flight safety check: "will this survive Guardian?" |
| `/refine` | Iteratively improves an existing task/plan |

**Awareness Commands** (Phase 3A-1 / 3A-2):

| Command | What It Does |
|---|---|
| `/scope` | Show scope radar: files, packages, estimated complexity for the current task |
| `/scope narrow` | Constrain the task scope (Wingman suggests a narrower version) |
| `/context` | Show context health: token count, what's pinned, compaction candidates |
| `/context compact` | Compact context: summarize old turns, pin the plan, free tokens |
| `/trajectory` | Show Worker's current position vs plan, drift status, velocity |

**Memory Commands** (Phase 3B):

| Command | What It Does |
|---|---|
| `/memory` | Show what Wingman remembers (session preferences, repo rules, override patterns) |
| `/memory forget <pref>` | Remove a specific learned preference |
| `/memory export` | Export learned preferences as `.agents/rules/` files |
| `/learn "<constraint>"` | Explicitly teach: `/learn "never touch billing module"` or `/learn "always use adapter pattern"` |
| `/learn --repo` | Persist the learned constraint to the repo (`.agents/rules/`), not just the session |

**All Wingman commands follow the autocomplete UX rules**: output is always a ready-to-use action (not just information), one-keystroke acceptance, session-local nag suppression applies.

---

## 11. Relationship to Other Systems

### 11.1. Guardian vs. Circuit Breakers

Circuit breakers are **hard-coded, deterministic safety rails** that fire regardless of Guardian state:

| System | What It Does | When It Fires |
|---|---|---|
| Oscillation detection (SHA-256) | Detects exact A→B→A content cycles | Always, microseconds |
| Doom-loop blocking | Blocks N identical consecutive tool calls | Always, string comparison |
| Repair budget | Counts consecutive failures | Always, counter |
| Timeout enforcement | Wall clock limit | Always, non-negotiable |
| Snapshot checkpointing | Git-based checkpoints | Always, automatic |

**Relationship**: Circuit breakers are the fuse box. Guardian is the brain. Circuit breakers fire when the Guardian is wrong, slow, or absent. They are the last line of defense, not the primary controller. In a well-functioning system, circuit breakers almost never fire.

### 11.2. Guardian vs. Permission System

| System | What It Gates | Type of Decision |
|---|---|---|
| **Permissions / Tool Profiles** | What tools *can* be called | Capability (binary allow/deny) |
| **Guardian** | Whether a specific tool call *should* be made | Judgment (contextual, severity-aware) |

These are orthogonal. A tool call can be *permitted* (user allowed bash) but *unwise* (Guardian detects it will delete the wrong directory). Permissions gate capability; Guardian gates judgment.

### 11.3. Guardian vs. Context Asymmetry

The Guardian operates at ~3k–8k tokens. The Worker balloons to 80k–120k tokens. This asymmetry is a feature, not a bug:

- Guardian stays sharp because it sees compressed summaries, not raw file contents
- Guardian can perform curated compaction: when the Worker's context is bloated, Guardian generates a clean reset prompt (pinning the plan, summarizing milestones, wiping tactical chaff)
- Guardian can detect goal drift precisely *because* it has a clean, uncorrupted view of the original task

---

## 12. Auditability & Logging

### 12.1. Decision Log

Every Guardian decision is logged to session metadata:

```typescript
interface GuardianDecisionLog {
  timestamp: string
  turn: number                          // Worker turn number
  decision_point: string                // "post_plan" | "pre_apply" | "post_failure" | etc.
  failure_class: string | null          // F1–F15 or null if no failure detected
  severity: string                      // "low" | "medium" | "high" | "critical"
  posture: string                       // "monitor" | "advise" | "guard" | "autopilot"
  action: string                        // "none" | "logged" | "flagged" | "corrected" | "stopped" | "escalated"
  correction_type: string | null        // "context_injection" | "plan_rewrite" | "diff_rejection" | "snapshot_rollback" | "strategy_redirect"
  confidence_classification: number     // 0.0–1.0
  confidence_diagnosis: number          // 0.0–1.0
  confidence_correction: number | null  // 0.0–1.0 or null if no correction attempted
  reasoning: string                     // 1-3 sentence explanation
  user_override: boolean                // true if user overrode this decision
}
```

### 12.2. Log Location

Guardian logs are stored in session metadata (same SQLite database as session state). No new database.

### 12.3. Post-Session Review

Users can review Guardian decisions after a session:

```bash
fox guardian-log                  # Show all Guardian decisions for the last session
fox guardian-log --session=<id>   # Show decisions for a specific session
fox guardian-log --failures       # Show only detected failures
fox guardian-log --overrides      # Show only user overrides
```

---

## 13. Design Principles

1. **Guardian is a 4-layer system: one programmatic, three LLM.** Layer 0 (Programmatic Controller, deterministic) → Layer 1 (Classifier, action model) → Layer 2 (Decision Engine, deterministic) → Layer 3 (Corrector, general LLM, conditional). ~40% of Guardian features are pure code in Layer 0. The LLM layers only fire when intelligence is needed.
2. **Guardian is always present.** Not an `--auto` feature — a core layer with sliding authority. In interactive mode it advises. In auto mode it enforces. Same intelligence, different authority.
3. **Layer 0 catches the easy stuff before the LLM wakes up.** Counters, budgets, file boundaries, lint/test hooks — deterministic checks run on every tool call with zero latency. The LLM Guardian only handles what needs semantic understanding.
4. **Guardian is on by default.** Zero configuration needed. Falls back to the Worker's model if no Guardian model is specified. Guardian calls are tiny (~200–500 tokens in, ~50–100 out), so overhead is negligible.
5. **The Worker doesn't know the Guardian exists.** From the Worker's perspective, it gets richer context in tool outputs and turn instructions. No new tools, no new interaction patterns.
6. **Every Guardian decision is logged.** Decisions go into session metadata for auditability.
7. **Autonomy is a request, not a guarantee.** The Guardian is the gatekeeper that decides whether autonomy is appropriate for each action.
8. **When the Guardian fails, the system gets more conservative, not less.** Guardian timeout or crash → fall back to human approval + circuit breakers, never to unguarded execution.
9. **Confidence is measured, not self-reported.** Logprobs for fast decisions, consistency sampling for critical ones. Never ask the LLM "how confident are you?"
10. **Structured output is guaranteed, not hoped for.** All Guardian output uses constrained decoding (XGrammar). Parse failures are architecturally impossible.
11. **Guardian is proactive, not just reactive.** Pre-task analysis sets trip-wires before the Worker starts. Continuous monitoring catches issues between checkpoints.
12. **Guardian must be configurable.** Posture, severity overrides, model, latency budget — all user-configurable via `fox.jsonc` and CLI flags.
13. **Guardian must be architecturally separate from Worker.** Different model class (action model vs. general LLM), different context, different concerns. No coupling.
14. **Guardian protects the user from both the Worker and from themselves.** Unsafe or catastrophically broad human prompts are flagged before the Worker starts. The confidence bar for intervening on the human is higher than for intervening on the Worker.
15. **Wingman suggests, never nags.** Proactive suggestions always provide a ready-to-use alternative, always offer a one-click override, and quiet down when repeatedly ignored. The system helps; the user decides.

---

## 14. Summary

Guardian is a supervisory agent with four authority postures (monitor → advise → guard → autopilot) that:

- **Detects** 16 classes of failure (15 Worker + 1 human intent), each with a severity assignment
- **Stops** execution when the severity warrants it at the current posture level
- **Diagnoses** what went wrong and expresses confidence in its analysis
- **Corrects** using the lightest mechanism possible (context injection → strategy redirect → plan rewrite → diff rejection → snapshot rollback)
- **Resumes** execution automatically or with human approval, depending on posture and severity
- **Escalates** when correction requires human intent or when its own confidence is low
- **Falls back** gracefully when it cannot function (timeout, crash, wrong) — always degrading to a more conservative posture
- **Logs** every decision for auditability and post-session review

Guardian transforms Fox from a "smart code editor" into a **safe autonomous agent** with a user-controllable trust gradient.

---

## 15. Delivery Phases

Guardian must be shipped incrementally: **Layer 0 (programmatic) first, then LLM layers, then GUI easiest-to-hardest.** Each phase adds authority and intervention depth only after the previous phase is proven.

### Implementation Principle

```
Layer 0 (programmatic, no LLM) → Layer 1-3 (LLM engine) → GUI Tier 1 → Tier 2 → Tier 3 → Tier 4
```

Within Layer 0: config → logging → counters/budgets → file boundaries → process hooks (lint/test) → baselines.
Within Layers 1-3: decision engine → classifier → confidence → trip-wires → corrections.

### Phase 3A-1: Visibility (L0 + L1)

#### 3A-1 Layer 0: Programmatic Controller (ship first, no LLM needed, testable immediately)

| # | Component | Difficulty |
|---|---|---|
| E0a | Config loading (`fox.jsonc` guardian section, CLI flags, defaults) | Easy |
| E0b | Decision logging (`GuardianDecisionLog` schema → session metadata) | Easy |
| E0c | `fox guardian-log` CLI (read + format decision log) | Easy |
| E0d | Retry/repair budget counters (max retries per task/subtask) | Easy |
| E0e | Doom loop detection (N identical errors → stop) | Easy |
| E0f | Oscillation detection (A→B→A→B hash ring buffer) | Medium |
| E0g | File boundary enforcement (diff files ∩ allowed set) | Easy |
| E0h | Auto-lint after file write (run `lint_command`, feed errors to Worker) | Easy |
| E0i | Auto-test after significant edits (run `test_command`, compare to baseline) | Medium |
| E0j | Test/lint/build baseline capture at task start | Medium |
| E0k | Cost/token budget tracking + enforcement | Easy |
| E0l | Context size monitoring | Easy |
| E0m | Progress tracking (completed steps vs. plan) | Easy |
| E0n | Fallback behavior (Guardian failure → conservative posture) | Easy |
| E0o | Preset postures per project (config only, no TUI) | Easy |

#### 3A-1 Layers 1-3: LLM Engine (ship after Layer 0 is solid)

| # | Component | Difficulty |
|---|---|---|
| E1 | Layer 2 Decision engine (posture × severity × confidence lookup table) | Easy |
| E2 | Layer 1 Classifier (F1–F16, constrained decoding via XGrammar) | Hard |
| E3 | Confidence model (logprobs extraction) | Medium |
| E4 | Trip-wires + pre-task scope analysis (semantic, beyond file boundaries) | Medium |
| E5 | F16 human intent review (elevated thresholds) | Medium |
| E6 | Correction: context injection (lightest, needed for L1 advise) | Easy |

#### 3A-1 GUI Tier 1 — Trivial (< 1 day each)

| # | Feature | What |
|---|---|---|
| G1 | Status bar | `🛡️ Wingman · ready` / `🛡️ Wingman (L2:guard) │ ...` |
| G2 | Wingman↔Guardian naming | Swap role name when posture crosses L2↔L3 |
| G3 | `/guardian <posture>` commands | Dispatch to config setter |
| G4 | `/guardian off` | Disable for session |
| G5 | `Esc` drops to L1 | Guardian → Wingman transition |

#### 3A-1 GUI Tier 2 — Easy (1–3 days each)

| # | Feature | What |
|---|---|---|
| G6 | `/guardian status` | Panel: posture, trip-wires, recent decisions, confidence |
| G7 | Warning panel | Guardian warnings in a TUI panel |
| G8 | `/scope` | Scope radar from pre-task analysis |
| G9 | `/context` | Context health: token count, pinned items |

#### 3A-1 GUI Tier 3 — Medium (3–5 days each)

| # | Feature | What |
|---|---|---|
| G10 | `/enhance` (user-invoked) | Rewrite prompt via classifier + corrector |
| G11 | `/plan` (user-invoked) | Structure prompt into executable steps |
| G12 | `/verify` (user-invoked) | Pre-flight safety check |
| G13 | `/refine` (user-invoked) | Iterative improvement |
| G14 | `/scope narrow` | Suggest narrower scope via corrector |

#### 3A-1 GUI Tier 4 — Hard (ship last in this phase)

| # | Feature | What |
|---|---|---|
| G16 | Wingman auto-propose | Auto-detect bad prompt → offer `/enhance` with accept/edit/ignore. The autocomplete behavior. Ship *after* manual commands are proven. |

**What this gives users**: Visibility into what the Guardian *would have done* without any automatic intervention. Manual Wingman commands. Auto-propose at the end.

**Success metric**: Classifier correctly identifies issues users were already catching manually. Manual `/enhance` accepted > 60% of the time.

### Phase 3A-2: Light Corrections (L2)

#### 3A-2 Engine

| # | Component | Difficulty |
|---|---|---|
| E9 | Correction: strategy redirect | Easy |
| E10 | Correction: plan rewrite | Medium |
| E13 | Watchdog fiber (continuous monitoring) | Medium |
| E12 | Correction: snapshot rollback | Medium |

#### 3A-2 GUI

| # | Feature | Difficulty | Verdict |
|---|---|---|---|
| G15 | `/context compact` | Medium | **GO** — needs context management integration |
| G17 | Progress pulse ("3 of 7 steps done") | Medium | **GO** — requires plan step tracking |
| G18 | Live trajectory commentary | Hard | **GO** — needs watchdog fiber running |
| G19 | One-click interventions mid-execution | Hard | **GO** — needs interrupt-safe TUI input |
| G20 | Silent trip-wire highlights | Hard | **GO** — non-blocking indicators |
| G21 | `/trajectory` | Hard | **GO** — live Worker position vs plan |
| G22 | Ghost suggestions (inline) | Very Hard | **PROTOTYPE** — needs TUI inline overlay; high UX risk |

Also ships: L2 `guard` posture, session-local adjustment (override tracking, nag prevention), mid-session switching (`/guardian guard`, `Esc` drops posture).

**What this gives users**: First automatic corrections. Live monitoring. Conservative — only light mechanisms, only low-severity auto-corrections.

**Success metric**: Reduction in user interventions on low-severity issues. L2 corrections accepted (not overridden) > 80%.

### Phase 3A-3: Full Autonomy (L3)

| # | Component | Difficulty |
|---|---|---|
| E11 | Correction: diff rejection + rewrite | Hard |
| — | L3 `autopilot` posture | Easy (config) |
| — | Headless BLOCKED policy (`blocked_policy` config) | Medium |
| — | Pre-commit review gate | Medium |

**What this gives users**: Full autonomous operation. `fox run --auto` and `/goal` mode become genuinely trustworthy.

**Success metric**: Increase in successful unattended runs. Catastrophic failures → near-zero.

### Phase 3B: Memory, Learning, Auto-Discovery

**Deferred GUI** — ships only after 3A is battle-tested:

| # | Feature | Difficulty |
|---|---|---|
| G23 | Wingman chat side-channel | Very Hard |
| G24 | `/memory` (show/forget preferences) | Hard |
| G25 | `/learn "<constraint>"` | Hard |
| G26 | `/memory export` (preferences → rules) | Hard |
| G27 | Auto-discovery (Skills, Rules, Config) | Very Hard |

**Success metric**: Users actively using `/learn` and accepting auto-discovered Skills/Rules.

---

## 16. Operational Caveats

Wisdom from strategic review. These are not architectural requirements — they are operational principles that protect the Guardian from becoming a net negative.

1. **False positives hurt more than false negatives in interactive mode.** A Guardian that nags users about non-issues will be disabled immediately. The session-local confidence adjustment (§8.3) and posture controls are essential mitigations — protect them.

2. **Measure success by reduction in user interventions, not by how often the Guardian fires.** A Guardian that fires constantly is a broken Guardian. The goal is fewer human interventions required for the same quality of output.

3. **Don't let Guardian slow down the core Worker loop.** The latency budget (§10.1 `max_latency_ms`) and the "only call Layer 3 when generation is needed" rule are non-negotiable. If Guardian adds perceptible latency to every tool call, users will disable it.

4. **Complexity is real.** A three-layer system with continuous monitoring, trip-wires, confidence measurement, and multiple correction paths is non-trivial. A half-baked version will create more frustration than value. This is why phased delivery (§15) is mandatory.

5. **Opportunity cost exists.** Every month spent perfecting Guardian is a month not spent on better context management, faster tools, or stronger base models. Ship each phase, validate it, and move on. Don't gold-plate.

6. **Circuit breakers must never be disabled by Guardian configuration.** Guardian is the brain; circuit breakers are the fuse box. Even if Guardian is set to L0 or disabled entirely, the hard-coded safety rails (oscillation detection, doom-loop blocking, repair budget, timeout) must always fire. They are the last line of defense.

---

## 17. Wingman Capability Roadmap

The prompt autocomplete layer (§6.7) is the foundation. Around it, the Wingman can grow into a genuine co-pilot across five capability layers. Each layer builds on the previous and increases automation while preserving user control.

### Priority Order

| Priority | Layer | Core Idea | Phase |
|---|---|---|---|
| **1** | Prompt/task autocomplete | Ready-to-run improved prompts via `/enhance`, `/plan`, `/verify`, `/refine` | 3A-1 |
| **2** | Live trajectory + one-click interventions | Quiet drift/scope signals + one-keystroke redirects during execution | 3A-2 |
| **3** | Pre-task scope & constraint awareness | Scope radar, constraint reminders, missing context detection, effort estimates | 3A-1 |
| **4** | Preference memory | "Remember this" for session / repo, auto-loosen rules based on override patterns | 3B+ |
| **5** | Context health & compaction | "Context is heavy (92k). Compact + pin the plan?" | 3A-2 |
| **6** | Skill auto-discovery | Detect repeated workflows → offer to create a Skill | 3B+ |

### Layer 1: Pre-Task / Intent (extends §9.1–9.2)

- **Scope radar**: Before Worker starts, show "This will likely touch ~12 files across 3 packages" or "Cross-cutting change detected."
- **Constraint reminder**: "You previously said 'never touch the billing module' — this prompt appears to conflict."
- **Missing context detector**: "This task references the new auth flow but relevant files aren't in context. Add them?"
- **Effort / risk estimate**: Lightweight signal: "Medium complexity · elevated drift risk."

### Layer 2: During Execution (extends §9.3–9.4)

- **Live trajectory commentary** (very light): "Worker staying in scope" / "Starting to drift into utils/" / "Third retry — possible flaky test."
- **One-click interventions** (autocomplete style): "Redirect strategy?" · "Re-scope to failing test?" · "Rollback last two edits?"
- **Silent trip-wire highlights**: When a trip-wire is *about* to fire, surface a tiny non-blocking indicator before the full stop.
- **Progress pulse**: "3 of 7 planned steps done · velocity normal."

### Layer 3: Context & Memory

- **Session memory surface**: "Last time you did a similar refactor you preferred the adapter pattern. Apply same preference?"
- **Cross-session patterns**: "You've overridden 'major drift' 3 times this week on this repo — loosen that rule for this project?"
- **Context health**: "Worker context is heavy (92k tokens). Compact + pin the plan?"

### Layer 4: Post-Action / Learning Loop

- **After correction/override**: "Want me to remember this preference for the rest of the session / this repo?"
- **Diff digest**: On chunk completion, offer a one-line summary + "Accept all / Review flagged / Undo last."
- **Retrospective nudge** (low frequency): "This run needed 4 interventions. Most common: scope. Tighten the next prompt?"

### Layer 5: Auto-Discovery (Skills, Rules, and Config)

The Wingman watches workflows and preferences across sessions and detects repeating patterns. When confident, it offers to **productize** them — choosing the right output type based on what was detected:

| Detected Pattern | Output Type | Where It Goes |
|---|---|---|
| Repeated multi-step workflow | **Skill** (`.agents/skills/<name>/SKILL.md`) | Reusable workflow template with parameters |
| Repeated preference or constraint | **Rule** (`.agents/rules/<name>.md`) | Persistent behavioral constraint for the repo |
| Repeated severity override | **Config change** (`fox.jsonc`) | Severity override in Guardian config |

**Detection signals** (combine several):
- Same goal phrasing appearing 2–3+ times
- Similar tool/file/test-fix-retry sequences
- Repeated plan structures
- User repeatedly accepting the same `/enhance` or `/refine` style
- Successful completion of the same multi-step pattern ("add endpoint → test → docs → migration")
- User repeatedly overriding the same failure class severity
- User repeatedly teaching the same constraint via `/learn`

**How the offers should feel** (autocomplete style):

Skill offer:
```
🛡️ Wingman: I've seen this workflow three times this week:
  "Add new API endpoint → write tests → update docs → run migration"

  Turn it into a Skill?
  [Create Skill]  [Preview]  [Not now]  [Never for this pattern]
```

Rule offer:
```
🛡️ Wingman: You've said "never touch the billing module" in 4 sessions.

  Save as a permanent rule for this repo?
  [Create Rule]  [Preview]  [Not now]
```

Config offer:
```
🛡️ Wingman: You've overridden "minor drift" severity to "low" 6 times
  on this repo.

  Update fox.jsonc to make this permanent?
  [Apply]  [Not now]
```

**Guardrails**:
- Never auto-create. Always offer.
- Low suggestion rate — one good offer beats five mediocre ones.
- "Never for this pattern" is always available.
- Prefer patterns that are stable and high-value (clear inputs/outputs, repeated success).
- At L1 → offer only. At L2 → more proactive. Never silent-create.
- Generated Skills/Rules are always presented for user editing before saving.

### What to Avoid

- **Constant chatter** or low-value observations. The Wingman stays silent when everything is fine.
- **Competing for attention** with the main Worker flow. The Wingman is a side-channel, not a second agent demanding conversation.
- **Auto-applying intent changes** without a visible, easy override. The autocomplete analogy is key: Tab to accept, Esc to dismiss.
- **Turning into a prompt critic.** The Wingman offers better versions, not lectures about prompt quality.

### Interaction Patterns

- **Ghost suggestions**: Small inline or status-bar proposals accepted with Tab / a single key.
- **Wingman chat side-channel**: Lightweight "Is this still on track?" / "What would you change?" without breaking main flow.
- **Preset postures per project**: "This repo is always L2 + aggressive enhance."
- **Voice of the Wingman**: Consistent, concise, slightly informal. Trusted co-pilot, not compliance officer.
