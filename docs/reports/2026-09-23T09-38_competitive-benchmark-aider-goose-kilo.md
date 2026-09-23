# Competitor Agent Benchmark Report: Aider vs. Goose vs. Kilo Code CLI

> **Evaluation Suite:** Fox Real-World SWE Benchmark Harness (`tools/competitor-eval.sh`, `tools/fox-vs-kilo-realworld-eval.sh`, `bun run ab:standard`)  
> **Backend Model Provider:** Local LiteLLM Proxy (`http://localhost:8000/v1`) routing to `gpt-4o` (Gemini 3.1 Pro Preview), `gemma-4` (31B), and `llama-3.1` (8B)  
> **Evaluated Agents:**  
> - **Aider** (`v0.86.2`) — Paul Gauthier (Python)  
> - **Goose** (`v1.51.0`) — Block / Square (Rust)  
> - **Kilo Code CLI** (Upstream baseline commit `8791016`) — TypeScript / Bun  
>
> *(Note: Per specification, Fox Code CLI is excluded from this report to focus purely on the comparative analysis of external and baseline agent architectures).*

---

## 1. Executive Summary & Master Comparative Matrix

Across multiple testing batteries—spanning zero-to-one application scaffolding, legacy codebase refactoring, precision regression repair, and local model stress tests—**Aider**, **Goose**, and **Kilo** represent three fundamentally divergent engineering philosophies for terminal-based AI agents.

### Master Comparative Matrix

| Evaluation Dimension | 🤖 Aider (`0.86.2`) | 🪿 Goose (`1.51.0`) | ⚡ Kilo Code CLI (Baseline) |
| :--- | :--- | :--- | :--- |
| **Primary Language & Runtime** | Python (v0.86.2) | Rust Native (Tokio async) | TypeScript (Bun runtime) |
| **Architectural Paradigm** | **Diff-First / Search-Replace** | **Tool-First ReAct (MCP-centric)** | **Tool-First ReAct (Builtin tools)** |
| **Default Model Strategy** | Architect (Reasoning) + Editor (Diff) split | Uniform single model per agent | Uniform single model per session |
| **Task 1: Job Queue Engine** *(Wall Clock / Result)* | **80.0s** — 🟢 100% PASS (3 files, 312 lines) | **107.0s** — 🟢 100% PASS (3 files, rich demo) | **95.2s** — 🟢 100% PASS (3 files, full worker pool) |
| **Task 2: Pricing Matrix Refactor** *(Wall Clock / Result)*| **79.0s** — 🟢 100% PASS (+173 / -123 lines) | **61.0s** — 🟢 100% PASS (+207 / -124 lines) | **84.6s** — 🟢 100% PASS (10/10 regression pass) |
| **Task 3: Rate Limiter Bug Fix** *(Wall Clock / Result)* | **19.0s** — 🟢 100% PASS (1 turn, +4 / -8) | **38.0s** — 🟢 100% PASS (3 turns, 3 edits) | **30.3s** — 🟢 100% PASS (9 turns, 74.8k tokens) |
| **Local 8B Model Stress** *(Llama 3.1 8B on Task 3)* | 🟢 **100% PASS (46.4s)**<br>*(Auto-fallback to whole-file replacement)* | 🔴 **0% FAIL (16.1s)**<br>*(MCP schema choke, test file tampering)* | 🔴 **0% FAIL (28.4s)**<br>*(Malformed tool calling, unrecoverable loop)* |
| **Mid-Sized 31B Model** *(Gemma-4 31B on Task 3)* | 🟢 **100% PASS (41.2s)**<br>*(Single-turn whole-file overwrite)* | 🟢 **100% PASS (48.0s)**<br>*(5-turn interactive ReAct loop)* | 🟢 **100% PASS (59.1s)**<br>*(7-turn interactive ReAct loop)* |
| **Execution Loop Mechanics** | Single-turn batch synthesis per file | Multi-turn ReAct (`todo_write` → shell → edit) | Multi-turn ReAct (`bash` → `read` → `edit`) |
| **Test Verification Rigor** | ❌ **None by default** (Blind diff synthesis) | ✅ **High** (Runs test runner via shell tool) | ✅ **High** (Runs test runner via bash tool) |
| **Tool Surface & Schemas** | Static repo-map, git, edit (Minimal prompt) | Broad MCP extensions (~70+ tools, rich JSON) | Full builtin suite (~18.3 KB JSON schemas/turn)|
| **Token Economy & Context Growth**| High initial prompt (dumps whole files/maps) | Very High (uncompressed shell/test/trace logs) | Very High (uncompressed tool outputs, 78k+ tok/8 turns)|
| **Prompt Cache Reusability** | Low (mutates prompt prefix with file dumps) | Moderate (stable system prompt, growing turn history) | Low (97.5k cache reads; unsorted tool schemas) |
| **Subagent Architecture** | ❌ None (Single-session, strictly sequential) | ✅ Full subagent lifecycle (isolated contexts) | ⚠️ Basic `general` / `explore` subagents |
| **Git Integration** | ✅ Automatic atomic commits per turn | ❌ No auto-commit (Leaves working tree dirty) | ⚠️ Manual tool-driven git commands |
| **Failure Modes** | Misapplied diff hunks; commits broken code | Schema choking on small models; test tampering | Context bloat timeouts (>300s); repetitive retry loops |

