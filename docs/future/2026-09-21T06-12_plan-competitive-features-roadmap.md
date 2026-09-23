# 🦊 Fox Code CLI — Competitive SWE Agent Audit & Architectural Feature Roadmap

> **Document Version:** 1.5.0  
> **Status:** Strategic Architectural Plan — Updated 2026-09-22 (Phase 1B + Phase 2.0 Complete)  
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

> ✅ **PHASE 1 COMPLETED** — SQLite-backed SHA1 file-keyed Tree-sitter symbol indexing landed in `packages/fox-indexing/src/ast/` (Session [`8d3ee5e0`](../../.gemini/antigravity-ide/brain/8d3ee5e0-5c40-4c1c-80d0-660c7ace72b1/walkthrough.md)):
> - `schema.ts`: SQLite schema (symbol_files + symbols tables) using bun:sqlite
> - `grammars.ts`: Lazy WASM grammar loading for 36 languages via tree-sitter-wasms
> - `extractor.ts`: Language-specific symbol extraction (TS/JS, Python, Go, Rust + generic fallback)
> - `indexer.ts`: Core engine with git blob SHA1 caching, background scan, lookup/repoMap APIs
> - `src/tool/lookup_symbols.ts`: On-demand symbol lookup tool
> - `src/tool/fetch_repo_map.ts`: On-demand repository map tool
> - Enabled by default, no config gate, zero external dependencies
> - Per-project DBs at `~/.local/state/fox/ast-cache/<project-hash>.db`
>
> **Phase 2 deferred**: Embedding-based semantic search, vector store integration, file watcher incremental updates, SHA256 fallback for non-git dirs, cross-project symbol sharing.

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

> ✅ **PARTIALLY IMPLEMENTED** — Oscillation detection, repair budget tracking, and auto-verification infrastructure landed in [`packages/core/src/oscillation.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/oscillation.ts), [`packages/core/src/repair-budget.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/repair-budget.ts), and [`packages/core/src/verification.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/verification.ts) (Session [`1c9c41c5`](../../.gemini/antigravity-ide/brain/1c9c41c5-dbdf-4170-9bb8-4e6c07104d24/walkthrough.md)). Integrated into [`src/session/processor.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/processor.ts). Configuration via `autonomous.*` in `fox.jsonc`. 56 tests.
>
> **Remaining work deferred to future phases** (see Blueprints 3a, 3b, 3c, 3d below):
> - Auto-verification execution pipeline (actually running detected test commands)
> - Blast-radius regression detection (before/after test baseline tracking)
> - Auto-lint execution after mutations
> - Snapshot.Service ↔ Oscillation integration (stateful rollback on deadlock)

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

### Blueprint 3a: Auto-Verification Execution Pipeline

> 🔮 **PLANNED** — Captures deferred capability from the Autonomous Verification Layer ([`1c9c41c5`](../../.gemini/antigravity-ide/brain/1c9c41c5-dbdf-4170-9bb8-4e6c07104d24/walkthrough.md)). The detection and formatting infrastructure (`detectBestCommand`, `formatVerificationFeedback`) is in place; this blueprint adds the actual command execution.

#### What It Does
After a mutation tool (`edit`, `apply_patch`, `write`) completes successfully in autonomous mode, Fox automatically:
1. Detects the project's verification command via `package.json` scripts or `autonomous.test_command` override
2. Executes the command with `autonomous.test_timeout` (default 30s)
3. Compresses the output through the LLTC `filterTestOutput` pipeline
4. Appends the compressed result to the mutation tool's output so the model sees it on the same turn

#### Implementation Notes
- Requires spawning a bash subprocess from within the session processor's `tool-result` handler
- Must use the existing `AppProcess` infrastructure for timeout enforcement
- Output flows through `ToolOutputCompressor.process()` → `filterTestOutput()` → `truncateOutput()`
- Only activates in autonomous mode (`--auto` flag or active `/goal`)
- Controlled by `autonomous.auto_verify` config (default: `true`)

---

### Blueprint 3b: Blast-Radius Regression Detection

> 🔮 **PLANNED** — Depends on Blueprint 3a (auto-verification execution).

#### What It Does
Tracks which specific tests were passing *before* a mutation and which *new* test failures appeared *after*. If a mutation causes previously-passing tests to fail (in modules unrelated to the edit), a **REGRESSION ALERT** is injected into the tool output.

#### Design
1. **Baseline Capture**: On session start or after a passing verification run, snapshot the set of passing test names
2. **Delta Comparison**: After a post-mutation verification run fails, diff the new failure set against the baseline
3. **Regression Classification**: New failures not in the edited file's test module are classified as blast-radius regressions
4. **Model Warning**: Inject `⚠️ REGRESSION DETECTED: N previously-passing tests now fail in unrelated modules` with the specific test names

#### Token Impact
- Baseline snapshot: ~50 tokens (stored in-memory, not sent to model)
- Regression alert: ~100 tokens (only when regressions detected)
- Net savings: Prevents multi-turn debugging of unrelated breakage

---

### Blueprint 3c: Auto-Lint Execution

> 🔮 **PLANNED** — Depends on Blueprint 3a (auto-verification execution).

#### What It Does
After mutation tools complete, optionally runs the project's linter (ESLint, Biome, Ruff, etc.) and feeds compressed lint output back to the agent. Separate from test execution to allow independent enable/disable.

#### Design
1. **Detection**: Auto-detect lint command from `package.json` scripts (`lint`, `eslint`, `biome check`)
2. **Execution**: Run with short timeout (10s default) after mutations
3. **Compression**: Filter to only new/changed-file lint errors (not pre-existing warnings)
4. **Config**: `autonomous.auto_lint` (default: `false`, opt-in) with `autonomous.lint_command` override

---

### Blueprint 3d: Snapshot.Service ↔ Oscillation Integration

> 🔮 **PLANNED** — Depends on Blueprint 3 (implemented). Complements oscillation detection with git-level rollback capabilities.

