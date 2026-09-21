# 🦊 Fox Code CLI — Competitive SWE Agent Audit & Architectural Feature Roadmap

> **Document Version:** 1.2.0  
> **Status:** Strategic Architectural Plan  
> **Target Package:** `fox-code-cli` (`@fox/cli`)  
> **Target Audience:** Core Contributors, Systems Engineers, SWE Agent Researchers  
> **Reference Specification:** [`../../docs/competitive-analysis.md`](../../docs/competitive-analysis.md)

---

## 🧭 Executive Strategy: The Fox Philosophy of Lean Intelligence

Fox Code CLI’s philosophy is uncompromising: **speed, precision, and zero-friction agency.**

We build an agent that behaves like a world-class engineer running locally on your machine — nimble enough to respond instantly, disciplined enough to avoid hallucinations, and efficient enough to squeeze every millisecond and token out of the hardware.

Our brand stands for **lean intelligence**:
- **No bloated abstractions**: No heavy runtimes, no multi-gigabyte container dependencies for basic edits, no sprawling daemon architectures.
- **No gratuitous features**: Capabilities must demonstrably improve developer velocity or agent accuracy.
- **No cloud-scale overhead**: Zero telemetry beacons, zero remote catalog lookups on startup, 100% offline-first autonomy.

### The Ruthless Performance Filter

When evaluating any competitor capability, Fox applies three non-negotiable filters:

```
                      ┌──────────────────────────────────────┐
                      │    CANDIDATE COMPETITOR FEATURE      │
                      └──────────────────┬───────────────────┘
                                         │
                                         ▼
                 [Filter 1: KV-Cache Prefix Stability]
                 Does it mutate the system prompt prefix
                 across turns and bust KV-cache discounts?
                         │                     │
                        YES                    NO
                         │                     │
                         ▼                     ▼
               Convert to ON-DEMAND      [Filter 2: TTFT & Overhead]
               TOOL (Zero prefix bloat)  Does it add >5ms to startup
                                         or block event loop?
                                               │              │
                                              YES             NO
                                               │              │
                                               ▼              ▼
                                          Decouple to    [Filter 3: State Safety]
                                          Async Worker   Does it pollute user
                                          / MCP Sidecar  git log or workspace?
                                                              │            │
                                                             YES           NO
                                                              │            │
                                                              ▼            ▼
                                                         Shadow Git    Native Fox
                                                         Snapshots     Inclusion
```

### The "Tool-First Over Prompt-First" Law

A defining anti-pattern in modern AI coding agents (such as Cursor, Windsurf, or naive Aider configurations) is **passive prompt stuffing**: packing 5,000–15,000 tokens of file outlines, active tabs, git statuses, and directory trees into the system prompt on *every turn*.

This causes two severe performance failures:
1. **Destroys KV-Cache Reuse**: Changing context at the prompt prefix forces models to re-evaluate the entire prefix, losing the 50%–75% cost and latency discount of prompt caching.
2. **Degrades Time To First Token (TTFT)**: The model must process thousands of irrelevant input tokens before generating the first byte of code.

**The Fox Resolution (Tool-First):**
- **No passive repo maps in the system prefix.**
- **No passive symbol graphs in the system prefix.**
- **No passive architectural summaries in the system prefix.**

Instead, capabilities are exposed as **high-precision, on-demand tools** (`lookup_symbols`, `fetch_repo_map`, `search_index`). The agent pays tokens **only when its reasoning step explicitly requires them**. The prompt prefix remains byte-identical, deterministic, and cache-stable.

---

## 🏛️ The 13-Agent Competitive Landscape