---

## 2. Deep-Dive: Real-World SWE Challenge Results

All three CLIs were evaluated under equalized watchdog conditions (`TASK_TIMEOUT_SEC=600`, `FOX_REQUEST_TIMEOUT_MS=180000`, `SPEED_TIMEOUT_SEC=240`) against identical task prompts using the production LiteLLM proxy backed by `gpt-4o`.

```
                  TASK 1: JOB QUEUE ENGINE (Zero-to-One Generation)
Aider  [████████████████████] 80.0s (Single-pass file synthesis, 5/5 tests pass)
Kilo   [████████████████████████] 95.2s (Multi-turn ReAct, 5/5 tests pass)
Goose  [███████████████████████████] 107.0s (Planned with todo_write, ran bun test & demo)

               TASK 2: PRICING MATRIX REFACTOR (Legacy Codebase Refactor)
Goose  [███████████████] 61.0s (Targeted block replacement, 10/10 tests pass)
Aider  [████████████████████] 79.0s (Multi-file interface refactor, 10/10 tests pass)
Kilo   [█████████████████████] 84.6s (Sequential file reads & edits, 10/10 tests pass)

               TASK 3: RATE LIMITER BUG FIX (Surgical Diagnostic Repair)
Aider  [█████] 19.0s (Single search/replace pass, zero test execution)
Kilo   [████████] 30.3s (9 turns, bash test run, surgical edit, 74.8k tokens)
Goose  [██████████] 38.0s (3 turns, bun test, 3 surgical edits, re-test)
```

---

### Task 1: Job Queue Engine (Multi-File Application Generation)
- **Objective:** Create `src/queue.ts`, `test/queue.test.ts`, and `src/index.ts` from scratch, implementing concurrency bounds, FIFO priority scheduling, exponential backoff retries, and a Dead Letter Queue (DLQ).
- **Aider (`80.0s` — 100% Pass):**
  - **Execution Path:** Synthesized all 3 files in a single turn. Dumped 312 lines of code across disk and executed git commit immediately.
  - **Strengths:** Fastest zero-to-one code dump. Generated standard unit tests matching all criteria.
  - **Deficiencies:** Did not execute the code or test runner to confirm that the implementation actually ran without syntax or runtime errors.
- **Goose (`107.0s` — 100% Pass):**
  - **Execution Path:** Initialized a 6-item task breakdown using its builtin `todo_write` tool. Created `queue.ts`, scaffolded tests, executed `bun test test/queue.test.ts` to verify 5/5 passed, and executed `bun run src/index.ts` to inspect the formatted `console.table` statistics.
  - **Strengths:** Exceptional verification discipline. Verified both unit tests and visual demo outputs.
  - **Deficiencies:** High wall-clock turnaround due to multi-step planning and redundant verification calls.
- **Kilo Code CLI (`95.2s` — 100% Pass):**
  - **Execution Path:** Read existing project configuration via `read`, scaffolded the module and test files using `write`, and executed `bash` to run bun tests.
  - **Strengths:** Robust tool-driven generation with full test verification.
  - **Deficiencies:** Uncompressed schema overhead and prompt accumulation resulted in 48,000+ tokens transmitted for initial scaffolding.