#### What It Does
Today, oscillation detection uses content hashes and `Snapshot.Service` uses shadow git checkpoints — they are complementary systems operating independently. This blueprint integrates them so that:

1. **Snapshot-Aware Rollback**: When oscillation is detected, the agent can offer to roll back to the last known-good snapshot state (not just warn)
2. **Hash Verification**: Use `Snapshot.Service` pre-image data to verify oscillation hashes against actual file state, eliminating hash-proxy inaccuracies
3. **Session-Level Undo on Budget Exhaustion**: When repair budget is exhausted, automatically create a named checkpoint and offer `/undo` to the user

#### Why It Was Deferred
Oscillation detection is intentionally pure and stateless (content hashes only). Adding snapshot integration introduces a dependency on the git snapshot infrastructure, which requires careful layering to avoid coupling the core detection module to the session layer.

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

### Blueprint 4b: Dynamic Model Context Discovery (`/v1/models`)

> 🔮 **PLANNED** — Discovered and deferred during Fox prompt optimization ([`3f85032c`](../../.gemini/antigravity-ide/brain/3f85032c-52a2-4e10-83fd-e82182859e3d/walkthrough.md)). Resolves hardcoded context window limits for local models.

#### What It Does
In modern local LLM serving environments (LiteLLM proxy, Ollama, vLLM, LM Studio, Hugging Face TGI), the server's `/v1/models` endpoint exposes runtime metadata, including context window capacity (`max_model_len`, `context_window`, or `max_tokens`). 

Currently, Fox relies on static configuration or default assumptions (e.g. 128K). Blueprint 4b adds asynchronous context window querying during provider initialization:
1. **Asynchronous Endpoint Discovery**: On first provider connect or background warmup, query `GET /v1/models` to introspect the active model's true token capacity.
2. **Dynamic Compaction Thresholding**: Automatically calibrate `compaction.reserved` and token overflow limits (`FoxSessionOverflow.limit`) based on the detected context window rather than fixed magic numbers.
3. **Adaptive Repair Budget**: Scale the autonomous verification repair budget (`max_repair_turns`) to match model context capacity — larger contexts allow deeper self-healing traces before forced compaction.
4. **Graceful Fallback**: If `/v1/models` does not provide context metadata or fails to respond within 2,000ms, fall back immediately to the user's configured `max_tokens` or the safe default (128K) with zero disruption.

#### Why It Was Deferred
Originally deferred because provider initialization in the legacy architecture was synchronous, making an async HTTP fetch invasive without refactoring provider lifecycle layers. With Effect-native service lifecycles in place, this can now be cleanly implemented as an Effect service dependency.

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

> ✅ **IMPLEMENTED (Phase 1)** — Transactional patch engine with in-memory journaling and 4-tier syntactic confidence scoring landed in [`packages/core/src/transaction.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/transaction.ts) and [`packages/core/src/transaction-confidence.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/transaction-confidence.ts). Both `apply_patch` and `edit` tools use the transactional `FileMutation` API. 28 tests.

#### Building on the Existing Patch Engine
Fox's [`apply-patch.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/tool/apply-patch.ts) now implements a **transactional prepare-then-apply** pipeline with all-or-nothing atomicity:
1. **Dry-Run Validation**: All patch hunks across all files are validated against in-memory buffers before any disk writes occur.
2. **4-Tier Syntactic Confidence Scoring**: Each hunk reports match quality — Exact (1.0), Normalized (0.95), Sliding Context (0.85), Context Trim (0.75) — so the agent gets precise feedback on match quality.
3. **In-Memory Pre-Image Journal**: Pre-mutation file contents captured as `Uint8Array` byte buffers. On failure, immediate zero-disk-dependency rollback restores all modified files. (Git snapshots are retained exclusively for session-level `/undo` and crash recovery).
4. **All-or-Nothing Transaction**: If any hunk fails dry-run validation, **zero files are touched**, and a precise line-level mismatch is returned to the agent.
5. **Unified Mutation Semantics**: The single-file `edit` tool participates in the identical `FileMutation.Transaction` API for shared rollback and scoring semantics.

---

### Blueprint 6a: Semantic & LSP Diagnostic Confidence Scoring

> 🔮 **PLANNED (Phase 2)** — Captures deferred capability from the Transactional Patch Engine Architectural Review. Extends syntactic confidence scoring to semantic compiler/language server feedback once the transactional core is stable.

#### Why LSP Was Deferred in Phase 1
During the architectural review, integrating language server diagnostics directly into Phase 1 patch confidence scoring was intentionally rejected to avoid premature complexity:
- Language server diagnostics can be noisy and vary widely across language ecosystems.
- Running heavy semantic checks on every patch hunk slows down the sub-millisecond patch pipeline.
- Diagnostics can fluctuate between turns, risking false negative patch rejections.

#### Phase 2 Architectural Plan: Post-Edit Diagnostics Delta
In Phase 2, semantic confidence is integrated into the **Autonomous Verification Layer** (Blueprint 3):
1. **Pre/Post Diagnostics Delta**: Capture baseline compiler diagnostics prior to transaction commit; evaluate diagnostics immediately post-apply.
2. **"Did this edit introduce new errors?" Gate**: If an edit resolves existing errors without introducing new ones, confidence is boosted; if new type/lint errors are created, a `SEMANTIC REGRESSION` signal is returned.
3. **Type-Checking Confidence**: For strongly typed projects (TypeScript `tsc`, Rust `cargo check`, Go `go vet`), incorporate compiler exit codes into transaction verification.
4. **Agent Repair Templates (Breaking Change Mitigation)**: With transactional patch failures returning *"Patch failed; no changes applied"* (rather than legacy *"Patch partially applied"*), update agent prompt templates and error-recovery heuristics so models understand no partial edits were committed and can attempt a full clean retry.

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