To construct an authoritative audit, we categorize the competitive landscape into four operational archetypes:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               SWE AGENT ARCHETYPES                                     │
├─────────────────────────┬─────────────────────────┬────────────────────────────────────┤
│ 1. Terminal / CLI       │ 2. IDE-Integrated       │ 3. Container & Virtual Machine     │
│   • Fox Code CLI        │   • Cursor (Composer)   │   • OpenHands (Docker Sandbox)     │
│   • Aider               │   • Windsurf (Cascade)  │   • Devin (Cloud VM)               │
│   • Claude Code         │   • Continue.dev        ├────────────────────────────────────┤
│   • Goose (Rust)        │   • Cline / Roo Code    │ 4. Minimalist & Enterprise Bounds  │
│   • SWE-agent (ACI)     │   • GitHub Copilot WS   │   • Void (Pure Model / Minimal)    │
│                         │                         │   • Amazon Q (Corporate Baseline)  │
└─────────────────────────┴─────────────────────────┴────────────────────────────────────┘
```

### Competitor Roster Profiles

| Agent | Creator / Backing | Primary Execution Model | Defining Strength | Critical Vulnerability |
| :--- | :--- | :--- | :--- | :--- |
| **🦊 Fox CLI** | Open Source | Bun + Effect TS (ACP Server + TUI) | **LLTC (-52% to -76% tokens), sub-5ms startup, byte-stable KV cache** | Newer ecosystem; needs expanded autonomous tool suite |
| **Aider** | Paul Gauthier | Python CLI (Terminal Solo) | Tree-Sitter Repo Map (~1k tokens), turn git commits | Monolithic Python CLI; mutates prefix; commits intermediate broken states |
| **Claude Code** | Anthropic | Node.js CLI (Terminal Solo) | Native prompt caching, Anthropic model tiering | Cloud-locked to Anthropic API; lossy `/compact` truncation; raw tool streams |
| **Goose** | Block / Square | Rust CLI / Desktop | Native speed; first-class MCP extensibility | Generalist agent; lacks specialized SWE diff/lockfile/test compression heuristics |
| **SWE-agent** | Princeton NLP | Python / Research CLI | Agent-Computer Interface (ACI), paged file viewing | Academic focus; slow execution; high token cost without LLTC |
| **Cursor** | Anysphere | Custom VS Code Fork | Fast Apply speculative streaming, shadow workspace | Proprietary editor lock-in; passive context bloat (10k+ tokens); closed index |
| **Windsurf** | Codeium | Custom VS Code Fork | "Cascade Flow" real-time cursor/tab awareness | Heavy IDE overhead; proprietary cloud telemetry; closed ecosystem |
| **Continue.dev** | Continue Open Source | VS Code / JetBrains Ext. | Local-first, highly configurable model routing | Primarily an assistant/autocomplete; lacks deep autonomous multi-turn loops |
| **Cline / Roo Code** | Open Source Community | VS Code Extension | Strict Human-In-The-Loop approvals, Puppeteer browser | High token consumption; UI-centric; lacks native high-performance CLI |
| **Copilot Workspace** | GitHub / Microsoft | Web / Cloud Service | GitHub Issue → Spec → Plan → PR pipeline | Slow cloud turnarounds; rigid step phases; no local offline inference |
| **OpenHands** | Open Source Community | Docker / Python / Web UI | Full Linux container isolation; multi-agent loops | Gigabyte Docker overhead; slow startup (>30s); heavy memory footprint |
| **Devin** | Cognition | Cloud Virtual Machine | Long-horizon planning checklists; persistent execution | Expensive SaaS ($500+/mo); cloud-only; opaque reasoning; high latency |
| **Void** | Open Source Community | Open Source Cursor Fork | Absolute minimalism, direct LLM piping, zero bloat | Minimal agentic capability; leaves indexing/tooling burden entirely to model |
| **Amazon Q** | AWS | IDE Extension / CLI | Corporate IAM compliance, AWS ecosystem hooks | Extreme corporate bloat; sluggish latency; weak reasoning on non-AWS code |

---

## 📊 Master Comparative Audit Matrix: 20 Landmark Capabilities

Evaluation legend:
- **`YES (Tool-First)`**: High-value feature; implemented as an active on-demand tool (not passive prompt bloat).
- **`SHADOW-ONLY`**: Kept isolated from the user's active workspace/git tree to prevent pollution.
- **`ADAPTED`**: Re-architected to fit Fox's Bun/Effect TS runtime and sub-5ms envelope.
- **`SUPERSEDED`**: Fox already has a superior, more efficient mechanism.
- **`REJECTED`**: Violates Fox's lean intelligence creed (cloud bloat, telemetry, or useless overhead).

| # | Capability | Pioneer / Exemplar | Mechanism & Purpose | Verdict for Fox | Architectural Adaptation & Performance Impact |
| :-: | :--- | :--- | :--- | :---: | :--- |
| **1** | **AST Repo Map** | Aider | Tree-sitter AST symbol graph + PageRank packed into ~1k tokens | **YES (Tool-First)** | Expose as `fetch_repo_map` / `lookup_symbols` in [`packages/fox-indexing`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/fox-indexing/). Kept **out** of the prefix. 0 token cost until queried. |
| **2** | **Turn Git Commits** | Aider | `git commit` to current branch after every prompt turn | **SHADOW-ONLY** | **Never commit to user branch.** Fox's shadow [`Snapshot.Service`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/snapshot/index.ts) already snapshots every turn for instant `/undo` via [`src/session/revert.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/revert.ts). |
| **3** | **Prompt Caching** | Claude Code | Server-side KV cache preservation across turns | **SUPERSEDED** | Fox enforces **deterministic sha256 prefix stability** locally across all OpenAI/Anthropic/LiteLLM backends, achieving up to 75% cache discount. |
| **4** | **Lossy Context Summarization** | Claude Code (`/compact`) | Truncates history and rewrites summary when context fills | **ADAPTED** | Prefer **LLTC** first (-52% to -76%). Fox already implements render-time turn-supersession (`FOX_EXPERIMENTAL_COMPRESS_SUPERSEDE`) to prune stale tool reads before resorting to lossy compaction. |
| **5** | **Subshell Daemon Execution** | Claude Code | Long-running background processes (servers, watchers) | **YES (Adapted)** | Wrap via Effect TS fibers and `AppProcess` with explicit timeouts and background task handles. Non-interactive only. |
| **6** | **Speculative Fast Apply** | Cursor | Accelerated multi-file diff application via small speculative model | **ADAPTED** | Fox's native Bun patch engine [`apply-patch.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/tool/apply-patch.ts) already resolves all targets, reads sources, and derives content before writing — effectively a prepare-then-apply pipeline. Enhance with dry-run validation (see Blueprint 6). |
| **7** | **Modular Rule Files** | Cursor (`.cursorrules`) | Workspace-specific guidelines and behavioral constraints | **SUPERSEDED** | Already supported via `.agents/rules/` and `AGENTS.md` with hierarchical precedence and zero prefix mutation. |
| **8** | **Live Editor Flow Tracking** | Windsurf (Cascade) | Streams active cursor position, open files, scroll position | **ADAPTED** | ACP client ([`fox-acp-client`](file:///home/k82l0804/workarea/fox/fox-acp-client/)) transmits debounced/batched metadata (150ms window) to prevent streaming jitter. |
| **9** | **Native MCP Client** | Goose | Dynamic tool discovery via Model Context Protocol stdio/SSE | **YES (Adapted)** | Dynamic tool registry via [`registry.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/tool/registry.ts). Lazy-load schemas to prevent prompt bloat. |
| **10** | **Human-In-The-Loop Approval Gates** | Cline / Roo Code | Modal prompt asking user permission before dangerous bash/edit | **YES (Configurable)** | Risk-tiered execution via [`PermissionV2.Service`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/permission/): read-only tools auto-approved; destructive bash requires user confirmation. |
| **11** | **Headless Browser Automation** | Cline / Devin | Puppeteer/Playwright browser automation for web/app verification | **YES (MCP Sidecar)** | **Do not bundle Chromium into Fox CLI binary.** Expose via optional decoupled MCP sidecar worker with strict network/domain security. |
| **12** | **Containerized Sandbox** | OpenHands | Executes all bash commands inside heavy Docker containers | **ADAPTED** | Reject heavy Docker daemons. Use lightweight OS sandboxing (Linux Bubblewrap / macOS Seatbelt) via [`packages/sandbox`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/sandbox/). |
| **13** | **Agent-Computer Interface (ACI)** | SWE-agent | Specialized file navigation tools (view with line-slice, paged grep) | **SUPERSEDED** | Built into Fox's [`read`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/tool/read.ts), [`grep`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/tool/grep.ts), and [`glob`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/tool/glob.ts) tools with line-range clipping and token ceilings. |
| **14** | **Lint & Test Auto-Feedback** | Aider / SWE-agent | Runs test suite immediately after edit; feeds errors back to agent | **YES (Core SWE)** | Critical for autonomous phase: automated test runner invokes project tests; uses LLTC test filter (`filterTestOutput`) to strip passing noise and pass only failure traces. |
| **15** | **Long-Horizon Checklists** | Devin | Persistent markdown/state checklist updated per sub-task | **SUPERSEDED** | Fox already ships [`todowrite`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/tool/todowrite.ts) backed by [`SessionTodo.Service`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/session/) in SQLite. Enhance with cross-session persistence (see Blueprint 7). |
| **16** | **Architect / Coder Split** | Aider (Architect mode) | Dual-model orchestration: Reasoning model plans, fast model edits | **YES (Optional)** | Profile-driven (`--profile architect`). Reasoning model outputs structured edit plan; fast local model generates code diffs. |
| **17** | **Local LLM Drop-In** | Continue.dev | Transparent routing to Ollama, LM Studio, vLLM, LiteLLM | **SUPERSEDED** | Native Fox foundation: full offline independence via OpenAI-compatible endpoints with hardened connection timeouts (30s). |
| **18** | **Corporate IAM & Telemetry** | Amazon Q | AWS SSO, central audit logs, telemetry beacons | **REJECTED** | 100% stripped. Fox transmits zero telemetry, zero analytics, and operates completely private to the developer's workstation. |
| **19** | **Zero-Tool Model Purity** | Void | Pure LLM chat with no system tools or agentic overhead | **REJECTED** | Incompatible with autonomous SWE. Coding requires compiler feedback, file verification, and deterministic execution. |
| **20** | **Speculative Plan-and-Apply** | Copilot Workspace | Generates multi-file plan draft, shows visual diff before applying | **YES (ACP Client)** | ACP protocol streams proposed patch sets to editor client (`fox-acp-client`) for multi-file visual diff review before committing to disk. |

---

## 🛠️ Deep-Dive Architectural Blueprints for Fox CLI

### Blueprint 1: Scalable Tool-First AST Indexing (`@foxcode/indexing`)

#### The Scalability Challenge
In large monorepos (e.g. 50,000+ files across TypeScript, Rust, and Python), in-memory symbol graphs keyed to git tree hashes face severe memory bloat and cold-start parsing delays.

#### The Fox Solution: Incremental SHA256 File-Level Caching
Instead of re-indexing the tree on every commit or holding the entire graph in RAM:
1. **SQLite Symbol Store**: Symbol definitions are persisted in SQLite (`packages/effect-drizzle-sqlite` / `~/.local/state/fox/ast-cache.db`).
2. **File SHA256 Keying**: On project scan, Fox hashes individual files (`git ls-files -s`). Files whose SHA256 has not changed are skipped completely.
3. **Incremental Tree-Sitter Parser**: Only modified files are re-parsed into ASTs using WASM Tree-Sitter grammars.
4. **On-Demand Querying**: The model queries symbols via `lookup_symbols` or `fetch_repo_map` tools. No symbol tokens are pushed to the prompt prefix.

```
┌────────────────────────────────────────────────────────┐
│                   Fox Runtime (Bun)                    │
│                                                        │
│  [Prompt Prefix]                                       │
│  • System Identity (byte-stable sha256)                │
│  • Standard Tool Definitions                           │
│    (NO 1k-token repo map blob in prefix!)              │
│                                                        │
│  [Agent Execution Loop]                                │
│  Model: "I need to locate where UserAuth is defined."  │
│  Calls: lookup_symbols({ query: "UserAuth" })          │
│                                                        │
│  [Tool: packages/fox-indexing/src/ast.ts]              │
│  • SQLite Symbol Table (keyed by file sha256)          │
│  • Incremental WASM Tree-Sitter                        │
│  • Returns: exact symbol signature & line number       │
│                                                        │
│  [Compressed Result Returned to Model]                 │
│  auth/service.ts:42: interface UserAuth { ... }        │
│  (Tokens consumed: 45 tokens vs 1,024 tokens every turn)│
└────────────────────────────────────────────────────────┘
```

#### TypeScript Implementation Contract

```typescript
// packages/fox-indexing/src/ast-tool.ts
import { Schema, Effect } from "effect"
import { Tool } from "@opencode-ai/core/tool/tool"

export const LookupSymbolsInput = Schema.Struct({
  query: Schema.String.annotate({ description: "Symbol name, function, class, or interface to locate" }),
  kind: Schema.optional(Schema.Literal("class", "function", "interface", "type", "method")),
  directory: Schema.optional(Schema.String),
})

export const LookupSymbolsTool = Tool.make({
  name: "lookup_symbols",
  description: "Locate symbol definitions, function signatures, and interface declarations across the repository using AST index without reading entire files.",
  parameters: LookupSymbolsInput,
  execute: (input) =>
    Effect.gen(function* () {
      const indexer = yield* AstIndexService
      const matches = yield* indexer.query(input.query, input.kind)
      // Return compressed one-line signatures
      return matches.map(m => `${m.filePath}:${m.line}: ${m.signature}`).join("\n")
    }),
})
```

---

### Blueprint 2: Shadow Git Checkpoints vs. Active Commits

#### The Problem with Competitors
Aider runs `git commit` to the user's active branch after every single prompt turn. If an agent produces non-compiling code or a partial refactor on turn 2 of 5, the user’s git history is polluted with junk commits, breaking bisectability and CI triggers.

#### The Fox Solution: Zero-Pollution Shadow Snapshots
Fox maintains a private git repository stored under `~/.local/share/fox/snapshot/<project-id>/` ([`src/snapshot/index.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/snapshot/index.ts#L91)). 

- **Every turn is snapshotted in the shadow store.**
- **The user's working branch `.git` remains 100% clean.**
- **Rollback (`fox undo` or `/revert`) is instant (<10ms)** by reapplying patches from the shadow store via [`src/session/revert.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/revert.ts).
- **Atomic Task Commits**: When an entire multi-turn autonomous goal completes and tests pass, Fox prompts:
  ```text
  ✔ Task Complete: Rate limiter bug fixed and verified across 4 unit tests.
  Would you like to commit these changes to your branch?
  Suggested Commit: fix(rate-limit): prevent token leak on sliding window reset
  [y) Commit  b) Commit to new branch  n) Leave uncommitted in working tree]
  ```

---

### Blueprint 3: Autonomous Verification Loop & Deadlock / Oscillation Defense

#### The Problem with Competitors
Autonomous agents frequently fall into three disastrous failure modes:
1. **Infinite retry loops**: Blindly repeating failing edits without changing strategy.
2. **Oscillating fixes**: Reverting lines edited two turns ago to fix error A, which triggers error B, which prompts reverting back to error A.
3. **Blast-radius regression**: Fixing one unit test in a sub-module while silently breaking four unrelated modules.

#### The Fox Solution: Compressed Feedback & Loop Defense Engine

```
┌────────────────────────────────────────────────────────┐
│            AUTONOMOUS VERIFICATION CYCLE               │
├────────────────────────────────────────────────────────┤
│ 1. Agent applies edit via `edit` or `apply-patch`      │
│ 2. Fox runs fast pre-flight check (tsc / test suite)   │
│ 3. If tests FAIL:                                      │
│    • Run Oscillation Detector:                         │
│      - Has this line/hunk been toggled in last 2 turns?│
│      - If YES: Inject STRATEGY DEADLOCK WARNING        │
│    • Run Blast-Radius Detector:                        │
│      - Did previously passing tests break elsewhere?   │
│      - If YES: Inject REGRESSION ALERT                 │
│    • Apply Fox Lossless Test Filter:                   │
│      - Strip all passing test lines                    │
│      - Relativize absolute paths                       │
│      - Retain ONLY the exact stack trace & failure line│
│    • Feed compressed trace into next self-healing turn │
│ 4. Apply Render-Time Turn Supersession:                │
│    - Prune stale file reads & obsolete git status from │
│      earlier turns in LLM context                      │
│ 5. If tests PASS:                                      │
│    • Present verified solution to user                 │
└────────────────────────────────────────────────────────┘
```

**Token Savings**: Raw test outputs often span 200–500 lines (3,000+ tokens). Fox's test filter reduces this to ~25 lines (250 tokens), saving **90%+ tokens per repair turn**.

---

### Blueprint 4: Multi-Model Routing Policy Engine

#### The Escalation & Downgrade State Machine
Fox implements a deterministic model router to balance cost, latency, and reasoning power:

```
                  ┌───────────────────────────────┐
                  │    USER PROMPT / TASK START   │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                   [Complexity Classifier (<1ms)]
                   • Single-file edit / bugfix?
                   • Multi-file refactor / architectural?
                                  │
                   ┌──────────────┴──────────────┐
                   │                             │
              (Simple / Local)             (Architectural)
                   │                             │
                   ▼                             ▼
       [Fast Coder Model]               [Architect Model]
     (Claude 3.5 Haiku /              (Claude 3.7 Sonnet /
      DeepSeek-Coder / Qwen)           o3-mini)
                   │                             │
                   ▼                             ▼
           Executes Edits                 Generates Structured Plan
                   │                             │
                   ▼                             ▼
           Runs Tests & Typecheck         Delegates to Fast Coder
                   │
         ┌─────────┴─────────┐
         │                   │
      (Pass)              (Fail)
         │                   │
         ▼                   ▼
    Task Complete     [Self-Healing Loop]
                      Attempt 1-2: Fast Coder
                      Attempt 3: ESCALATE to Architect
```

#### Routing Rules:
1. **Default to Speed**: Single-file changes and isolated bugfixes start on the fast coder model.
2. **Escalate on Deadlock**: If the fast model fails tests twice consecutively, automatically escalate the failing context and trace to the high-reasoning architect model.
3. **Structured Handoff**: The architect produces a strict JSON change-spec; the coder executes unified diffs.

---

### Blueprint 5: Repo-Level Intent Detection (Zero-Prefix Bloat)

#### The Problem with Cursor & Windsurf
Cursor and Windsurf continuously stream active editor state into the prompt prefix: open editor tabs, cursor line/column, scroll position, and recent selections. This fills 2,000–5,000 prefix tokens with ephemeral telemetry, continuously invalidating KV cache.

#### The Fox Solution: Compact Execution Context
Instead of streaming continuous editor state into the prompt prefix:
1. **Lightweight Context Slot in Turn Input**: Fox tracks three localized intent signals:
   - `last_edited_file`: The most recent file mutated by the user or agent.
   - `last_touched_symbol`: The function or interface under the user's cursor.
   - `last_failing_command`: The most recent failed test or build command.
2. **Injected at the Tail**: These three fields are rendered in the *user message boundary* (the turn tail), **never in the system prompt prefix**.
3. **KV-Cache Impact**: Zero. The prefix remains 100% byte-identical.

---

### Blueprint 6: Multi-File Patch Ranking & Conflict Detection

#### Building on the Existing Patch Engine
Fox's [`apply-patch.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/tool/apply-patch.ts) already implements a **prepare-then-apply** pipeline: it resolves all targets, reads source files, computes derived content, and only then writes to disk sequentially. However, today a failure at hunk N leaves hunks 1..N-1 already applied (the tool explicitly reports "Patch partially applied").