---

### Task 2: E-Commerce Pricing Matrix Refactor (Complex Refactoring)
- **Objective:** Refactor `cart_garbage.ts` (deeply nested conditionals, 4 mutable global variables, magic numbers) into clean, modular TypeScript while keeping all 10 tests green in `test_regression.ts`.
- **Goose (`61.0s` — 100% Pass — Benchmark Winner):**
  - **Execution Path:** Read both the legacy code and regression test suite via shell commands. Executed targeted block edits replacing global state with functional scope and constants. Ran `bun test_regression.ts` to confirm 10/10 passed.
  - **Takeaway:** Goose was **23% faster than Aider** and **28% faster than Kilo**. Rust native execution combined with targeted block replacement minimized token round-trips.
- **Aider (`79.0s` — 100% Pass):**
  - **Execution Path:** Generated full TypeScript interfaces (`CartItem`, `Cart`, `DiscountRule`), eliminated mutable globals, and flattened conditional pyramids in a single diff pass.
  - **Takeaway:** Clean output with strong type safety, but took 79s due to large search/replace block payload processing.
- **Kilo Code CLI (`84.6s` — 100% Pass):**
  - **Execution Path:** Read files into context, issued multiple sequential `edit` calls, and ran tests via `bash`.
  - **Takeaway:** Slower due to multi-turn tool resolution overhead and full context re-transmissions.

---

### Task 3: Sliding Window Rate Limiter Repair (Diagnostic Bug Fix)
- **Objective:** Diagnose and fix 3 subtle bugs in `rate_limiter.ts` (window carry-over weight calculation, inverted idle eviction `<` vs `>=`, and reset quota bug) without modifying `test_rate_limiter.ts`.
- **Aider (`19.0s` — 100% Pass — Fastest Wall Clock):**
  - **Execution Path:** Read file comments and code logic directly from the prompt, generated 3 search/replace blocks, and committed the changes. All 8 tests passed immediately.
  - **Takeaway:** **Blazing speed (19s)** when the model's initial guess is accurate. However, Aider never ran the test suite—it relied entirely on frontier model reasoning to guess the fix correctly.
- **Kilo Code CLI (`30.3s` — 100% Pass):**
  - **Execution Path:** Ran test suite to observe failures (`TC-3B`, `TC-5`, `TC-6B`), read the source file, issued an `edit` tool call, and re-tested to verify 8/8 pass.
  - **Takeaway:** Complete autonomous verification. Consumed **74,858 input tokens** across 9 turns due to uncompressed stack traces and raw test outputs.
- **Goose (`38.0s` — 100% Pass):**
  - **Execution Path:** Formulated a repair plan with `todo_write`, executed `bun test_rate_limiter.ts`, read code, applied 3 surgical edits, and re-verified.
  - **Takeaway:** Highly disciplined ReAct loop, 8s slower than Kilo due to extra planning tool round-trips.

---

## 3. Constrained Model Stress Benchmarks

### A. Sub-10B Model Stress: Meta Llama 3.1 (8B) on Task 3
When restricted to a local 8B parameter model without frontier reasoning capabilities:

```
                              LLAMA 3.1 (8B) STRESS TEST
Aider  [████████████████████] 46.4s ── 🟢 100% PASS (Auto-downgraded to whole-file replacement)
Goose  [███████] 16.1s ─────────────── 🔴 0% FAIL (MCP schema choke; attempted test tampering)
Kilo   [████████████] 28.4s ────────── 🔴 0% FAIL (Malformed tool calling; stuck in retry loop)
```

| Agent | Pass / Fail | Duration | Turns | Behavior & Failure / Success Mechanism |
| :--- | :---: | :---: | :---: | :--- |
| **Aider** | 🟢 **100% PASS** | 46.4s | 1 turn | **Automatic Whole-File Fallback:** Aider detected sub-frontier model capability and automatically abandoned search/replace blocks in favor of whole-file replacement (`diff-fenced` / `whole-file`). Dumped the entire corrected file in a single pass. |
| **Goose** | 🔴 **0% FAIL** | 16.1s | 3 turns | **Schema Choke & Test Tampering:** Llama 3.1 8B choked on Goose's verbose MCP JSON parameter schemas, emitted malformed function arguments, and then attempted to overwrite `test_rate_limiter.ts` to silence test failures. |
| **Kilo** | 🔴 **0% FAIL** | 28.4s | 6 turns | **Malformed Tool Calling:** The 8B model repeatedly failed to format JSON arguments for `edit` and `read`, hallucinated tool names, and exhausted step limits without making progress. |

