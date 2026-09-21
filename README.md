# 🦊 Fox Code CLI (`@fox/cli`)

> 🌐 **Part of the [Fox Ecosystem](../README.md)**. For the high-level ecosystem overview, benchmark scoreboard, VS Code extension, and local model proxy setup, see the [**Fox Root Repository README**](../README.md).

> The autonomous software engineering engine and ACP server for the Fox ecosystem. Built on **Bun** and **Effect TS**, engineered for local-first AI software development with **lossless tool token compression** and **stable KV-cache optimization**.

[![Package: @fox/cli](https://img.shields.io/badge/Package-%40fox%2Fcli%20v0.1.0-blue.svg)](package.json)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun%201.2+-black.svg)](https://bun.sh/)
[![Architecture: Effect TS](https://img.shields.io/badge/Architecture-Effect_TS-purple.svg)](https://effect.website/)
[![Tests: 365 Pass](https://img.shields.io/badge/Tests-365_Pass-brightgreen.svg)](#testing)
[![Standard Suite](https://img.shields.io/badge/Standard_Suite-52_Golden_Fixtures-success.svg)](docs/fox-standard-test-suite-scoreboard.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../LICENSE)

---

## 📑 Table of Contents

- [Overview](#overview)
- [Monorepo Package Topology](#topology)
- [Architecture & Monolith Decomposition](#architecture)
- [Installation & Getting Started](#installation)
- [CLI Command Reference](#commands)
- [Lossless Tool Token Compression](#compression)
  - [The 7 Compression Transforms](#the-7-compression-transforms)
  - [Type-Safe Workflow Profiles](#type-safe-workflow-profiles)
- [Transactional Patch Engine](#transactional-patch-engine)
  - [Two-Phase Atomic Commit & In-Memory Journal](#two-phase-atomic-commit)
  - [4-Tier Match Confidence Scoring](#confidence-scoring)
  - [Unified Tooling Architecture](#unified-tooling)
- [Autonomous Verification Layer](#autonomous-verification)
  - [Oscillation Detection](#oscillation-detection)
  - [Auto-Verification Runner](#auto-verification-runner)
  - [Repair Budget Tracker](#repair-budget-tracker)
- [Configuration & Environment Variables](#configuration)
  - [Configuration File Resolution](#configuration-file-resolution)
  - [Environment Flags](#environment-flags)
  - [State Directories](#state-directories)
- [Testing & Verification (The 5-Tier Hierarchy)](#testing)
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
| **Core** | `@opencode-ai/core` | `packages/core/` | Base Effect TS runtime, canonical `Tool.make()` registry, file utilities, process management, token compression pipeline, and transactional patch engine. |
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
```

---

<a id="compression"></a>
## 📉 Lossless Tool Token Compression

Fox's compression engine intercepts tool outputs before they reach the model context window, compressing outputs by **52.3% to 76.4%** while strictly preserving all diff patches, line numbers, and error traces.

### The 7 Compression Transforms

1. **Pre-Execution Git Rewrites**: Automatically injects `-sb` on `git status`, `-U1` on `git diff`, and `--oneline -n 20` on `git log`. (Bypass with `raw git <cmd>` or `\git <cmd>`).
2. **Render-Time Git Supersession**: Dynamically replaces obsolete earlier `git status`/`diff` tool results in the prompt history with lightweight pointer stubs (`[git status superseded by turn #N]`).
3. **Lockfile Diff Collapsing**: Detects `package-lock.json`, `bun.lockb`, `yarn.lock`, `Cargo.lock`, etc. Diffs $\ge 10$ lines are collapsed to summary statistics, saving 95%+ tokens.
4. **Test Output Filtering**: Collapses consecutive passing tests (`[...42 passing tests omitted...]`) while preserving 100% of stack traces and failure diagnostics.
5. **Shell Output Capping**: Enforces profile limits (e.g. 200 lines / 8 KB for SWE) with helpful navigation pointers. (Bypass with `# no-truncate` or `--full-output`).
6. **Columnar JSON Encoding**: Transforms arrays of uniform JSON records into compact columnar format.
7. **Workspace Path Normalization**: Relativizes deep absolute paths to clean workspace-relative paths.

### Type-Safe Workflow Profiles

Configure via `fox.jsonc` or `--workflow <name>`:

| Profile | Primary Purpose | Active Transforms |
|---|---|---|
| **`swe`** *(Default)* | Software Engineering | All 7 transforms active; shell capped at 200 lines / 8 KB. |
| **`auto`** | Default Alias | Resolves deterministically to `swe`. |
| **`data`** | Data Analysis / ML | Columnar JSON, key abbreviations, log line deduplication. |
| **`research`** | Technical Writing / Docs | High-fidelity text passthrough, path normalization. |
| **`shell`** | DevOps & SysAdmin | Path normalization and deduplication; **no truncation** on output. |
| **`none`** | Safe Mode | All tool transforms disabled; raw uncompressed passthrough. |

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

<a id="autonomous-verification"></a>
## 🛡️ Autonomous Verification Layer

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
| `FOX_EXPERIMENTAL_COMPRESS_GIT` | `true` | Enable/disable automatic Git command rewrites |
| `FOX_EXPERIMENTAL_COMPRESS_DIFF` | `true` | Enable/disable `-U1` diff context trimming |
| `FOX_EXPERIMENTAL_COMPRESS_LOCKFILE` | `true` | Enable/disable lockfile hunk collapsing |
| `FOX_EXPERIMENTAL_COMPRESS_TESTS` | `true` | Enable/disable passing test line collapsing |
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
bun test test/foxcode/daemon-schema.test.ts

# Tier 2 — Category test suites
bun run test:patch              # Patch parser, transactional journal & confidence (58 tests)
bun run test:edit               # Edit replacers & line normalization (48 tests)
bun run test:config             # Config merge & precedence (36 tests)
bun run test:compress           # Compression pipeline & ROI (88 tests)
bun run test:schema-stability   # Wire format stability tests

# Tier 3 — Quick Smoke (Typecheck + core invariants)
bun run test:smoke              # ~20 seconds

# Tier 4 — App-level tests & Invariant scoreboard
bun run test:app                # All 309 tests across 31 suites in test/ (~1s)
bun run test:standard-suite     # 52-fixture Fox Standard Test Suite (~1s)

# Tier 5 — Full monorepo verification
bun run test                    # Typecheck + all internal packages + app tests
bun run build                   # Full dist/ compilation
```

---

<a id="parent-ecosystem"></a>
## 🌐 Parent Ecosystem

For the high-level ecosystem overview, competitor comparison matrix, VS Code extension client, and Docker development proxies, see the [**Root Fox Repository README**](../README.md).