This blueprint upgrades the engine to full transactional safety:
1. **Dry-Run Validation**: All patch hunks across all files are validated against in-memory buffers before any disk writes occur.
2. **Confidence Scoring**: Each hunk reports match quality (exact, whitespace-normalized, or fuzzy context match) so the agent can prioritize high-confidence edits.
3. **Conflict Detection**: If multiple hunks target overlapping line ranges within the same file, the engine detects the dependency and re-sequences application order.
4. **All-or-Nothing Transaction**: If any hunk fails dry-run validation, **zero files are touched**, and a precise line-level mismatch is returned to the agent — eliminating the current "partially applied" failure mode.

---

### Blueprint 7: Long-Horizon Project Memory (`@foxcode/memory`)

#### Existing Foundation
Fox already ships a mature memory system in [`packages/fox-memory`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/fox-memory/src/index.ts) with:
- **`MemoryTool.recall()`**: Multi-mode search (`typed`, `digest`, `search`, `catalog`) across project-level memory and session digests.
- **`MemoryTool.save()`**: `remember`, `correct`, `forget`, and `skip` actions for durable project knowledge.
- **Markdown-backed storage**: Structured files (`project.md`, `corrections.md`) with session digest summaries.

#### What This Blueprint Adds: Cross-Session Architectural Continuity
The current memory system stores typed key-value entries well, but lacks explicit categories and cross-session discovery for architectural constraints:
- **Structured Categories**: Formalize memory into `architectural_decisions`, `testing_conventions`, and `style_preferences` schemas that the agent can query by topic.
- **Session Continuity**: When the agent starts a new session on the same project, automatically inject a compact memory summary (~200 tokens) at the user turn tail (not the prefix) listing key constraints and recent corrections.
- **Decision Conflict Detection**: If a new `remember` contradicts an existing entry (e.g. "use Axios" vs. existing "never introduce Axios"), surface the conflict before saving.