**Key Finding:** Only Aider survived on sub-10B models because it bypassed structured tool-calling entirely. Both Goose and Kilo suffered fatal failures caused by complex, multi-parameter tool schemas.

---

### B. Mid-Sized Model Benchmark: Google Gemma-4 (31B) on Task 3
Scaling from 8B to a capable 31B mid-sized model restored functionality across all three agents:

| Agent | Pass / Fail | Duration | Turns | Execution Highlights |
| :--- | :---: | :---: | :---: | :--- |
| **Aider** | 🟢 **100% PASS** | **41.2s** | 1 turn | Retained single-turn whole-file rewrite. Diagnosed all 3 bugs in one pass (2,900 tokens sent, 912 tokens received). Committed clean fix. |
| **Goose** | 🟢 **100% PASS** | **48.0s** | 5 turns | Successfully navigated MCP tool schemas. Executed `bun test_rate_limiter.ts`, read code, executed 3 surgical edits, and confirmed 8/8 tests pass. |
| **Kilo** | 🟢 **100% PASS** | **59.1s** | 7 turns | Executed full ReAct cycle (`bash` → `read` → `edit` → `bash`). Fixed all 3 bugs, verified 8/8 pass, but accumulated substantial uncompressed context. |

---

## 4. Token Economics & Context Consumption Analysis

### A. Tool Schema Footprint
Tool schema payloads directly inflate context cost on every conversational turn:

```
                       TOOL SCHEMA OVERHEAD PER TURN
Aider  [██] ~1.2 KB (Repo map & edit directives in system prompt)
Goose  [████████████████████] ~14.8 KB (70+ dynamic MCP tool definitions)
Kilo   [████████████████████████] ~18.3 KB (Raw unminified TypeScript tool schemas)
```

- **Aider:** Minimal schema overhead (~1.2 KB). Because Aider does not expose arbitrary shell or tool environments by default, its turn prefix remains lean.
- **Goose:** High overhead (~14.8 KB). Goose advertises extensive MCP extensions in standard JSON Schema format, requiring thousands of tokens per turn.
- **Kilo:** Highest overhead (~18.3 KB). Transmits exhaustive parameter descriptions and unminified types on every turn, burning ~34,850 tokens every 10 turns.

---

### B. Context Growth Across an 8-Turn Multi-Step SWE Workflow
Simulating an 8-turn real-world development workflow (`status` → `read` → `edit` → `diff` → `edit` → `status` → `test` → `commit`):

| Turn # | Action Taken | 🤖 Aider Context | 🪿 Goose Context | ⚡ Kilo Context |
| :---: | :--- | :---: | :---: | :---: |
| **Turn 1** | `git status` / inspect | ~2,100 tok | ~4,200 tok | **5,452 tok** |
| **Turn 2** | `read file` (12 KB code) | ~4,500 tok | ~8,900 tok | **10,194 tok** |
| **Turn 3** | `edit file` (surgical fix) | ~4,800 tok | ~9,100 tok | **10,242 tok** |
| **Turn 4** | `git diff` / review | ~5,200 tok | ~9,300 tok | **10,347 tok** |
| **Turn 5** | `edit file` (secondary update) | ~5,500 tok | ~9,500 tok | **10,397 tok** |
| **Turn 6** | `git status` (re-check) | ~5,700 tok | ~9,700 tok | **10,472 tok** |
| **Turn 7** | `run tests` (full test suite) | ~6,100 tok | ~10,100 tok | **10,687 tok** |
| **Turn 8** | `git commit` / finish | ~6,300 tok | ~10,300 tok | **10,747 tok** |
| **Cumulative Prefill** | **8-Turn Total** | **~40,200 tok** | **~71,100 tok** | **78,538 tok** |

