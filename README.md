# 🦊 Fox Code CLI (`@fox/cli`)

> 🌐 **Part of the [Fox Ecosystem](../README.md)**. For the high-level ecosystem overview, benchmark scoreboard, VS Code extension, and local model proxy setup, see the [**Fox Root Repository README**](../README.md).

[![Package: @fox/cli](https://img.shields.io/badge/Package-%40fox%2Fcli%20v0.1.0-blue.svg)](package.json)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun%201.2+-black.svg)](https://bun.sh/)
[![Architecture: Effect TS](https://img.shields.io/badge/Architecture-Effect_TS-purple.svg)](https://effect.website/)
[![Tests: 279 Pass](https://img.shields.io/badge/Tests-279_Pass-brightgreen.svg)](#testing)
[![Challenge Ladder: 334/334](https://img.shields.io/badge/Challenge_Ladder-334%2F334_(100%25)-success.svg)](#challenge-ladder)
[![Token Savings: 19.1%](https://img.shields.io/badge/Token_Savings-19.1%25-blueviolet.svg)](#compression)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../LICENSE)

---

## 🦊 Why You Should Use Fox Code CLI

### Who Is This For?

**Local-first developers** who want full control over their AI tooling. Fox is built for engineers who run models on their own hardware — no cloud dependency, no API rate limits, no data leaving your machine. Point Fox at any OpenAI-compatible endpoint (`ollama`, `llama.cpp`, `vLLM`, `text-generation-webui`) and go.

**Cloud model users** who want to cut costs. Fox ships with a [LiteLLM-based proxy](../openai-proxy/) that routes to Gemini, Claude, GPT-4, or any provider through a single `http://localhost:8000/v1` endpoint. The adaptive compression engine saves **19.1% of your token spend** — that's real money on cloud APIs.

**SWE teams building autonomous coding workflows.** Fox's transactional patch engine guarantees your workspace never breaks mid-edit. The oscillation detector catches strategy deadlocks. The repair budget prevents runaway loops. These aren't nice-to-haves — they're the difference between "run overnight" and "wake up to a mess."

### What Sets Fox Apart

| Capability | What it means for you |
|---|---|
| 🎯 **Adaptive Compression Engine** | Saves **19.1% of token costs** on every session. Heuristic content classifier assigns risk profiles — aggressive on noise, hands-off on critical data. Zero LLM calls. Sub-millisecond overhead. |
| 🛡️ **Transactional Patch Engine** | Every multi-file edit is ACID-atomic. If hunk 3 of 4 fails, all changes roll back instantly. Your workspace never breaks. |
| 🔁 **Oscillation Detection** | SHA-256 content hashing catches A→B→A strategy deadlocks before they burn your token budget. |
| 🧪 **334-Fixture Challenge Ladder** | The compression engine is stress-tested across SWE-bench, GAIA, WebArena, OSWorld, and adversarial inputs. 100% pass rate. |
| 🤖 **Guardian Architecture** *(coming)* | Dual-agent oversight: when you step away, a lightweight Guardian agent fills your seat — classifying failures, gating commits, and resetting poisoned context. |
| 📐 **Effect TS Foundation** | Strict dependency injection, typed errors, fiber-level concurrency. No global mutable state, no hidden side effects. |
| 🔌 **Any Model, Any Provider** | Local models via Ollama/vLLM, cloud models via the included LiteLLM proxy, or bring your own OpenAI-compatible endpoint. |

### Compression at a Glance

Fox's 10-transform adaptive pipeline compresses tool outputs before they hit your model's context window:

```
Raw tool output (100%)
  │
  ├─ L0: Path normalization, git rewrites, diff trimming,
  │      test filtering, tabular encoding, log dedup, JSON keys
  │
  ├─ L1: Timestamp stripping, boilerplate removal          ← NEW (Phase 2.0)
  │      (npm warnings, pip notices, Docker layer progress)
  │
  └─ L2: Repeated pattern collapsing                       ← NEW (Phase 2.0)
         (keeps first, last, and all error/warning lines)
  │
  ▼
Compressed output (~81% of original)
```

> **Token savings:** 26,095 tokens saved across 334 test fixtures (19.1% reduction).
> **Correctness:** 100% — zero semantic information lost. Every stack trace, line number, and error message preserved.
> **Latency:** 0.03ms average per compression pass. Invisible to the user.

---

## 📑 Table of Contents

- [Why You Should Use Fox Code CLI](#-why-you-should-use-fox-code-cli)
- [Overview](#overview)
- [Monorepo Package Topology](#topology)
- [Architecture & Monolith Decomposition](#architecture)
- [Installation & Getting Started](#installation)
- [CLI Command Reference](#commands)
- [Adaptive Compression Engine](#compression)
  - [The 10 Compression Transforms](#the-10-compression-transforms)
  - [Content Classification & Risk Profiles](#content-classification)
  - [Type-Safe Workflow Profiles](#type-safe-workflow-profiles)
- [Challenge Ladder (334 Fixtures)](#challenge-ladder)
- [Transactional Patch Engine](#transactional-patch-engine)
  - [Two-Phase Atomic Commit & In-Memory Journal](#two-phase-atomic-commit)
  - [4-Tier Match Confidence Scoring](#confidence-scoring)
  - [Unified Tooling Architecture](#unified-tooling)
- [Named Shadow Checkpoints & /undo](#checkpoints)
- [Open-Weights Model Profiles & Prompts Matrix](#model-profiles)
- [Autonomous Verification Layer](#autonomous-verification)
  - [Oscillation Detection](#oscillation-detection)
  - [Auto-Verification Runner](#auto-verification-runner)
  - [Repair Budget Tracker](#repair-budget-tracker)
- [Guardian Agent Architecture *(Coming)*](#guardian)
- [Configuration & Environment Variables](#configuration)
  - [Configuration File Resolution](#configuration-file-resolution)
  - [Environment Flags](#environment-flags)
  - [State Directories](#state-directories)
- [Testing & Verification (The 5-Tier Hierarchy)](#testing)
- [Roadmap](#roadmap)
- [Parent Ecosystem](#parent-ecosystem)

---

<a id="overview"></a>
## 🚀 Overview

`@fox/cli` is the core execution package of the Fox ecosystem. It functions as both a rich terminal-based developer tool and a headless protocol server:
- **Interactive Terminal UI (`fox` / `bun run dev`)**: An OpenTUI/SolidJS terminal interface featuring syntax highlighting, multi-turn chat, markdown rendering, tool lifecycle tracking, and slash commands.
- **Headless Autonomous Agent (`fox run`)**: Direct command-line task execution with automated tool approval (`--auto`) for continuous SWE execution loops.
- **Agent Client Protocol (ACP) Server (`fox acp`)**: Standardized JSON-RPC 2.0 over `stdio` server for direct pairing with the [Fox ACP Client](../fox-acp-client/) VS Code extension and other IDEs.
- **HTTP & SSE Instance Server (`fox serve`)**: REST and Server-Sent Events API server for local programmatic integration.

---

<a id="topology"></a>
## 🏛️ Monorepo Package Topology

The repository is organized as a Bun workspace monorepo under `packages/` with strict dependency layering:

| Package | Workspace Alias | Path | Purpose |
|---|---|---|---|
| **Core** | `@opencode-ai/core` | `packages/core/` | Base Effect TS runtime, canonical `Tool.make()` registry, file utilities, process management, adaptive compression pipeline, and transactional patch engine. |
| **Schema** | `@opencode-ai/schema` | `packages/schema/` | Effect `Schema` definitions for Agent, Session, Workflow, and message wire formats. |
| **LLM** | `@opencode-ai/llm` | `packages/llm/` | Unified `LLMEvent` stream representations and provider-agnostic chunk adapters. |
| **Server** | `@opencode-ai/server` | `packages/server/` | HTTP server, middleware, authentication, and Server-Sent Events (SSE) streaming infrastructure. |
| **TUI** | `@opencode-ai/tui` | `packages/tui/` | OpenTUI SolidJS terminal widgets, markdown parser, ANSI formatting, and theme palettes. |
| **Memory** | `@foxcode/memory` | `packages/fox-memory/` | Structured project knowledge (`project.md`, `corrections.md`), recall search, and decision logging. |
| **Sandbox** | `@foxcode/sandbox` | `packages/sandbox/` | Lightweight OS-level execution containment (Linux Bubblewrap / macOS Seatbelt). |
| **Indexing** | `@foxcode/indexing` | `packages/fox-indexing/` | Incremental AST parsing, symbol indexing, and vector store bindings. |
| **SQLite** | `@foxcode/effect-drizzle-sqlite` | `packages/effect-drizzle-sqlite/` | Generic Effect-wrapped Drizzle SQLite client for session persistence. |
| **HTTP Recorder**| `@foxcode/http-recorder` | `packages/http-recorder/` | Network fixture recorder/replayer for deterministic testing. |

---

<a id="architecture"></a>
## 🧩 Architecture & Monolith Decomposition

`@fox/cli` is engineered with **Effect TS**, providing strict dependency injection, typed errors, and fiber-level concurrency control.

```
┌────────────────────────────────────────────────────────┐
│             Fox CLI Orchestration Layer                │
│                      src/                              │
├──────────────────────────┬─────────────────────────────┤
│ src/session/prompt/      │ src/foxcode/background/     │
│  • prepare.ts (Context)  │  • lifecycle.ts (Spawn/Kill)│
│  • parts.ts (Resolution) │  • output.ts (Ring Buffers) │
│  • loop.ts (Turn Loop)   │  • types.ts (Limits/Ports)  │
│  • shell.ts (Terminal)   │  • index.ts (Public API)    │
│  • subtask.ts (Agents)   ├─────────────────────────────┤
│  • command-runner.ts     │ src/server/                 │
│  • title.ts (Titles)     │  • HTTP / WebSocket Auth    │
├──────────────────────────┴─────────────────────────────┤
│ Instance Isolation: InstanceState.make()               │
│ (Zero cross-session state pollution; bounded eviction) │
└────────────────────────────────────────────────────────┘
```

- **Decomposed Prompt Monolith**: The core conversation engine (`src/session/prompt.ts`) has been modularized from 2,504 lines to **495 lines**, delegating specialized tasks to focused sub-modules (`prepare`, `parts`, `loop`, `shell`, `subtask`, `command-runner`, `title`).
- **Decomposed Background Process Engine**: Modularized into `lifecycle.ts`, `output.ts`, and `types.ts` with bounded log ring-buffers and active port probing.
- **Instance State Isolation**: All mutable state (such as intake tracking and session abort controllers) is registered per-instance using `InstanceState.make()` to guarantee test isolation and eliminate cross-session race conditions.

---

<a id="installation"></a>
## 🛠️ Installation & Getting Started

### Prerequisites
- **[Bun](https://bun.sh/)** $\ge 1.1.0$ (required for runtime and test execution)
- **Node.js** $\ge 20.0.0$ (optional, for tooling compatibility)

### Building the Package
```bash
# 1. Install workspace dependencies
bun install

# 2. Verify monorepo TypeScript compilation (0 errors)
bun run typecheck

# 3. Compile distribution bundle (outputs to dist/)
bun run build
```

---

<a id="commands"></a>
## 💻 CLI Command Reference

The primary binary `fox` is located at `./bin/fox`:

```bash
# --- Interactive Mode ---
fox                             # Launch the OpenTUI terminal interface
bun run dev                     # Alternative dev launcher (= bun ./src/index.ts)

# --- Headless & Autonomous Execution ---
fox run "Summarize package.json" # Single query streamed to terminal
fox run "Fix tests in auth.ts" --auto # Autonomous tool approval (read, write, bash)

# --- Protocol & Server Endpoints ---
fox acp                         # Start the ACP JSON-RPC 2.0 server over stdio
fox serve --port 4096           # Start the HTTP REST & SSE API server

# --- Compression & Scoreboard Introspection ---
fox compression preview [mode]  # Inspect active transforms for swe, data, shell, etc.
fox compression snapshot         # View live characters saved, overhead, and stability hash
fox standard-suite tasks        # List the 12 curated SWE-bench Mini tasks
fox standard-suite scoreboard   # Render the live 52-fixture Baseline Scoreboard

# --- Subsystems & MCP ---
fox mcp list                    # List configured Model Context Protocol servers
fox mcp add <name>              # Register a new MCP server
fox db path                     # Print local SQLite database path

# --- Shadow Checkpoints & Undo ---
fox checkpoint list             # List recorded shadow checkpoints
fox checkpoint create <name>    # Create a named checkpoint before refactoring
fox checkpoint diff [name]      # Inspect diff against a checkpoint
fox checkpoint undo [name]      # Revert workspace to previous or named checkpoint
```

---

<a id="compression"></a>
## 📉 Adaptive Compression Engine

Fox's compression engine intercepts tool outputs before they reach the model context window. It uses a **heuristic content classifier** to assign risk profiles and compression levels, then applies transforms appropriate for each content type — aggressive on noise, hands-off on critical data.

### Key Numbers

| Metric | Value |
|--------|-------|
| **Global token savings** | **19.1%** (26,095 tokens saved across 334 fixtures) |
| **Correctness** | **100%** — 334/334 fixtures pass (SWE-bench, GAIA, WebArena, OSWorld) |
| **Latency overhead** | **0.03ms** average per compression pass |
| **Transforms** | **10** (7 baseline + 3 adaptive) |
| **LLM calls** | **0** — fully heuristic, no model dependency |

<a id="content-classification"></a>
### Content Classification & Risk Profiles

Every tool output is classified before adaptive transforms are applied:

| Risk | Max Level | Content Types | Behavior |
|------|-----------|---------------|----------|
| **Critical** | L0 (preserve) | Stack traces, GAIA reasoning, OSWorld state, `# no-truncate` content | No adaptive compression. Baseline transforms only. |
| **Cautious** | L1 (light) | DOM/HTML snapshots, multi-step traces, error-heavy logs (OOMKilled, CrashLoop) | Strip timestamps only. Never collapse patterns. |
| **Safe** | L3 (aggressive) | Shell output, diffs, test output, CI logs, build output | Full pipeline: timestamps, boilerplate, pattern collapsing. |

### The 10 Compression Transforms

#### Baseline Transforms (L0 — always active)

1. **Pre-Execution Git Rewrites**: Automatically injects `-sb` on `git status`, `-U1` on `git diff`, and `--oneline -n 20` on `git log`. (Bypass with `raw git <cmd>` or `\git <cmd>`).
2. **Render-Time Git Supersession**: Dynamically replaces obsolete earlier `git status`/`diff` tool results in the prompt history with lightweight pointer stubs (`[git status superseded by turn #N]`).
3. **Lockfile Diff Collapsing**: Detects `package-lock.json`, `bun.lockb`, `yarn.lock`, `Cargo.lock`, etc. Diffs $\ge 10$ lines are collapsed to summary statistics, saving 95%+ tokens.
4. **Test Output Filtering**: Collapses consecutive passing tests (`[...42 passing tests omitted...]`) while preserving 100% of stack traces and failure diagnostics.
5. **Shell Output Capping**: Enforces profile limits (e.g. 200 lines / 8 KB for SWE) with helpful navigation pointers. (Bypass with `# no-truncate` or `--full-output`).
6. **Columnar JSON Encoding**: Transforms arrays of uniform JSON records into compact columnar format.
7. **Workspace Path Normalization**: Relativizes deep absolute paths to clean workspace-relative paths.

#### Adaptive Transforms (L1+ — risk-gated, Phase 2.0)

8. **Timestamp Stripping** *(Level 1+)*: Removes ISO timestamps, HH:MM:SS prefixes, and epoch values from log-like lines. Preserves content after the timestamp. Requires ≥3 timestamps to activate. Skips diff content, commit messages, and structured data.
9. **Boilerplate Header Stripping** *(Level 1+)*: Strips recognized noise patterns (npm deprecation warnings, pip notices, Docker layer progress, Dockerfile build steps) using an allowlist. Groups consecutive matches into summaries: `[3 npm deprecation warnings stripped]`.
10. **Repeated Pattern Collapsing** *(Level 2+)*: Collapses runs of ≥5 consecutive structurally similar lines. Keeps first line, last line, and all lines containing error/warning keywords (ERROR, WARNING, OOM, crash, panic, BackOff, etc.).

### Safety Rails

- **Output Growth Guard**: If any transform increases output size, it is automatically reverted.
- **ROI Auto-Skip**: Transforms with consistently low ROI (< 5 chars/ms) are automatically disabled.
- **Escape Hatch**: Add `# no-truncate` to any command to bypass all compression.
- **Safe Mode**: Set `FOX_COMPRESSION_SAFE=true` to disable all transforms.
- **Level Cap**: Set `FOX_ADAPTIVE_MAX_LEVEL=0|1|2|3` to limit adaptive compression.

<a id="type-safe-workflow-profiles"></a>
### Type-Safe Workflow Profiles

Configure via `fox.jsonc` or `--workflow <name>`:

| Profile | Primary Purpose | Active Transforms |
|---|---|---|
| **`swe`** *(Default)* | Software Engineering | All 10 transforms active; shell capped at 200 lines / 8 KB. |
| **`auto`** | Default Alias | Resolves deterministically to `swe`. |
| **`data`** | Data Analysis / ML | Columnar JSON, key abbreviations, log line deduplication. |
| **`research`** | Technical Writing / Docs | High-fidelity text passthrough, path normalization. |
| **`shell`** | DevOps & SysAdmin | Path normalization and deduplication; **no truncation** on output. |
| **`none`** | Safe Mode | All tool transforms disabled; raw uncompressed passthrough. |

---

<a id="challenge-ladder"></a>
## 🏆 Fox Challenge Ladder (334 Fixtures)

The Challenge Ladder is a deterministic stress test for the compression engine. Every fixture tests a specific real-world content type against Fox's compression pipeline and verifies semantic invariants.

```
🦊 FOX CHALLENGE LADDER — SCOREBOARD
══════════════════════════════════════════════════════════════
  Tier 1 — Baseline                80.0/80   (100.0%)
    └ swe-bench-mini         40.0/40   avg compression:  2.0%
    └ gitops                 10.0/10   avg compression: 12.0%
    └ test-output            10.0/10   avg compression: 38.6%
    └ diff                   10.0/10   avg compression: 19.6%
    └ shell-output            5.0/5    avg compression: 38.8%
    └ document                5.0/5    avg compression: 43.7%
  Tier 2 — Long-Horizon          100.0/100  (100.0%)
    └ gitops-workflows       30.0/30   avg compression:  0.0%
    └ swe-multifile          25.0/25   avg compression:  0.9%
    └ shell-pipelines        25.0/25   avg compression:  6.7%
    └ multi-doc-research     20.0/20   avg compression:  0.0%
  Tier 3 — Adversarial             66.0/66   (100.0%)
    └ malformed-diffs        16.0/16   avg compression:  7.6%
    └ corrupted-logs         17.0/17   avg compression:  7.2%
    └ partial-stacktraces    17.0/17   avg compression:  0.0%
    └ ambiguous-workflows    16.0/16   avg compression:  0.0%
  Tier 4 — External Benchmarks     88.0/88   (100.0%)
    └ gaia-style             22.0/22   avg compression:  0.0%
    └ webarena-style         23.0/23   avg compression:  0.0%
    └ osworld-style          22.0/22   avg compression:  1.1%
    └ swe-bench-verified     21.0/21   avg compression:  0.9%
 ─────────────────────────────────────────────────────────────
  🏆 FOX CHALLENGE SCORE:  334.0/334  (100.0%)
══════════════════════════════════════════════════════════════
```

Every fixture validates three invariants:
1. **Semantic preservation** — `mustContain` keywords survive compression
2. **Non-expansion** — compressed output is never larger than input
3. **Stability** — `compress(x) === compress(compress(x))`

Historical results are stored in [`docs/challenge-history/`](docs/challenge-history/) for trend analysis.

---

<a id="transactional-patch-engine"></a>
## 🛡️ Transactional Patch Engine (Atomic Multi-File Edits & Rollback)

Fox replaces conventional sequential file-patching with an **ACID-inspired Transactional Patch Engine**. In traditional coding agents, multi-file edits or multi-hunk diffs are applied sequentially; if hunk 3 of 4 fails, hunks 1 and 2 remain modified on disk, leaving the workspace in an inconsistent, broken state.

Fox guarantees **all-or-nothing atomicity**: every patch transaction either applies completely across all files with high confidence, or immediately rolls back to its pre-mutation state with sub-millisecond overhead.

```
                  ┌─────────────────────────────────────┐
                  │        Incoming Patch / Edit        │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │ Phase 1: Dry-Run & Hunk Parsing     │
                  │   • Parse unified diffs / hunks     │
                  │   • Resolve relative workspace paths│
                  │   • Check pre-image existence       │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │ Phase 2: 4-Tier Match Confidence    │
                  │   • Tier 1: Exact (1.0)             │
                  │   • Tier 2: Normalized (0.95)       │
                  │   • Tier 3: Sliding Context (0.85)  │
                  │   • Tier 4: Context Trim (0.75)     │
                  └──────────────────┬──────────────────┘
                                     │
                       Confidence Threshold Met?
                                    / \
                              No   /   \   Yes
                             ┌────       ────┐
                             ▼               ▼
                 ┌───────────────────┐   ┌───────────────────────────────┐
                 │  ABORT & REJECT   │   │ Phase 3: Transaction Execute  │
                 │  Zero disk writes │   │   • Journal pre-image bytes   │
                 │  Inform LLM error │   │   • Write mutations to disk   │
                 └───────────────────┘   └──────────────┬────────────────┘
                                                        │
                                            All Writes Successful?
                                                       / \
                                                 No   /   \   Yes
                                                ┌────       ────┐
                                                ▼               ▼
                                    ┌───────────────────┐   ┌─────────────┐
                                    │  ATOMIC ROLLBACK  │   │   COMMIT    │
                                    │ Restore pre-image │   │ Transaction │
                                    │ Remove new files  │   │  Finalized  │
                                    └───────────────────┘   └─────────────┘
```

<a id="two-phase-atomic-commit"></a>
### Two-Phase Atomic Commit & In-Memory Journal
- **In-Memory Pre-Image Journaling**: Pre-mutation file contents are captured as raw `Uint8Array` byte buffers within an in-memory `Transaction` journal (`packages/core/src/transaction.ts`).
- **Zero Disk Dependency on Rollback**: If any hunk application errors, file write fails, or permission is denied, the engine executes an immediate zero-disk-dependency rollback: restoring modified files to their exact pre-image bytes and unlinking newly created files.
- **Dry-Run Validation Phase**: Every multi-file patch is pre-simulated in memory against target buffers before touching disk. Ambiguities, missing files, or out-of-bounds line numbers halt execution during dry-run with zero disk writes.

<a id="confidence-scoring"></a>
### 4-Tier Match Confidence Scoring
Every hunk match is evaluated across four decreasing tiers of certainty (`packages/core/src/transaction-confidence.ts`):
1. **Tier 1 — Exact Match (`1.0`)**: Byte-identical line matching against the target file.
2. **Tier 2 — Normalized Match (`0.95`)**: Matches after normalizing trailing whitespace, tabs, and CRLF line endings.
3. **Tier 3 — Sliding Context Match (`0.85`)**: Context matches within an offset search window when surrounding lines have shifted.
4. **Tier 4 — Context Trim Match (`0.75`)**: Reduced-context boundary matching when file boundaries or adjacent edits overlap.
- **Ambiguous Matches (< 0.70)**: Automatically rejected before disk modification, preventing unintended edits and model hallucinations.

<a id="unified-tooling"></a>
### Unified Tooling Architecture
Both the multi-file `apply_patch` tool (`packages/core/src/tool/apply-patch.ts`) and the surgical `edit` tool (`packages/core/src/tool/edit.ts`) execute through the same `FileMutation` transactional journal API (`packages/core/src/file-mutation.ts`). This guarantees unified error handling, logging, and rollback across both multi-hunk diffs and targeted string replacements.

---

<a id="checkpoints"></a>
## 🛡️ Named Shadow Checkpoints & /undo

Fox implements isolated, non-polluting shadow checkpoints via content-addressed Git trees:
- **Shadow Git Store**: Checkpoints are stored in internal shadow trees (`~/.local/share/fox/snapshot/`), completely isolated from the user's working branch. Your `git log` and `git status` remain 100% clean.
- **Pre-Mutation Baselines**: Every edit or patch automatically captures an initial baseline, guaranteeing that even the first mutation can be reverted.
- **Selective Restoration**: Reverting to a checkpoint inspects only the paths that diverged between the target and current tree, restoring those specific files without clobbering unrelated uncommitted work.
- **Bounded FIFO Ring Buffer**: Maintains up to $N$ checkpoints (default 10, configurable via `"checkpoints": { "max": 15 }` in `fox.jsonc`), evicting the oldest entries once full.
- **TUI & CLI Access**: Accessible via `fox checkpoint list/create/diff/undo` or interactive slash commands `/undo` and `/diff`.

---

<a id="model-profiles"></a>
## 🧠 Open-Weights Model Profiles & Prompts Matrix

Fox provides curated model family profiles specifically tuned for local and open-weights models (Ollama, vLLM, LiteLLM proxy, OpenRouter).

### Profiled Model Families

| Profile ID | Family / Target | Context Window | Tool Calling | Temp / Top-P | Prompt Budget | Recommended Use |
|---|---|---|---|---|---|---|
| `llama-3.3` | Meta Llama 3.3 70B Instruct | 131,072 | Native | 0.2 / 0.95 | 2048 | Complex reasoning, architecture refactoring |
| `llama-3.1` | Meta Llama 3.1 8B / 70B | 131,072 | Native | 0.2 / 0.95 | 2048 | General coding, fast edits, local GPU setups |
| `codestral` | Mistral Codestral (22B / 2508) | 32,768 | Native | 0.15 / 0.95 | 1500 | Code generation, fill-in-the-middle, precise edits |
| `mistral` | Mistral Large / Medium | 131,072 | Native | 0.2 / 0.95 | 2048 | Multi-file changes, broad software engineering |
| `gemma` | Google Gemma 2 / 4 (9B, 27B, 31B) | 32,768 | Native | 0.2 / 0.95 | 1500 | Concise responses, local memory constraints |
| `nemotron` | Nvidia Nemotron 3 Ultra / 4 | 131,072 | Native | 0.2 / 0.95 | 2048 | Enterprise SWE reasoning, agentic planning |
| `gpt-oss` | OpenAI GPT-OSS 120B | 131,072 | Native | 0.2 / 0.95 | 2048 | High-throughput open-weights execution |

### Auto-Detection & Compaction Alignment
- **Zero-Config Detection**: Model identifiers are matched case-insensitively against known patterns (e.g. `llama3.1:8b`, `meta-llama/llama-3.3-70b-instruct`, `codestral:22b`).
- **Context Window Alignment**: When connecting to local endpoints that report 0 or unknown context limits, Fox uses the profile's verified context window (e.g. 131,072 or 32,768) to dynamically calculate compaction thresholds, preventing silent context overflow.
- **Tailored System Prompts**: Profiles automatically switch to `local.txt`—a stripped-down, concise instruction prompt that eliminates boilerplate and preserves context budget for code and tool outputs.

### Manual Override
Override auto-detection from the CLI or configuration:
```bash
# Via CLI flag
fox run "Refactor auth handler" --model local/default --profile codestral

# Via environment variable
export FOX_MODEL_PROFILE=llama-3.3
```

Or in `fox.jsonc`:
```jsonc
{
  "model_profile": "llama-3.3",
  "checkpoints": {
    "max": 10
  }
}
```

---

<a id="autonomous-verification"></a>
## 🔁 Autonomous Verification Layer

The Autonomous Verification Layer provides three composable safety modules that protect against common failure modes in autonomous agent workflows (`fox run --auto` and `/goal` mode). All modules are **opt-in by default** and configurable via `fox.jsonc`.

```
┌───────────────────────────────────────────────────────────────────┐
│                  SESSION PROCESSOR (processor.ts)                 │
│                                                                   │
│  Agent invokes: edit / apply_patch / write / bash                │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │ Module 1: OSCILLATION DETECTOR (oscillation.ts)          │     │
│  │  • SHA-256 content-hash tracking per file across turns   │     │
│  │  • Detects A→B→A toggle patterns within sliding window   │     │
│  │  • Injects model-facing ⚠️ OSCILLATION DETECTED warning  │     │
│  └──────────────────────────────────────────────────────────┘     │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │ Module 2: AUTO-VERIFICATION RUNNER (verification.ts)     │     │
│  │  • Auto-detect test/typecheck/lint from package.json     │     │
│  │  • Execute with timeout + compress via LLTC pipeline     │     │
│  │  • Append compressed result to tool output               │     │
│  └──────────────────────────────────────────────────────────┘     │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │ Module 3: REPAIR BUDGET TRACKER (repair-budget.ts)       │     │
│  │  • Consecutive-failure counter per session                │     │
│  │  • Budget exhaustion → STOP warning to model              │     │
│  │  • Resets on passing verification or user message         │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

<a id="oscillation-detection"></a>
### Oscillation Detection (`packages/core/src/oscillation.ts`)

Tracks SHA-256 content hashes per file across a sliding window of turns. Detects when an agent toggles the same code between alternating states (A→B→A), which indicates a strategy deadlock. When detected, a model-facing warning is injected into the tool output telling the agent to try a fundamentally different approach.

- **Pattern Detection**: A→B→A toggles, A→B→A→B extended oscillation
- **No False Positives**: Ignores idempotent edits (A→A) and sequential unique changes (A→B→C→D)
- **Per-File Independence**: Multiple files tracked independently
- **Configurable Window**: `autonomous.oscillation_threshold` (default: 4 turns)

<a id="auto-verification-runner"></a>
### Auto-Verification Runner (`packages/core/src/verification.ts`)

Auto-detects project test commands from `package.json` scripts and provides compressed verification feedback. Prioritizes `scripts.test` > `scripts.typecheck` > `scripts.lint`. User can override with `autonomous.test_command` in `fox.jsonc`.

- **Auto-Detection**: Parses `package.json` for `test`, `test:check`, `typecheck`, `check`, `lint` scripts
- **Override**: `autonomous.test_command` for custom verification commands
- **Output Compression**: Truncates large outputs keeping the tail (most useful for error summaries)
- **Timeout**: `autonomous.test_timeout` (default: 30000ms)

<a id="repair-budget-tracker"></a>
### Repair Budget Tracker (`packages/core/src/repair-budget.ts`)

Session-scoped counter tracking consecutive failed verification cycles. When the budget is exhausted, emits a warning instructing the agent to stop the current approach.

- **Budget**: `autonomous.max_repair_turns` (default: 3 consecutive failures)
- **Reset**: Consecutive failure count resets on passing verification or user message
- **Observability**: `totalRepairTurns` counter never resets (session-wide metric)
- **Integration**: Reports `blocked` status to GoalState in `/goal` mode

### Configuration

All settings live under the `autonomous` key in `fox.jsonc`:

```jsonc
{
  "autonomous": {
    "auto_verify": true,           // Run tests after mutation tools (default: true)
    "test_command": null,          // Override auto-detected test command (null = auto-detect)
    "test_timeout": 30000,         // Verification timeout in ms
    "detect_oscillations": true,   // Enable oscillation detection (default: true)
    "oscillation_threshold": 4,    // Sliding window size for oscillation detection
    "max_repair_turns": 3          // Max consecutive failed verifications before warning
  }
}
```

---

<a id="guardian"></a>
## 🦅 Guardian Agent Architecture *(Coming in Phase 2A)*

Fox's next major feature is the **Guardian** — a dual-agent oversight layer. In interactive mode, the human is the guardian. In `--auto` mode, nobody fills that role. The Guardian agent fills this gap.

### The Core Idea

```
Guardian Layer (always present)

  Interactive:   advise    (notes in UI, human decides)
  --auto:        enforce   (injects into doer context)
  /goal + auto:  surrogate (full human stand-in)

  Same model, same logic, same analysis.
  Only the authority policy changes.
```

### What the Guardian handles vs. Hard-Coded Circuit Breakers

| Capability | Hard-Coded | Guardian | Why |
|---|---|---|---|
| Exact oscillation (A→B→A) | ✅ SHA-256 | — | Mathematically checkable, free |
| Doom-loop (identical calls) | ✅ String compare | — | Trivially deterministic |
| **Failure classification** | ❌ | ✅ LLM classifies | Requires reasoning |
| **Strategy selection** | ❌ | ✅ LLM selects | Requires judgment |
| **Semantic oscillation** | ❌ | ✅ LLM sees patterns | Requires comprehension |
| **Quality assessment** | ❌ | ✅ LLM reviews diffs | Requires understanding |

### Guardian × Compression Integration

The Guardian and adaptive compression are complementary — not competing:
- **Compression** is the engine (deterministic, sub-millisecond, every tool call)
- **Guardian** is the driver (LLM-based, at decision points only, ~3-5 calls per session)

Guardian's only compression involvement: setting a session-level policy at intake ("this is a production debugging session, maximize fidelity") and triggering the Chaff Shield during context compaction.

> 📄 Full design: [`docs/future/2026-09-22T15-16_autonomous-dual-agent-design.md`](docs/future/2026-09-22T15-16_autonomous-dual-agent-design.md)

---

<a id="configuration"></a>
## ⚙️ Configuration & Environment Variables

### Configuration File Resolution

Fox searches for project-level and global configuration in this precedence order:
1. `fox.jsonc` $\to$ `fox.json`
2. `kilo.jsonc` $\to$ `kilo.json`
3. `opencode.jsonc` $\to$ `opencode.json`

Directory config is resolved from `.fox/`, `.kilo/`, or `~/.config/fox/`.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": "local/default",
  "provider": {
    "local": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Local LLM",
      "options": {
        "baseURL": "http://localhost:8000/v1",
        "apiKey": "local-dev"
      },
      "models": {
        "default": {
          "id": "gpt-4o-mini",
          "name": "Local Fast Model",
          "tools": true
        }
      }
    }
  }
}
```

### Environment Flags

All runtime settings use canonical `FOX_*` environment variables:

| Variable | Default | Purpose |
|---|:---:|---|
| `OPENAI_BASE_URL` | — | OpenAI-compatible endpoint (e.g. `http://localhost:8000/v1`) |
| `OPENAI_API_KEY` | — | API key for local or remote provider |
| `FOX_EXPERIMENTAL_COMPRESS` | `true` | Master switch for all tool token compression |
| `FOX_EXPERIMENTAL_COMPRESS_ADAPTIVE` | `true` | Enable adaptive compression (Phase 2.0 transforms) |
| `FOX_ADAPTIVE_MAX_LEVEL` | `3` | Max adaptive compression level (0=off, 1=light, 2=moderate, 3=aggressive) |
| `FOX_EXPERIMENTAL_COMPRESS_GIT` | `true` | Enable/disable automatic Git command rewrites |
| `FOX_EXPERIMENTAL_COMPRESS_DIFF` | `true` | Enable/disable `-U1` diff context trimming |
| `FOX_COMPRESSION_SAFE` | `false` | Safe mode: forces profile to `none` (disables all compression) |
| `FOX_WORKLOAD` | `swe` | Override the active workflow profile |
| `FOX_LOG_LEVEL` | `INFO` | Logging level (`DEBUG`, `INFO`, `WARN`, `ERROR`) |

### State Directories

- **Key-Value Store**: `~/.local/state/fox/kv.json`
- **Session & Snapshots**: `~/.local/share/fox/`
- **Daemon Logs**: `~/.local/state/fox/log/`

---

<a id="testing"></a>
## 🧪 Testing & Verification (The 5-Tier Hierarchy)

Fox enforces a **5-Tier Testing Hierarchy** to guarantee zero regressions:

```
Tier 1: Targeted Module Tests   (~200ms) ──► On every edit / save
Tier 2: Category Suites         (~1-2s)  ──► After modifying a subsystem
Tier 3: Quick Smoke Suite       (~15s)   ──► Before staging (git add)
Tier 4: App & Invariant Suites  (~2s)    ──► Pre-commit verification (all 31 suites + 6 invariant categories)
Tier 5: Full Monorepo & Build   (~45s)   ──► Pre-push and CI validation
```

### Key Test Commands
```bash
# Tier 1 — Run an individual test file
bun test test/session/prompt-loop.test.ts

# Tier 2 — Category test suites
bun run test:patch              # Patch parser, transactional journal & confidence (58 tests)
bun run test:edit               # Edit replacers & line normalization (48 tests)
bun run test:config             # Config merge & precedence (36 tests)
bun run test:compress           # Compression pipeline & ROI (88 tests)

# Tier 3 — Quick Smoke (Typecheck + core invariants)
bun run test:smoke              # ~20 seconds (279 tests, 566 expects)

# Tier 4 — App-level tests & Challenge Ladder
bun run test:app                # All app tests across 31 suites
bun run test:standard-suite     # 52-fixture Fox Standard Test Suite

# Tier 5 — Full monorepo verification
bun run test                    # Typecheck + all internal packages + app tests
bun run build                   # Full dist/ compilation

# Challenge Ladder — Compression stress test
CI=true bun test test/challenge-ladder.test.ts  # 334-fixture ladder + A/B showdown
```

---

<a id="roadmap"></a>
## 🗺️ Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 1** | ✅ Complete | Core compression pipeline (7 transforms), transactional patch engine, autonomous verification |
| **Phase 1B** | ✅ Complete | Compression hardening — Challenge Ladder (334 fixtures), bug fixes, A/B showdown |
| **Phase 2.0** | ✅ Complete | Adaptive compression — content classifier, risk profiles, 3 new transforms (19.1% savings) |
| **Phase 2A** | 🔧 In Progress | Guardian agent core — post-failure analysis, pre-commit review, progress monitoring |
| **Phase 2B** | 📋 Planned | Multi-model routing, blast-radius regression detection, LSP confidence scoring |
| **Phase 3** | 📋 Planned | Guardian task decomposition, OS-level sandboxing, long-horizon project memory |

> 📄 Full roadmap: [`docs/plans/2026-09-23T11-22_master-plan.md`](docs/plans/2026-09-23T11-22_master-plan.md)

---

<a id="parent-ecosystem"></a>
## 🌐 Parent Ecosystem

For the high-level ecosystem overview, competitor comparison matrix, VS Code extension client, and Docker development proxies, see the [**Root Fox Repository README**](../README.md).
