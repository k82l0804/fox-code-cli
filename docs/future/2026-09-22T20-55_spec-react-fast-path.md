# 🦊 Architectural Specification: ReAct Fast-Path (Single-Turn Speculative Edit)

> **Document Version:** 1.0.0  
> **Date:** 2026-09-22T20:55:00-04:00  
> **Target Subsystem:** `src/session/processor/`, `packages/core/src/tool/`  
> **Reference Benchmark:** [`../2026-09-22T20-40_competitive-agent-benchmark-aider-goose.md`](../2026-09-22T20-40_competitive-agent-benchmark-aider-goose.md)

---

## 1. Problem Statement & Motivation

In our 3-agent competitive benchmark, **Aider resolved Task 3 (Sliding Window Rate Limiter Bug Fix) in 19 seconds**, whereas **Fox took 27.3 seconds across 7 turns**.

### The ReAct Latency Tax
Fox is architected as an unyielding ReAct agent. Even when the target file is small and explicitly identified in the user prompt, Fox routinely executes a multi-turn ceremony:
1. Turn 1: `bash` tool to run failing test suite.
2. Turn 2: `read_file` to inspect target source code.
3. Turn 3: Diagnostic reasoning step.
4. Turn 4: `edit_file` to fix bug 1.
5. Turn 5: `edit_file` to fix bug 2/3.
6. Turn 6: `bash` tool to verify tests pass.
7. Turn 7: Final summary message.

At ~3–4 seconds per LLM HTTP/inference round-trip, this multi-turn overhead imposes an 8–15 second latency tax on simple, localized repairs.

---

## 2. Proposed Architecture: Speculative Mutation with Fallback

The **ReAct Fast-Path** introduces a speculative single-turn mutation pipeline that accelerates localized edits while retaining 100% of Fox's autonomous verification safety.

```
                         ┌────────────────────────────────────────┐
                         │           INCOMING USER PROMPT         │
                         └───────────────────┬────────────────────┘
                                             │
                                             ▼
                               [FastPathClassifier.evaluate]
                               Is it a localized edit with
                               explicit file targets & <10KB context?
                                      │              │
                                     YES             NO
                                      │              │
                                      ▼              ▼
                       ┌─────────────────────────┐  Standard Multi-Turn
                       │ Speculative Turn 1:     │  ReAct Loop (7-9 turns)
                       │ Emit Patch + Auto-Verify│
                       └────────────┬────────────┘
                                    │
                                    ▼
                         [Run Automated Test Gate]
                          Did test runner pass?
                                    │
                         ┌──────────┴──────────┐
                        YES                    NO
                         │                      │
                         ▼                      ▼
                 [Complete in 1 Turn]    [Seamless Fallback to ReAct]
                 TTFT: 15–19 seconds     Context populated with test failure;
                 Cost: 1 turn tokens     agent self-heals in Turn 2.
```

---

## 3. Detailed Component Design

### 3.1 `FastPathClassifier` (`src/session/processor/fast-path.ts`)
Inspects incoming prompt and workspace state before the first agent turn:
- **Criteria for Fast-Path Activation**:
  1. User mentions 1 or 2 specific target files existing in the workspace.
  2. Total size of referenced files is `< 15 KB` (fits safely in working context).
  3. Prompt requests a fix, refactor, or localized modification (not open-ended exploratory research).
  4. Auto-detectable test command exists (`package.json` scripts, `bun:test`, or pytest).

### 3.2 Speculative Turn 1 Execution
When activated, the system:
1. Injects the target file(s) into the turn context as a pinned resource.
2. Prompts the model to synthesize the complete surgical patch in Turn 1 using `apply_patch`.
3. Intercepts the generated patch and applies it to the working tree.

### 3.3 The Zero-Risk Verification Gate
Immediately after applying the speculative patch:
- Fox executes the detected test command non-interactively in the background.
- **Case A (Tests Pass 100%)**: Task completes immediately! The session resolves in **1 turn (~15–18s)**, matching or beating Aider's latency.
- **Case B (Tests Fail or Patch Rejects)**: Fox captures the test failure log, compresses it with LLTC, appends it as the tool output for Turn 1, and continues seamlessly into the standard ReAct self-repair loop in Turn 2.

---

## 4. Performance & Token Impact

| Metric | Standard ReAct (Current) | ReAct Fast-Path (Projected) | Improvement |
| :--- | :---: | :---: | :---: |
| **Turns to Resolution** | 7–9 turns | **1–2 turns** | **-75% turns** |
| **Wall-Clock Latency** | 27.3 seconds | **16–19 seconds** | **35% faster (beats Aider)** |
| **Cumulative Input Tokens** | ~54,800 tokens | **~6,200 tokens** | **88% token reduction** |
| **Regression Safety** | 100% Verified | **100% Verified** | Parity (automatic fallback) |
