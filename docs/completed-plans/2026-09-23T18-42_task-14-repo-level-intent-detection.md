# Task 14: Repo-Level Intent Detection

> **Status**: Ready for implementation
> **Implementer**: Gemini Flash 3.8 High
> **Depends on**: None (builds foundation for Tasks 11 routing decisions)
> **Estimated scope**: Medium — entirely new subsystem, but pure functions with clear boundaries

## Background

Currently, Fox treats all user requests identically: the same model, same tools, same context window strategy. A one-line typo fix and a multi-file architectural refactor both trigger the full-capability doer loop.

The reference architecture ([Phase 1 — Goal Intake](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/future/2026-09-22T15-16_autonomous-agent-workflow.md#L78-L91)) calls for **complexity assessment** and **blast radius estimation** before planning. Task 14 implements the deterministic, heuristic first pass of this capability.

### What Exists Today

- **Goal system** (`src/foxcode/session/goal/`): Tracks `/goal` commands with active/paused/complete/blocked states. Does *not* classify task scope.
- **Verification system** (`packages/core/src/verification.ts`): Runs tests *after* mutations, but doesn't estimate scope *before* acting.
- **Workflow types** (`packages/schema/src/workflow.ts`): `swe | data | research | shell | none | auto`. Already used by agents to declare their operational domain. Not yet used to classify *incoming* tasks.
- **Autonomous config** (`packages/core/src/v1/config/config.ts:375-411`): Configures verification behavior. A natural home for intent detection config.

### What We're Building

A **deterministic intent classifier** that analyzes the text of a user message (and optionally the active file context) to produce a structured scope assessment. This assessment feeds into:
1. **Model routing** (Task 11): Research tasks → cheap models, complex refactors → frontier models
2. **Future Guardian** (Phase 3): Intake gatekeeper decisions about autonomy level
3. **Observability**: Surface scope estimate to the user in the TUI

## Proposed Changes

### New Module: Intent Classifier

#### [NEW] `src/foxcode/intent.ts`

```typescript
/**
 * Repo-Level Intent Detection
 *
 * Classifies task scope from a goal/message description using
 * deterministic heuristics. No LLM calls — pure string analysis.
 *
 * Outputs a structured IntentClassification that downstream
 * systems (model routing, Guardian, TUI) can consume.
 */

/** Scope categories from narrow to broad */
export type TaskScope =
  | "trivial"    // Typo fix, comment addition, formatting
  | "single"     // Single-file bug fix, small feature in one file
  | "multi"      // Multi-file change, moderate refactor
  | "cross"      // Cross-module architectural change
  | "unknown"    // Cannot classify confidently

/** What kind of work the task involves */
export type TaskIntent =
  | "fix"        // Bug fix, error repair
  | "feature"    // New feature, add capability
  | "refactor"   // Restructure without behavior change
  | "research"   // Investigation, explanation, code review
  | "config"     // Configuration, dependency, build changes
  | "test"       // Test creation, test fix
  | "docs"       // Documentation changes
  | "unknown"

export interface IntentClassification {
  /** Primary intent category */
  readonly intent: TaskIntent
  /** Estimated scope / blast radius */
  readonly scope: TaskScope
  /** Confidence 0-1 in the classification */
  readonly confidence: number
  /** Human-readable explanation of the classification */
  readonly reason: string
  /** Suggested minimum model tier for this task */
  readonly suggestedMinTier: import("./model-tier").ModelTier
  /** Whether this task likely needs write tools */
  readonly needsWriteTools: boolean
  /** Pattern matches that drove the classification */
  readonly signals: ReadonlyArray<string>
}

export interface ClassifyInput {
  /** The user's message / goal text */
  readonly message: string
  /** Optional: currently active file path (from IDE context) */
  readonly activeFile?: string
  /** Optional: file paths mentioned in the message */
  readonly mentionedFiles?: ReadonlyArray<string>
}

/**
 * Classify task intent and scope from the user's message.
 * Pure function — no I/O, no LLM calls, deterministic.
 */
export function classifyIntent(input: ClassifyInput): IntentClassification {
  const lower = input.message.toLowerCase()
  const signals: string[] = []

  // 1. Detect intent
  const intent = detectIntent(lower, signals)

  // 2. Detect scope
  const scope = detectScope(lower, input, signals)

  // 3. Derive tier recommendation and write-tool need
  const suggestedMinTier = tierForScopeAndIntent(scope, intent)
  const needsWriteTools = intent !== "research" && intent !== "docs"

  // 4. Confidence: higher when more signals match
  const confidence = Math.min(0.3 + signals.length * 0.15, 0.95)

  return {
    intent,
    scope,
    confidence,
    reason: `${intent}/${scope}: ${signals.slice(0, 3).join(", ")}`,
    suggestedMinTier,
    needsWriteTools,
    signals,
  }
}
```

**Intent detection patterns** (private function `detectIntent`):

| Pattern Group | Matches | Intent |
|---|---|---|
| Fix patterns | `fix`, `bug`, `error`, `broken`, `failing test`, `crash`, `regression`, `issue #` | `fix` |
| Feature patterns | `add`, `implement`, `create`, `build`, `new feature`, `support for` | `feature` |
| Refactor patterns | `refactor`, `restructure`, `rename`, `move`, `extract`, `decouple`, `clean up` | `refactor` |
| Research patterns | `explain`, `how does`, `why`, `investigate`, `review`, `understand`, `find`, `search`, `what is` | `research` |
| Config patterns | `config`, `dependency`, `package.json`, `tsconfig`, `env`, `docker`, `ci`, `deploy` | `config` |
| Test patterns | `test`, `spec`, `coverage`, `assertion`, `mock` | `test` |
| Docs patterns | `document`, `readme`, `jsdoc`, `comment`, `changelog` | `docs` |

**Scope detection patterns** (private function `detectScope`):

| Signal | Scope |
|---|---|
| Mentions 0-1 files or single function/class | `single` |
| Contains `typo`, `comment`, `format`, `lint fix` | `trivial` |
| Mentions 2-4 files or `and` connecting file refs | `multi` |
| Contains `across`, `all files`, `refactor module`, `system-wide`, `architecture` | `cross` |
| Contains `package`, `monorepo`, `cross-package` | `cross` |
| Active file + no multi-file signals | `single` |
| No clear signals | `unknown` |

**Tier mapping** (private function `tierForScopeAndIntent`):

| Scope × Intent | Suggested Min Tier |
|---|---|
| `trivial` × any | `C` |
| `single` × `research` | `C` |
| `single` × `fix`/`test`/`config`/`docs` | `B` |
| `single` × `feature`/`refactor` | `B` |
| `multi` × any | `B` |
| `cross` × any | `A` |
| `unknown` × any | `B` |

### Integration Point: Session Prompt

#### [MODIFY] [`src/foxcode/session/prompt.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/session/prompt.ts)

The classifier should run once when a user message arrives, before the LLM is invoked. The result should be:

1. **Stored on the session context** so downstream systems (model routing, tools, TUI) can access it
2. **Logged** for observability

The integration is lightweight: call `classifyIntent({ message, activeFile })` when building the prompt context. Store the result so `FoxTask.resolveModel` can reference it for routing.

### Integration Point: Task Tool

#### [MODIFY] [`src/foxcode/tool/task.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/tool/task.ts)

When a subagent is spawned, the task description passed to the subagent can also be classified. This provides per-subtask routing granularity (e.g., a research subtask spawned from a refactoring parent session should use a cheaper model).

In `FoxTask.resolveModel`, after checking for explicit overrides, use the classification's `suggestedMinTier` as input to `recommendModelForTask` (Task 11):

```typescript
// If system routing is enabled and no explicit override:
const classification = classifyIntent({ message: input.taskDescription })
// Pass classification.suggestedMinTier to recommendModelForTask
```

### Tests

#### [NEW] `test/intent.test.ts`

Comprehensive unit tests for the pure classifier:

1. **Fix intent detection**: "fix the failing test in auth.ts" → `fix`/`single`
2. **Feature intent detection**: "implement a new caching layer" → `feature`/`multi`
3. **Research intent detection**: "explain how the provider system works" → `research`/`unknown`
4. **Refactor intent detection**: "refactor the model routing across all packages" → `refactor`/`cross`
5. **Trivial scope**: "fix the typo in README" → `fix`/`trivial`, tier C
6. **Multi-file scope**: "update auth.ts, session.ts, and config.ts" → scope `multi`
7. **Cross-module scope**: "refactor the permission system architecture" → scope `cross`, tier A
8. **Active file narrows scope**: message "fix the bug" + activeFile="src/foo.ts" → `single`
9. **Confidence scaling**: more pattern matches → higher confidence
10. **Unknown fallback**: empty message → `unknown`/`unknown`, tier B
11. **Write-tool need**: research → `needsWriteTools: false`; fix → `true`
12. **Tier mapping correctness**: verify all scope×intent combinations produce the documented tier

### Edge Cases

1. **Ambiguous messages**: "look at this and fix it" contains both research and fix signals. The classifier should pick the *strongest* signal (most pattern matches), not the first match.

2. **Compound tasks**: "explain how routing works, then refactor it" has mixed intent. The classifier picks the dominant intent. The Guardian (Phase 3) will handle decomposition — intent detection doesn't need to.

3. **Non-English input**: Pattern matching is English-only. Non-English input gracefully degrades to `unknown`/`unknown` with low confidence. This is acceptable for v1.

4. **Very long messages**: The classifier operates on the full message text. For messages >10K chars, consider truncating to the first 2K for pattern matching (goal descriptions are typically at the top).

## Verification Plan

### Automated Tests
```bash
timeout 30s CI=true bun test test/intent.test.ts
timeout 45s bun run typecheck
```

### Manual Verification
- Verify classifier is a pure function with zero I/O
- Check that the tier suggestions align with the WORKFLOW_TIER_REQUIREMENTS from Task 11
- Confirm no performance regression from running classification on every user message (should be <1ms for string pattern matching)

> **Refinement pass**: Completed 2026-09-23. Audit: TaskIntent (7 values) and TaskScope (5 values) fully enumerated. Tier mapping table covers all scope×intent combinations. Confidence formula explicit. No renames, no state-transition ambiguities. No issues found.