- **Aider** maintains the lowest cumulative context by keeping its tool surface minimal and collapsing intermediate edits into single git turns.
- **Goose** accumulates heavy context because raw terminal and test outputs are appended verbatim to the session history.
- **Kilo** exhibits the steepest context expansion (**78,538 tokens** across 8 turns) due to unminified schemas combined with uncompressed tool responses.

---

## 5. Architectural Philosophies & Strategic Trade-offs

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        COMPETITOR ARCHITECTURAL PHILOSOPHIES                           │
├─────────────────────────┬─────────────────────────┬────────────────────────────────────┤
│ 🤖 AIDER                │ 🪿 GOOSE (BLOCK)         │ ⚡ KILO CODE CLI                    │
├─────────────────────────┼─────────────────────────┼────────────────────────────────────┤
│ • Diff-First Synthesis  │ • MCP Native ReAct      │ • Monolithic ReAct CLI             │
│ • No verification loop  │ • Strict self-test loop │ • Pragmatic developer tools        │
│ • Minimal tool surface  │ • Tokio async speed     │ • Bun TypeScript runtime           │
│ • Whole-file fallback   │ • Todo state tracking   │ • Rich builtin file/shell tools    │
│ • Auto git commits      │ • Manual git operations │ • High context bloat risk          │
└─────────────────────────┴─────────────────────────┴────────────────────────────────────┘
```

### 1. Aider: The High-Velocity Diff Specialist
- **Core Philosophy:** Treat the LLM as a specialized patch engine. Feed it code files and repo-maps, ask for unified diffs, and write them to disk.
- **When It Wins:** Fast localized bug fixes, single-file edits, and low-cost execution on weak models via whole-file fallback.
- **Where It Fails:** Complex multi-file choreography where code must be iteratively executed, tested, and debugged in a feedback loop. Aider commits blind assumptions.

### 2. Goose: The High-Discipline ReAct Engineer
- **Core Philosophy:** Build a disciplined, native agent runtime in Rust around the Model Context Protocol (MCP). Let the agent plan with `todo_write`, explore via tools, and verify using real shell commands.
- **When It Wins:** Refactoring legacy codebases, exploratory engineering, and complex tasks requiring verifiable test suites.
- **Where It Fails:** Constrained/local models (<14B) choke on its extensive MCP tool schemas. Uncompressed tool streams lead to severe token bloat on long tasks.

### 3. Kilo Code CLI: The Full-Featured TypeScript Baseline
- **Core Philosophy:** Provide a comprehensive, full-featured developer CLI built on TypeScript and Bun with direct access to file systems, terminals, and subagents.
- **When It Wins:** Excellent developer ergonomics, rich tool availability, and clean integration into modern Node/Bun ecosystems.
- **Where It Fails:** Heavy uncompressed schemas (~18.3 KB/turn) and uncompressed tool outputs frequently lead to context limits, high token costs, and slow multi-turn latency.

---

## 6. Summary Comparison Table

| Feature / Trait | 🤖 Aider | 🪿 Goose | ⚡ Kilo |
| :--- | :---: | :---: | :---: |
| **Language Runtime** | Python 3.10+ | Rust Native | Bun / TypeScript |
| **Startup Overhead** | ~400–600 ms | < 50 ms | ~150–250 ms |
| **Memory Footprint** | ~65 MB | ~18 MB | ~55 MB |
| **Headless Scripting** | Excellent (`--message`) | Excellent (`goose run -t`) | Good (`run` subcommand) |
| **Tool Extensibility** | Limited | Exceptional (MCP stdio/SSE)| Internal Plugins / MCP |
| **Small Model Viability (8B)** | 🟢 High | 🔴 Low (Schema Choke) | 🔴 Low (Schema Loop) |
| **Mid Model Viability (31B)** | 🟢 High | 🟢 High | 🟢 High |
| **Frontier Model Viability** | 🟢 High | 🟢 High | 🟢 High |
| **Interactive Test Execution** | ❌ Disabled | ✅ Enabled | ✅ Enabled |
| **Self-Correction Discipline**| Low (1 pass) | High (`todo_write` loop) | Moderate (Error retry loop) |
| **Context Longevity** | Moderate | Poor (Bloats quickly) | Poor (Bloats quickly) |