#### Fox ACP Client Post-V1 Enhancements
Deferred items from the Fox ACP Client implementation roadmap ([`b54439fa`](../../.gemini/antigravity-ide/brain/b54439fa-058d-4b70-b231-09371dabdbef/walkthrough.md) and [`8ce19d09`](../../.gemini/antigravity-ide/brain/8ce19d09-ce8d-411e-9d27-74ba0471e56b/walkthrough.md)):
- **Multi-Root Workspace Support**: Resolve `${workspaceFolder}` across heterogeneous multi-root VSCode workspaces.
- **In-Chat Webview Diff Cards**: Rich side-by-side diff review cards rendered directly inside the chat webview as an alternative to quickpick staging.

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

### Blueprint 11: High-Velocity Turn Orchestration & Tool Resolution Caching

> 🔮 **PLANNED** — Captures deferred optimization items from the Post-Review Action Plan ([`bf001c70`](../../.gemini/antigravity-ide/brain/bf001c70-5d32-431c-ad34-0c413df508fb/walkthrough.md)) and Prompt Engine Optimization ([`3f85032c`](../../.gemini/antigravity-ide/brain/3f85032c-52a2-4e10-83fd-e82182859e3d/walkthrough.md)).

#### 1. Static Tool Resolution Caching
- **The Bottleneck**: Currently, `SessionPrompt.resolveTools` re-evaluates tool registries, file paths, and schema wrappers on every single turn loop step because tool closures capture per-step processor handles ([`tools.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/tool/tools.ts)). On large projects with many MCP tools, this burns 10–50ms per step.
- **The Solution**: Structurally decouple static tool definition and JSON Schema construction from the dynamic per-turn execution context. Cache tool definitions once per session/agent instance; inject step-scoped handles (`ProcessorID`, `TurnID`, permission brokers) solely at tool execution dispatch time.

#### 2. Incremental / Paginated Message Loading
- **The Bottleneck**: Long-running autonomous sessions (30–100+ turns) currently load and deserialize the entire historical `MessageV2` sequence from SQLite/KV into memory on every turn.
- **The Solution**: Implement a sliding-window active message cache. The prompt engine only holds recent turns (e.g. last 10 turns + system prompt) in memory. Historical turns are streamed from SQLite only when compaction summarization or user history search is explicitly triggered.

#### 3. Redundant Serialization Bypass
- **The Bottleneck**: Large tool payloads pass through repeated `JSON.stringify` calls for safety limits and doom-loop detection.
- **The Solution**: Maintain incremental byte counters during streaming ingestion, replacing expensive full-string serialization passes with streaming length bounds.

---

### Blueprint 12: Dynamic Workload Classification & Local Model Compatibility Matrix

> 🔮 **PLANNED** — Captures deferred items from Lossless Token Compression Phase 2 ([`3a6c6255`](../../.gemini/antigravity-ide/brain/3a6c6255-5938-4142-8218-72febfc90551/walkthrough.md) and [`8710aa9b`](../../.gemini/antigravity-ide/brain/8710aa9b-25c1-4dc4-960d-32c51e0afc4c/walkthrough.md)).

#### 1. Deterministic Heuristic Workload Classifier
- **The Opportunity**: Fox currently ships 5 hardened workflow compression policies (`swe`, `data`, `research`, `shell`, `none`) with an alias `auto` that defaults statically to `swe`.
- **The Solution**: Upgrade `auto` to use a deterministic, zero-latency (<1ms) heuristic classifier:
  - **Code / SWE**: Triggers on file extensions (`.ts`, `.py`, `.rs`, `.go`, `.c`, `.cpp`), tool calls (`edit`, `apply_patch`, `read`), or diff hunks. Activates full LLTC stack (Git rewrites, diff trimming, lockfile collapsing, test filtering).
  - **Data Analysis**: Triggers on tabular data files (`.csv`, `.tsv`, `.parquet`), SQL queries, or large JSON payloads. Activates columnar encoding and JSON key compaction while preserving full logs.
  - **Research / Docs**: Triggers on markdown specs (`.md`), documentation, or long prose. Preserves raw formatting while optimizing prompt tokens.
  - **DevOps / Shell**: Triggers on terminal/PTY workflows, Docker, or Kubernetes configs. Retains full unfiltered logs.
- **Anti-Pattern Guard**: No runtime ML models or external LLM calls for classification — pure regex and workspace path heuristics only.

#### 2. Local Open-Weights Model Family Profiles & Compatibility Matrix
- **The Opportunity**: Different open-weights models respond differently to prompt compaction and tool signatures:
  - **Qwen 2.5 / 2.5-Coder**: Thrives on compact signatures and parallel tool calling; benefits from concise Chinese/English bilingual prompts.
  - **DeepSeek R1 / V3**: Emits `<think>...</think>` reasoning tokens; requires specialized streaming handlers that preserve reasoning blocks without counting them against tool output compression budgets.
  - **Llama 3.1 / 3.3**: Requires explicit tool schemas and parameter types; sensitive to over-minified JSON schemas.
  - **Mistral / Codestral**: Requires precise system instruction formatting and strict indentation preservation.
- **The Solution**: Curated, pre-tested profiles in `prompts.json` mapped by model ID pattern, with automated tokenizer-aware prompt compaction rules tuned per architecture.

---

### Blueprint 13: Live Telemetry Dashboard & Invariant Regression Gates

> 🔮 **PLANNED** — Captures deferred items from the Fox Standard Test Suite & Scoreboard ([`c2f54bac`](../../.gemini/antigravity-ide/brain/c2f54bac-5c73-4146-a537-f03b268044a1/walkthrough.md)) and Compression Hardening ([`3a6c6255`](../../.gemini/antigravity-ide/brain/3a6c6255-5938-4142-8218-72febfc90551/walkthrough.md)).

#### 1. Interactive TUI Statusline & Compression Dashboard
- **The Feature**: Surface live, real-time compression and autonomous defense telemetry directly in the interactive TUI footer and status dialog:
  - Cumulative session tokens saved and percentage reduction (e.g. `LLTC: -62.4% (saved 28.4k tok)`).
  - Active compression transforms applied on the previous turn (e.g. `[diff -U1] [lockfile collapsed] [test filter]`).
  - Byte-stable prefix SHA-256 state indicator (`Prefix: 🔒 e3b0c442...`).
  - Active autonomous defense status: repair budget remaining (`Repair: 2/3 turns`), oscillation warnings, and baseline test status.

#### 2. Continuous Invariant & Compression CI Drift Gate
- **The Feature**: Integrate the 52-fixture Fox Standard Test Suite into continuous integration:
  - Gate PRs against the 6 core invariants: Lossless Preservation, Non-Expansion, Prefix Stability, Supersession Correctness, Escape Hatch Fidelity, Overhead ROI.
  - Fail builds if overall token reduction drops below 50% on SWE-bench Mini tasks or if any golden snapshot drifts without an explicit snapshot update.

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

  // Autonomous SWE Execution Rails (PARTIALLY IMPLEMENTED)
  "autonomous": {
    // ✅ Implemented
    "auto_verify": true,                 // Run tests after mutation tools (default: true)
    "test_command": null,                // null = auto-detect from package.json; or explicit command
    "test_timeout": 30000,               // Verification command timeout in ms (default: 30000)
    "detect_oscillations": true,         // Detect A→B→A code toggle patterns (default: true)
    "oscillation_threshold": 4,          // Sliding window size for oscillation detection (default: 4)
    "max_repair_turns": 3,               // Max consecutive failures before warning (default: 3)
    // 🔮 Planned (Blueprint 3a/3b/3c)
    "auto_lint": false,                  // Run project linter after edits (default: false)
    "lint_command": null,                // null = auto-detect; or explicit lint command
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
  },

  // Local Model Context Auto-Discovery (NEW — Blueprint 4b)
  "models": {
    "auto_context_window": true,         // Query /v1/models on connect to auto-size buffers (default: true)
    "fallback_context_window": 131072    // Fallback if endpoint does not report capacity
  },

  // Workflow Heuristic Classification (NEW — Blueprint 12)
  "workflow": {
    "default": "auto",                   // "auto" | "swe" | "data" | "research" | "shell" | "none"
    "classifier": "heuristic"            // "heuristic" (sub-ms keyword/file inspection) | "static"
  },

  // UI & Live Telemetry Dashboard (NEW — Blueprint 13)
  "telemetry": {
    "tui_dashboard": true,               // Show live compression & defense status in TUI footer
    "ci_regression_threshold": 0.50      // Fail CI if token savings on standard suite drop below 50%
  },

  // Semantic Confidence & Diagnostics (NEW — Blueprint 6a)
  "confidence": {
    "lsp_diagnostics": false,            // Enable semantic LSP diagnostics delta scoring in Phase 2
    "typecheck_delta": false             // Check if mutation introduced new compiler errors
  }

  // Note: memory configuration already exists via @foxcode/memory.
  // Note: compression is already governed by FOX_EXPERIMENTAL_COMPRESS* env flags.
  // Note: workflow profiles extend the existing agent/model configuration.
}
```

---

## 📋 Master Deferred Items Traceability Ledger

To ensure no partial implementation or deferred capability is lost between engineering sessions, this ledger establishes 1-to-1 traceability from past sprint walkthroughs to active blueprints, scheduled roadmap phases, and configuration schema targets.

| # | Deferred Item | Originating Walkthrough & Session | Original Deferral Rationale | Assigned Blueprint | Target Phase | Configuration Target | Tracking Status |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **1** | **Auto-Detect Context Window (`/v1/models`)** | [Fox CLI Prompt Optimization (`3f85032c`)](file:///home/k82l0804/.gemini/antigravity-ide/brain/3f85032c-52a2-4e10-83fd-e82182859e3d/walkthrough.md) | Required async endpoint query in legacy synchronous provider initialization. | [**Blueprint 4b**](#blueprint-4b-dynamic-model-context-discovery-v1models) | **Phase 2 (Q1 2027)** | `models.auto_context_window` | 🔮 Planned |
| **2** | **Static Tool Resolution Caching** | [Fox CLI Prompt Optimization (`3f85032c`)](file:///home/k82l0804/.gemini/antigravity-ide/brain/3f85032c-52a2-4e10-83fd-e82182859e3d/walkthrough.md) → [Blueprint 11.1 Implementation (`8d3ee5e0`)](file:///home/k82l0804/.gemini/antigravity-ide/brain/8d3ee5e0-5c40-4c1c-80d0-660c7ace72b1/walkthrough.md) | Tool closures capture per-step processor handles; resolved by splitting `resolveDefinitions` (cached) + `bindExecutionContext` (per-step). | [**Blueprint 11.1**](#blueprint-11-high-velocity-turn-orchestration--tool-resolution-caching) | **Phase 1 (Q4 2026)** | Internal Runtime Engine | ✅ Completed |
| **3** | **Incremental / Paginated Message Loading** | [Fox CLI Prompt Optimization (`3f85032c`)](file:///home/k82l0804/.gemini/antigravity-ide/brain/3f85032c-52a2-4e10-83fd-e82182859e3d/walkthrough.md) → [Blueprint 11.1 Scope Boundary (`8d3ee5e0`)](file:///home/k82l0804/.gemini/antigravity-ide/brain/8d3ee5e0-5c40-4c1c-80d0-660c7ace72b1/walkthrough.md) | Requires `MessageV2` streaming / sliding window schema changes for long-turn sessions. Explicitly deferred as separate milestone from Blueprint 11.1. | [**Blueprint 11.2**](#blueprint-11-high-velocity-turn-orchestration--tool-resolution-caching) | **Phase 2 (Q1 2027)** | Internal Session Engine | 🔮 Planned |
| **4** | **Redundant JSON Serialization Bypass** | [Fox CLI Prompt Optimization (`3f85032c`)](file:///home/k82l0804/.gemini/antigravity-ide/brain/3f85032c-52a2-4e10-83fd-e82182859e3d/walkthrough.md) → [Blueprint 11.1 Scope Boundary (`8d3ee5e0`)](file:///home/k82l0804/.gemini/antigravity-ide/brain/8d3ee5e0-5c40-4c1c-80d0-660c7ace72b1/walkthrough.md) | Existing `JSON.stringify` acts as safety ceiling; replace with incremental streaming counters. Explicitly deferred as separate milestone from Blueprint 11.1. | [**Blueprint 11.3**](#blueprint-11-high-velocity-turn-orchestration--tool-resolution-caching) | **Phase 2 (Q1 2027)** | Internal Session Engine | 🔮 Planned |
| **5** | **Auto-Verification Execution Pipeline** | [Autonomous Verification Layer (`1c9c41c5`)](file:///home/k82l0804/.gemini/antigravity-ide/brain/1c9c41c5-dbdf-4170-9bb8-4e6c07104d24/walkthrough.md) | Detection infrastructure ready (`detectBestCommand`); live execution requires deeper bash tool integration. | [**Blueprint 3a**](#blueprint-3a-auto-verification-execution-pipeline) | **Phase 2 (Q1 2027)** | `autonomous.auto_verify` | 🔮 Planned |
| **6** | **Multi-Model Routing / Escalation** | [Autonomous Verification Layer (`1c9c41c5`)](file:///home/k82l0804/.gemini/antigravity-ide/brain/1c9c41c5-dbdf-4170-9bb8-4e6c07104d24/walkthrough.md) | On repair budget exhaustion, automatically switching models requires multi-provider routing layer. | [**Blueprint 4**](#blueprint-4-multi-model-routing-policy-engine) | **Phase 2 (Q1 2027)** | `routing.*` | 🔮 Planned |
| **7** | **Blast-Radius Regression Detection** | [Autonomous Verification Layer (`1c9c41c5`)](file:///home/k82l0804/.gemini/antigravity-ide/brain/1c9c41c5-dbdf-4170-9bb8-4e6c07104d24/walkthrough.md) | Requires baseline test capture before edits to diff against post-edit test failures in unrelated modules. | [**Blueprint 3b**](#blueprint-3b-blast-radius-regression-detection) | **Phase 2 (Q1 2027)** | `autonomous.detect_regressions` | 🔮 Planned |
| **8** | **Auto-Lint Execution Pipeline** | [Autonomous Verification Layer (`1c9c41c5`)](file:///home/k82l0804/.gemini/antigravity-ide/brain/1c9c41c5-dbdf-4170-9bb8-4e6c07104d24/walkthrough.md) | Separate post-mutation verification step focused specifically on changed-file lint errors. | [**Blueprint 3c**](#blueprint-3c-auto-lint-execution) | **Phase 2 (Q1 2027)** | `autonomous.auto_lint` | 🔮 Planned |
| **9** | **Snapshot.Service ↔ Oscillation Integration** | [Autonomous Verification Layer (`1c9c41c5`)](file:///home/k82l0804/.gemini/antigravity-ide/brain/1c9c41c5-dbdf-4170-9bb8-4e6c07104d24/walkthrough.md) | Oscillation was kept pure & stateless (hashes only); integrating shadow git snapshots requires session layering. | [**Blueprint 3d**](#blueprint-3d-snapshotservice--oscillation-integration) | **Phase 2 (Q1 2027)** | Internal Session Engine | 🔮 Planned |
| **10** | **ACP Multi-Root Workspace Support** | [Fox ACP Client (`b54439fa`)](file:///home/k82l0804/.gemini/antigravity-ide/brain/b54439fa-058d-4b70-b231-09371dabdbef/walkthrough.md) | Requires multi-root `${workspaceFolder}` resolution in VSCode extension. | [**Blueprint 9**](#blueprint-9-editor-latency--debounced-acp-streaming) | **Phase 3 (Q2 2027)** | VSCode Extension | 🔮 Planned |
| **11** | **In-Chat Webview Diff Review Cards** | [Fox ACP Client (`8ce19d09`)](file:///home/k82l0804/.gemini/antigravity-ide/brain/8ce19d09-ce8d-411e-9d27-74ba0471e56b/walkthrough.md) | Side-by-side diff review cards in chat UI as alternative to quickpick staging. | [**Blueprint 9**](#blueprint-9-editor-latency--debounced-acp-streaming) | **Phase 3 (Q2 2027)** | VSCode Extension | 🔮 Planned |
| **12** | **Mini-TUI Package Decoupling (`@foxcode/mini-tui`)** | [Codebase Review & Cleanup (`bf001c70`)](file:///home/k82l0804/.gemini/antigravity-ide/brain/bf001c70-5d32-431c-ad34-0c413df508fb/walkthrough.md) | 14,500-line `src/cli/cmd/run/` monolith requires dedicated decoupling milestone (WS2.2). | [**Blueprint 11**](#blueprint-11-high-velocity-turn-orchestration--tool-resolution-caching) | **Phase 3 (Q2 2027)** | Internal Package | 🔮 Planned |
| **13** | **Semantic & LSP Diagnostic Confidence Scoring** | [Patch Engine Review (Rollback & Confidence Scoring)](file:///Untitled-1) | LSP diagnostics are noisy and premature before transactional core is proven; deferred to Phase 2 autonomous verification. | [**Blueprint 6a**](#blueprint-6a-semantic--lsp-diagnostic-confidence-scoring) | **Phase 2 (Q1 2027)** | `confidence.lsp_diagnostics` | 🔮 Planned |
| **14** | **All-or-Nothing Patch Repair Prompt Templates** | [Patch Engine Review (Tool Contract Breaking Change)](file:///Untitled-1) → [Blueprint 6a Implementation (`8d3ee5e0`)](file:///home/k82l0804/.gemini/antigravity-ide/brain/8d3ee5e0-5c40-4c1c-80d0-660c7ace72b1/walkthrough.md) | Updated `apply_patch.txt`, `edit.txt`, `default.txt` system prompt, and error messages to instruct models that failures are transactional (all-or-nothing) and recovery requires fresh re-read. | [**Blueprint 6a**](#blueprint-6a-semantic--lsp-diagnostic-confidence-scoring) | **Phase 1 (Q4 2026)** | Internal Prompts | ✅ Completed |
| **15** | **MCP Tool Staleness Per-Step Check** | [Blueprint 11.1 Implementation (`8d3ee5e0`)](file:///home/k82l0804/.gemini/antigravity-ide/brain/8d3ee5e0-5c40-4c1c-80d0-660c7ace72b1/walkthrough.md) | MCP servers can add/remove tools mid-session; inline `mcp.tools()` check caused Effect R-channel leak. Needs MCP.Service version counter or Effect type workaround. `checkMcpStaleness` utility already implemented but not wired into loop. | [**Blueprint 11.1**](#blueprint-11-high-velocity-turn-orchestration--tool-resolution-caching) | **Phase 2 (Q1 2027)** | Internal Runtime Engine | 🔮 Planned |

---
# USER COMMENT/REVIEW: Priorities for the above list
My Overall Assessment
Top Priority (Core Autonomous Engine)
These directly affect reliability and correctness:

5 — Auto-Verification Pipeline

6 — Multi-Model Routing

7 — Blast-Radius Regression Detection

9 — Snapshot/Oscillation Integration

14 — All-or-Nothing Patch Prompt Updates

These are the backbone of a real autonomous SWE agent.

Medium Priority (Performance / UX / Architecture)
2 — Tool Resolution Caching

3 — Paginated Message Loading

4 — JSON Serialization Bypass

8 — Auto-Lint Pipeline

12 — Mini-TUI Decoupling

13 — LSP Confidence Scoring

These improve speed, stability, and developer experience.

Lower Priority (UI / Extension / Convenience)
10 — Multi-Root Workspace Support

11 — Webview Diff Cards

Nice-to-haves, not essential for autonomous capability.

---

## 🗺️ Phased Implementation Roadmap

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        FOX CLI IMPLEMENTATION ROADMAP                                  │
│                        (Updated 2026-09-22)                                            │
├─────────────────────────┬─────────────────────────┬────────────────────────────────────┤
│ ✅ COMPLETED             │ 🔧 Phase 2A: Guardian   │ Phase 2B: Refinement              │
│ (Delivered)              │ Core — Q4 2026          │ Q1–Q2 2027                        │
├─────────────────────────┼─────────────────────────┼────────────────────────────────────┤
│ ✅ Transactional Patch   │ • Guardian Agent Core   │ • Multi-Model Routing (BP 4)      │
│   Engine (Blueprint 6)  │   (Intake + Oversight)  │ • Blast-Radius Regression (3b)    │
│ ✅ Oscillation Detection │ • Auto-Verification     │ • Auto-Lint Execution (3c)        │
│   (Blueprint 3)         │   Execution (3a)        │ • Snapshot ↔ Oscillation (3d)     │
│ ✅ Repair Budget Tracker │ • Turn-Supersession     │ • Paginated Message Loading       │
│   (Blueprint 3)         │   Context Pruning       │   (Blueprint 11.2)                │
│ ✅ Auto-Verification     │ • Atomic Task-Completion│ • JSON Serialization Bypass       │
│   Infrastructure        │   Commits               │   (Blueprint 11.3)                │
│ ✅ Incremental AST Index │ • Dynamic Context       │ • Semantic & LSP Diagnostic       │
│   (Blueprint 1 Phase 1) │   Window Discovery (4b) │   Confidence Scoring (6a)         │
│ ✅ Static Tool Closure   │                         │ • Repo-Level Intent Detection     │
│   Resolution (BP 11.1)  │─────────────────────────│ • TUI Live Telemetry              │
│ ✅ All-or-Nothing Repair │ Phase 3: Architecture   │   Dashboard (BP 13)               │
│   Prompts (BP 6a)       │ Q1–Q2 2027              │                                    │
│ ✅ Phase 1B: Compression │─────────────────────────│────────────────────────────────────│
│   Hardening (334/334)   │ • OS-Level Sandbox      │                                    │
│ ✅ Phase 2.0: Adaptive   │   (BP 10)               │                                    │
│   Compression (19.1%)   │ • MCP Sidecar Security  │                                    │
│ ✅ Challenge Ladder      │   (BP 8)                │                                    │
│   + CI Gate             │ • Long-Horizon Project  │                                    │
│                         │   Memory (BP 7)         │                                    │
│ Phase 1: Remaining      │ • Mini-TUI Decoupling   │                                    │
│ (Low Priority)          │ • ACP Multi-Root &      │                                    │
│─────────────────────────│   Diff Cards            │                                    │
│ • ACP Metadata          │ • Cross-Session          │                                    │
│   Debounce & Batching   │   Checklist State        │                                    │
│ • Named Shadow          │                         │                                    │
│   Checkpoints & /undo   │                         │                                    │
│ • Local Model Profiles  │                         │                                    │
│   & Prompts Matrix      │                         │                                    │
└─────────────────────────┴─────────────────────────┴────────────────────────────────────┘
```

> 📋 **Canonical autonomous workflow reference**: See [`docs/future/2026-09-22T15-16_autonomous-agent-workflow.md`](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/future/2026-09-22T15-16_autonomous-agent-workflow.md) for the gold-standard 10-step autonomous SWE loop that Fox is targeting.
> Phase 2A maps directly to Steps 4–8 of that workflow, completing the autonomous closed loop.
>
> 📋 **Current flow**: `Phase 1 ✅ → Phase 1B ✅ → Phase 2.0 ✅ → Phase 2A (Guardian) 🔧 → Phase 2B → Phase 3`

### Phase 1: Near-Term (Q4 2026 — Core Foundations & Precision)
1. ~~**Patch Confidence Scoring & Conflict Detection**~~ → ✅ **COMPLETED** (Blueprint 6: Transactional Patch Engine with in-memory journal, 4-tier confidence scoring, 28 tests)
2. ~~**Incremental AST Caching in `@foxcode/indexing`**~~ → ✅ **COMPLETED** (Blueprint 1 Phase 1: SQLite-backed SHA1 file-keyed Tree-sitter indexing, `lookup_symbols` + `fetch_repo_map` tools, 36 WASM grammars, enabled by default)
3. **Editor Latency Optimization** (Blueprint 8): ⏳ **DEFERRED to `fox-acp-client`**
   - Add 150ms debounce and priority channels to [`fox-acp-client`](file:///home/k82l0804/workarea/fox/fox-acp-client/) (VS Code extension repo).
4. ~~**Enhanced Shadow Snapshots & Named Revert**~~ → ✅ **COMPLETED** (Pre-mutation baseline capture via `Checkpoint.Service`, FIFO ring buffer, CLI `fox checkpoint`, `/undo`, `/diff`, 8 tests)
5. ~~**Static Tool Closure Resolution Caching**~~ → ✅ **COMPLETED** (Blueprint 11.1: Decoupled `resolveDefinitions` from `bindExecutionContext` in `tools.ts`, enabling static definition caching across turns)
6. ~~**Local Open-Weights Model Family Profiles & Prompts Matrix** (Blueprint 12)~~ → ✅ **COMPLETED** (Curated profiles in `model-profiles.json` for Llama 3.1/3.3, Codestral/Mistral, Gemma 2/4, Nemotron, GPT-OSS; auto-detection, compaction alignment, `--profile` flag, 21 tests)
7. ~~**Continuous Invariant & Compression CI Drift Gate**~~ (Blueprint 13) → ✅ **COMPLETED** (Challenge Ladder CI gate: `test:challenge` in `package.json`, 334-fixture suite with min score ≥285, historical snapshots in `docs/challenge-history/`)

### Phase 1B: Compression Hardening → ✅ **COMPLETED** (2026-09-22)

> All 6 items resolved. Challenge Ladder: **334/334 (100.0%)**. Token savings: **19.1%**.
> This phase was added after Challenge Ladder v1 revealed 3 compression bugs (287.4/300).
> All bugs fixed, suite expanded to 334 fixtures, 100% correctness achieved.

1. ~~**GitOps Preservation Rule**~~ → ✅ Fixed. Branch names, commit messages, author/date lines preserved in multi-step gitops traces.
2. ~~**Stability Fixes**~~ → ✅ Fixed. ROI auto-skip reset between passes; `command` field passed consistently to classifier.
3. ~~**GAIA Keyword Fix**~~ → ✅ Fixed. GAIA reasoning markers protected via `risk: critical` classification.
4. ~~**Score Tracking Infrastructure**~~ → ✅ Delivered. `tools/challenge-snapshot.ts` + `docs/challenge-history/` JSON snapshots.
5. ~~**CI Gate for Challenge Score**~~ → ✅ Delivered. `test:challenge` script in `package.json` with `--timeout 60000`.
6. ~~**Heuristic Workload Classification (BP 12)**~~ → ✅ Delivered as **Adaptive Compression** (see Phase 2.0).

### Phase 2.0: Adaptive Compression → ✅ **COMPLETED** (2026-09-22)

> Content classifier + 3 new risk-gated transforms. Token savings: **15.8% → 19.1%** (+3.3pp).
> Zero correctness regressions. 279 smoke tests pass. Sub-millisecond overhead.

1. ~~**Content Classifier (`compression-levels.ts`)**~~ → ✅ Heuristic classifier assigns `CompressionLevel` (0-3), `RiskProfile` (safe/cautious/critical), content type hints. Sub-millisecond. Zero LLM calls.
2. ~~**Timestamp Stripping (Level 1)**~~ → ✅ Strips ISO/HH:MM:SS timestamps from log lines. Skips diffs, commits, structured data.
3. ~~**Boilerplate Header Stripping (Level 1)**~~ → ✅ Strips npm warnings, pip notices, Docker layer progress. Allowlist-based.
4. ~~**Repeated Pattern Collapsing (Level 2)**~~ → ✅ Collapses runs of ≥5 similar lines. Preserves first, last, and all error/warning lines.
5. ~~**Pipeline Integration**~~ → ✅ `process()` classifies content, gates transforms by `minLevel`. Error-signal detection (OOMKilled, CrashLoop → cautious). `# no-truncate` escape hatch → critical.
6. ~~**Guardian-Ready Interface**~~ → ✅ `CompressionPolicyOverride` type: `process(text, ctx, { maxLevel: 0, source: "guardian" })`.

### Phase 2A: Guardian + Autonomy Core (Q4 2026 — Closing the Autonomous Loop)

> Maps to Steps 4–8 of [`2026-09-22T15-16_autonomous-agent-workflow.md`](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/future/2026-09-22T15-16_autonomous-agent-workflow.md). Completing these items enables the full `edit → verify → detect → route → prune → commit` closed loop.
> See also: [`2026-09-22T15-16_autonomous-dual-agent-design.md`](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/future/2026-09-22T15-16_autonomous-dual-agent-design.md) for Guardian architecture.

0. ~~**Autonomous Verification & Loop Defense**~~ → ✅ **COMPLETED** (Blueprint 3: Oscillation detection, repair budget, verification infrastructure)
1. **Guardian Agent Core** — **NEW, HIGHEST PRIORITY.** Dual-agent oversight layer. Intake gatekeeper, post-failure classification, pre-commit review, progress monitoring. See [`2026-09-22T15-16_autonomous-dual-agent-design.md`](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/future/2026-09-22T15-16_autonomous-dual-agent-design.md).
2. **Auto-Verification Execution Pipeline** (Blueprint 3a) — *Workflow Step 4*:
   - Execute detected test commands automatically after mutations in autonomous mode.
   - Compress output through LLTC `filterTestOutput` pipeline.
   - This is the **single highest-priority item** — everything downstream depends on it.
3. **Multi-Model Routing Policy Engine** (Blueprint 4) — *Workflow Step 6*:
   - Implement fast coder default with automated escalation to high-reasoning models after 2 consecutive failed turns.
   - > ⚠️ **Risk**: Ping-pong escalation, over-escalation on noisy failures, misclassification of architectural tasks. Bound cost to max 2 wasted turns.
4. **Turn-Supersession Context Pruning** — *Workflow Step 7*:
   - Productionize `FOX_EXPERIMENTAL_COMPRESS_SUPERSEDE` for render-time turn-supersession.
   - Prune stale file reads and obsolete git status from earlier turns in LLM context.
   - Critical for multi-turn autonomous sessions (10+ turns fill context without this).
5. **Atomic Task-Completion Commits** — *Workflow Step 8*:
   - On verified test pass, present interactive commit dialog with conventional commit draft.
   - Closes the autonomous loop: `verify → present → commit`.
6. **Blast-Radius Regression Detection** (Blueprint 3b) — *Workflow Step 5 refinement*:
   - Capture test baseline snapshots; diff against post-mutation results.
   - Inject regression alerts for unrelated module breakage.
   - > ⚠️ **Risk**: Baseline invalidation rules, flaky test handling, nondeterministic output. Requires explicit refresh policies.
7. **Dynamic Model Context Window Discovery** (Blueprint 4b) — *Dependency of #3*:
   - Query `/v1/models` asynchronously on provider connect to auto-size compaction thresholds and repair budgets.

### Phase 2B: Refinement & Performance (Q1–Q2 2027 — Making Autonomy Better)

> These items improve speed, quality, and UX but do not block the autonomous loop.

1. **Auto-Lint Execution** (Blueprint 3c):
   - Optionally run project linters after mutations; filter to changed-file errors only.
2. **Snapshot.Service ↔ Oscillation Integration** (Blueprint 3d):
   - Integrate shadow git snapshots with oscillation detection for snapshot-aware rollback on deadlock and auto-checkpoint on budget exhaustion.
   - > ⚠️ **Risk**: Must avoid coupling snapshot logic into the core loop. Oscillation detector is intentionally pure and stateless.
3. **Incremental / Paginated Message Loading** (Blueprint 11.2):
   - Load only recent sliding turn window into active memory; stream historical turns on-demand during compaction.
4. **JSON Serialization Bypass** (Blueprint 11.3):
   - Eliminate redundant JSON serialization roundtrips in the message pipeline for large contexts.
5. **Semantic & LSP Diagnostic Confidence Scoring** (Blueprint 6a):
   - Pre/post diagnostics delta scoring, type-checking confidence, and error-introduction gating.
6. **Repo-Level Intent Detection**:
   - Track `last_edited_file`, `last_touched_symbol`, and `last_failing_command` at the user turn tail.
7. **Deterministic Heuristic Workload Classification** (Blueprint 12):
   - Upgrade `auto` workflow to dynamically detect `swe`, `data`, `research`, or `shell` workloads based on file extensions and prompt signals.
8. **Interactive TUI Statusline & Compression Dashboard** (Blueprint 13):
   - Render real-time token savings %, active compression transforms, prefix SHA256, and repair budget turns remaining.

### Phase 3: Advanced Sandboxing & Architecture (Q2 2027 — Isolation & Longevity)
1. **Zero-Overhead OS Sandboxing** (Blueprint 10):
   - Implement Bubblewrap and Seatbelt containment in [`packages/sandbox`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/sandbox/) to run untrusted code without Docker.
2. **MCP Sidecar Security Sandbox** (Blueprint 8):
   - Add network egress allowlists and ephemeral profiles for headless browser automation.
3. **Long-Horizon Project Memory** (Blueprint 7):
   - Integrate [`packages/fox-memory`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/fox-memory/) for persistent architectural decisions and style guidelines.
4. **Mini-TUI Package Decoupling (`@foxcode/mini-tui`)**:
   - Decouple `src/cli/cmd/run/` (14,500 lines) into a standalone internal package with cleanly isolated state, transport, and UI footer components (WS2.2).
5. **Fox ACP Client Multi-Root Workspaces & In-Chat Webview Diff Cards**:
   - Multi-root workspace support for VSCode extension (`${workspaceFolder}` resolution) and rich side-by-side diff review cards.
6. **Cross-Session Checklist State Machine**:
   - Persist todowrite checklist state across sessions for long-running multi-session projects.

---

## 🏁 Summary: Why Fox Wins in the Autonomous SWE Era

Competitors have chosen to solve SWE complexity by **adding weight**: heavier prompts (Cursor/Aider 10k-token blobs), heavier runtimes (OpenHands multi-gigabyte Docker images), or proprietary cloud tethering (Claude Code, Devin, Amazon Q).

Fox takes the opposite path:
1. **Speed & Latency**: Sub-5ms startup and sub-millisecond execution overhead via Bun and Effect TS.
2. **Token Economics**: Cutting prompt costs by **19.1%** globally (measured across 334 fixtures) through adaptive compression, tool boundary optimization, and byte-stable KV-cache retention.
3. **Tool-First Precision**: Structural AST indexing on-demand without poisoning the prompt prefix.
4. **Zero-Pollution Safety**: Shadow git snapshots providing total undo safety without littering the developer's commit history.
5. **Defensive Autonomy**: Routing heuristics, deadlock detection, and incremental caching that guarantee predictability on real-world codebases.
6. **Existing Maturity**: Fox already ships production-quality memory (`@foxcode/memory`), session checklists (`todowrite`), turn-supersession (`FOX_EXPERIMENTAL_COMPRESS_SUPERSEDE`), and a prepare-then-apply patch engine — providing a strong foundation to build each blueprint upon.

Fox remains **the CLI that feels alive**: fast, local, predictable, and engineered for developers who demand peak performance.