---

### Blueprint 8: MCP Sidecar Security Sandbox

#### Safe Headless Browser & Network Extensibility
When running web verification or headless browsers (Puppeteer/Playwright):
1. **Out-of-Process Execution**: Browsers run in a separate MCP sidecar process, never compiled into the main Fox CLI binary.
2. **Domain Allowlists**: Configurable network egress restrictions (e.g. `localhost`, `127.0.0.1`, specific staging URLs).
3. **Ephemeral Profiles**: Browser sessions run with isolated temporary profiles wiped cleanly after each turn.
4. **Resource Quotas**: Hard process caps on RAM (max 1GB) and execution timeout (max 30s) to prevent zombie Chromium instances.

---

### Blueprint 9: Editor Latency & Debounced ACP Streaming

#### Eliminating Context Streaming Jitter
When Fox acts as an ACP server to VS Code ([`fox-acp-client`](file:///home/k82l0804/workarea/fox/fox-acp-client/)):
- **150ms Sliding Debounce**: Rapid cursor movements and tab switching are debounced into a single metadata update.
- **Priority Channel Separation**: Text edit events use high-priority channels; background telemetry or symbol lookups use low-priority background queues.
- **No Event Loop Blocking**: Heavy AST scans run in worker threads, ensuring the ACP JSON-RPC channel responds in <1ms.

---

### Blueprint 10: Local Process Sandboxing (`@foxcode/sandbox`)

#### The Problem with Competitors
OpenHands requires a heavy Docker daemon running multi-gigabyte containers. This causes:
- 30-second container startup overhead.
- Huge RAM usage (>4GB).
- Inability to run smoothly on developer laptops or remote lightweight servers.

#### The Fox Solution
Instead of heavy virtualization, Fox leverages native OS-level lightweight isolation in [`packages/sandbox`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/sandbox/):
- **Linux**: Namespaces & Bubblewrap (`bwrap`) restricting write access exclusively to the target workspace.
- **macOS**: `sandbox-exec` with Seatbelt profile policies.
- **Overhead**: **<1 millisecond** initialization; 0 MB additional disk storage.

---

## ⚠️ Risks, Limitations & Open Engineering Questions

No strategic plan is complete without an honest accounting of what could go wrong.

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **Tree-sitter WASM grammar coverage gaps** | Some languages (e.g. HCL, Nix, Zig) lack mature WASM grammars. Symbol queries return empty results. | Graceful degradation: fall back to regex-based grep search for unsupported languages. Track grammar coverage table in docs. |
| **AST SQLite cache corruption** | Corrupted cache produces stale or wrong symbol results. | Keyed by file SHA256 — any mismatch triggers full re-parse. Add `fox index --rebuild` CLI command. Cache is purely advisory. |
| **Routing policy misjudges complexity** | A "simple" edit actually requires architectural reasoning, burning 2 failed fast-model turns before escalating. | Bounded cost: max 2 wasted turns (configurable). The escalation ceiling prevents runaway token spend. |
| **Oscillation detector false positives** | Aggressive deadlock detection may abort a valid iterative refinement cycle. | Make sensitivity configurable (`autonomous.oscillation_threshold`). Default to 2-turn window; allow power users to increase. |
| **Bubblewrap / Seatbelt platform fragility** | macOS deprecates `sandbox-exec`; Linux distributions ship varying namespace capabilities. | Abstract behind [`packages/sandbox`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/sandbox/) with runtime capability detection and graceful fallback to unsandboxed execution with user warning. |
| **MCP sidecar version drift** | External MCP servers may break protocol compatibility across updates. | Pin MCP protocol version in tool registry; validate handshake on connection; fail fast with clear error rather than silent corruption. |
| **Memory bloat over long-lived projects** | Months of `remember` entries accumulate, consuming excessive tokens when recalled. | Enforce token budget on recall output (currently capped at `CATALOG_MAX_BYTES = 8192`). Add TTL-based pruning and relevance scoring. |

---

## ⚙️ Future Configuration Schema (`fox.jsonc` Extensions)

All future capabilities are strictly modular, optional, and governed by user configuration. The schema below shows **proposed extensions** to `fox.jsonc` — new keys that would be added alongside Fox's existing configuration surface (model providers, agents, permissions, etc.).

> **Note**: Fox's existing config schema is defined in [`src/foxcode/config/config.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/config/config.ts). The keys below are additive proposals and must be validated against the current schema before implementation.

```jsonc
{
  // --- PROPOSED EXTENSIONS (additive to existing fox.jsonc schema) ---

  // Codebase Intelligence & AST Indexing (NEW)
  "indexing": {
    "ast_provider": "tree-sitter",       // "tree-sitter" | "off"
    "cache_storage": "sqlite",           // "sqlite" (SHA256 file-keyed) | "memory"
    "max_symbol_results": 25
  },

  // Version Control & Snapshot Extensions (NEW keys alongside existing snapshot config)
  "snapshot": {
    // Note: Fox already has `"snapshot": false` to disable snapshots.
    // These extend the existing snapshot configuration:
    "task_branch_prefix": "fox/",        // Used only when --task-branch flag is explicitly set
    "prompt_commit_on_success": true     // Offer atomic commit dialog when task passes all tests
  },

  // Autonomous SWE Execution Rails (NEW)
  "autonomous": {
    "max_self_healing_turns": 3,         // Max test-fail retry loops before consulting human
    "auto_lint": true,                   // Run project linter after edits
    "test_command": null,                // null = auto-detect from package.json; or explicit command
    "detect_oscillations": true,         // Abort if same code hunk toggled in last 2 turns
    "oscillation_threshold": 2,          // Number of turn-toggles before triggering deadlock warning
    "detect_regressions": true           // Alert if edits break previously passing tests
  },

  // Model Routing & Escalation Engine (NEW)
  "routing": {
    "enabled": false,                    // Off by default; activated via --profile architect
    "fast_model": null,                  // Falls back to configured default model
    "reasoning_model": null,             // Falls back to configured default model
    "escalate_after_failures": 2         // Escalate to reasoning model after N consecutive test failures
  },

  // Security & Sidecar Sandbox Policies (NEW)
  "security": {
    "sandbox_backend": "auto",           // "bubblewrap" (Linux) | "seatbelt" (macOS) | "off" | "auto"
    "browser_egress_allowlist": ["localhost", "127.0.0.1"]
  }

  // Note: memory configuration already exists via @foxcode/memory.
  // Note: compression is already governed by FOX_EXPERIMENTAL_COMPRESS* env flags.
  // Note: workflow profiles extend the existing agent/model configuration.
}
```

---

## 🗺️ Phased Implementation Roadmap

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        FOX CLI IMPLEMENTATION ROADMAP                                  │
├─────────────────────────┬─────────────────────────┬────────────────────────────────────┤
│ Phase 1: Near-Term      │ Phase 2: Autonomous SWE │ Phase 3: Advanced Sandboxing       │
│ Q4 2026                 │ Q1 2027                 │ Q2 2027                            │
├─────────────────────────┼─────────────────────────┼────────────────────────────────────┤
│ • Incremental AST Index │ • Multi-Model Routing   │ • OS-Level Lightweight Sandbox     │
│   (SQLite + SHA256)     │   Policy Engine         │   (Bubblewrap / Seatbelt)          │
│ • Patch Confidence &    │ • Deadlock &            │ • MCP Sidecar Security Sandbox     │
│   Conflict Detection    │   Oscillation Detection │   (Egress allowlist, quotas)       │
│ • ACP Metadata          │ • Turn-Supersession     │ • Long-Horizon Project Memory      │
│   Debounce & Batching   │   Context Pruning       │   (`@foxcode/memory`)              │
│ • Named Shadow          │ • Self-Healing Test     │ • Cross-Session Checklist State    │
│   Checkpoints & /undo   │   Loop with LLTC Filter │   Machine                          │
│ • Tool-First AST Tools  │ • Atomic Task Commits   │                                    │
└─────────────────────────┴─────────────────────────┴────────────────────────────────────┘
```

### Phase 1: Near-Term (Q4 2026 — Core Foundations & Precision)
1. **Incremental AST Caching in `@foxcode/indexing`**:
   - Persist symbol index in SQLite keyed by file-level SHA256.
   - Bundle `web-tree-sitter` WASM grammars for TypeScript, Python, Go, Rust, C++.
   - Expose `lookup_symbols` and `fetch_repo_map` as on-demand tools with 0 prefix bloat.
2. **Patch Confidence Scoring & Conflict Detection**:
   - Implement dry-run multi-hunk verification in [`packages/core/src/tool/apply-patch.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/tool/apply-patch.ts).
   - Ensure transactional all-or-nothing patch application.
3. **Editor Latency Optimization**:
   - Add 150ms debounce and priority channels to [`fox-acp-client`](file:///home/k82l0804/workarea/fox/fox-acp-client/).
4. **Enhanced Shadow Snapshots & Named Revert**:
   - Surface `/undo` and `/diff` commands in TUI referencing internal shadow git states.

### Phase 2: Autonomous SWE Execution (Q1 2027 — Self-Healing & Routing)
1. **Multi-Model Routing Policy Engine**:
   - Implement fast coder default with automated escalation to high-reasoning models after 2 consecutive failed turns.
2. **Autonomous Verification & Loop Defense**:
   - Trigger project linters/tests after edits; filter traces through LLTC.
   - Detect oscillating edits and blast-radius regressions.
   - Apply render-time turn-supersession to prune stale tool outputs from history.
3. **Atomic Task-Completion Commits**:
   - On verified test pass, present interactive commit dialog with conventional commit draft.
4. **Repo-Level Intent Detection**:
   - Track `last_edited_file`, `last_touched_symbol`, and `last_failing_command` at the user turn tail.

### Phase 3: Advanced Sandboxing & Memory (Q2 2027 — Isolation & Longevity)
1. **Zero-Overhead OS Sandboxing**:
   - Implement Bubblewrap and Seatbelt containment in [`packages/sandbox`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/sandbox/) to run untrusted code without Docker.
2. **MCP Sidecar Security Sandbox**:
   - Add network egress allowlists and ephemeral profiles for headless browser automation.
3. **Long-Horizon Project Memory**:
   - Integrate [`packages/fox-memory`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/fox-memory/) for persistent architectural decisions and style guidelines.

---

## 🏁 Summary: Why Fox Wins in the Autonomous SWE Era

Competitors have chosen to solve SWE complexity by **adding weight**: heavier prompts (Cursor/Aider 10k-token blobs), heavier runtimes (OpenHands multi-gigabyte Docker images), or proprietary cloud tethering (Claude Code, Devin, Amazon Q).

Fox takes the opposite path:
1. **Speed & Latency**: Sub-5ms startup and sub-millisecond execution overhead via Bun and Effect TS.
2. **Token Economics**: Cutting prompt costs by **52% to 76%** through tool boundary compression and byte-stable KV-cache retention.
3. **Tool-First Precision**: Structural AST indexing on-demand without poisoning the prompt prefix.
4. **Zero-Pollution Safety**: Shadow git snapshots providing total undo safety without littering the developer's commit history.
5. **Defensive Autonomy**: Routing heuristics, deadlock detection, and incremental caching that guarantee predictability on real-world codebases.
6. **Existing Maturity**: Fox already ships production-quality memory (`@foxcode/memory`), session checklists (`todowrite`), turn-supersession (`FOX_EXPERIMENTAL_COMPRESS_SUPERSEDE`), and a prepare-then-apply patch engine — providing a strong foundation to build each blueprint upon.

Fox remains **the CLI that feels alive**: fast, local, predictable, and engineered for developers who demand peak performance.
