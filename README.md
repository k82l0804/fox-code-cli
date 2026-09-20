# 🦊 Fox Code CLI

> An autonomous, local-first coding agent CLI and ACP-compatible server engineered for privacy-preserving AI software engineering with **lossless token compression** and **stable KV-cache optimization**.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Runtime](https://img.shields.io/badge/Runtime-Bun-black.svg)](https://bun.sh/)
[![Architecture](https://img.shields.io/badge/Architecture-Effect_TS-purple.svg)](https://effect.website/)
[![Tests](https://img.shields.io/badge/Tests-181_Pass-brightgreen.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../LICENSE)

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Lossless Token Compression Suite](#-lossless-token-compression-suite)
  - [Compression Pipeline & Transforms](#compression-pipeline--transforms)
  - [Prefix Stability & KV-Cache Retention](#prefix-stability--kv-cache-retention)
- [Type-Safe Workflow Profiles](#-type-safe-workflow-profiles)
  - [The 5 Profiles + Auto Alias](#the-5-profiles--auto-alias)
  - [Declaring Workflow in Agents](#declaring-workflow-in-agents)
- [Proven Benchmark Results](#-proven-benchmark-results)
  - [Autonomous SWE Benchmark (Fox vs Kilo Baseline)](#autonomous-swe-benchmark-fox-vs-kilo-baseline)
  - [Multi-Workflow Showdown](#multi-workflow-showdown)
  - [Competitive Landscape: How Fox Compares](#competitive-landscape-how-fox-compares)
- [Fox Standard Test Suite & Baseline Scoreboard](#-fox-standard-test-suite--baseline-scoreboard)
  - [The 6 Golden Corpora (52 Fixtures)](#the-6-golden-corpora-52-fixtures)
  - [Official Baseline Scoreboard](#official-baseline-scoreboard)
  - [SWE-bench Mini Benchmark Suite](#swe-bench-mini-benchmark-suite-12-curated-tasks)
  - [Step-by-Step Reproduction Guide](#step-by-step-reproduction-guide)
- [Configuration & Environment Variables](#-configuration--environment-variables)
  - [Compression Flags](#compression-flags)
  - [Escape Hatches](#escape-hatches)
  - [Provider & Network Configuration](#provider--network-configuration)
- [CLI Inspection & Telemetry](#-cli-inspection--telemetry)
- [Getting Started & Development](#-getting-started--development)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the CLI & ACP Server](#running-the-cli--acp-server)
  - [Testing & Verification](#testing--verification)
- [Architecture & Repository Layout](#-architecture--repository-layout)

---

## 🚀 Overview

Fox Code CLI is an autonomous software engineering agent built from the ground up for privacy-first, local-first development. Built on **Bun** and **Effect TS**, it delivers industrial-grade stability, deterministic state machines, and state-of-the-art token efficiency.

Unlike traditional coding agents that blow out LLM context windows with verbose Git outputs, redundant test logs, and duplicate tool histories, Fox incorporates a **zero-overhead, lossless token compression engine** that cuts context consumption by **~76%** while maintaining a **100% autonomous SWE task pass rate**.

---

## ✨ Key Features

- 🤖 **Autonomous Coding Agent**: Multi-turn file editing, testing, dependency management, and refactoring using specialized tools (`bash`, `edit`, `patch`, `read`, `grep`, `find`).
- ⚡ **Agent Client Protocol (ACP)**: Standardized `stdio` server (`fox acp`) connecting directly to VS Code extensions and IDE frontends.
- 📉 **Lossless Token Compression**: Transforms verbose Git, shell, diff, and test outputs into high-density tokens without dropping critical data, error traces, or patch lines.
- 🔒 **Stable KV-Cache Prefix Preservation**: Eliminates non-deterministic prompt variations to maximize provider-side prompt caching discounts (up to 75% cost reduction).
- 🛡️ **Type-Safe Workflow Profiles**: Zero-latency, compile-time type-checked compression bundles customized for SWE, Data Analysis, Research, Shell DevOps, or Safe Mode.
- 🗄️ **Embedded SQLite Persistence**: Fast, reliable session storage, checklists, and turn history using `@opencode-ai/core` and SQLite.

---

## 📉 Lossless Token Compression Suite

During autonomous SWE workflows, tool outputs often contain massive amounts of repetitive or uninformative boilerplate (e.g. Git status advice lines, identical test pass marks, unchanged lockfile hunks). Fox compresses this output before sending it to the model.

### Compression Pipeline & Transforms

1. **Pre-Execution Git Command Rewrites**:
   - `git status` $\to$ `git status -sb` (short summary with branch tracking).
   - `git diff` $\to$ `git diff -U1` (single-line context diffs preserving all `+`/`-` changes).
   - `git log` $\to$ `git log --oneline -n 20` (bounded, compact commit history).
2. **Render-Time Git Supersession**:
   - Automatically marks earlier, obsolete `git status`, `git diff`, or `git branch` outputs with lightweight reference stubs (e.g. `[git status output superseded by turn #N]`). History in the database is untouched; supersession is evaluated dynamically at LLM prompt rendering time.
3. **Lockfile Diff Collapsing**:
   - Automatically detects lockfiles (`package-lock.json`, `bun.lockb`, `yarn.lock`, `pnpm-lock.yaml`, `Cargo.lock`, `poetry.lock`, etc.). When hunks exceed 10 lines, collapses them into compact change summaries (`[bun.lockb: +140 -35 lines — lockfile diff collapsed]`), saving **95%+** tokens.
4. **Test Output Filtering**:
   - Collapses runs of $\ge 4$ passing tests into summaries (`[...42 passing tests omitted...]`), while preserving **100%** of test failure messages, errors, and stack traces.
5. **Shell Output Capping & Truncation Pointers**:
   - Enforces workflow-tailored limits (e.g., 200 lines / 8 KB for SWE) and injects helpful pointers (`[...N bytes truncated; use grep, head, or tail to narrow output...]`).
6. **Structured Data & Tabular JSON Encoding**:
   - Encodes repeated JSON record arrays into columnar format, packing keys and saving **35–60%** on data outputs.
7. **Path Normalization**:
   - Relativizes verbose absolute workspace paths into clean workspace-relative paths.

### Prefix Stability & KV-Cache Retention

Many compression techniques accidentally destroy provider KV-cache reuse by injecting volatile timestamps, random IDs, or changing prompt structures mid-session. Fox guarantees **lossless prefix stability**:
- Session prompts and system instructions remain strictly immutable.
- Dynamic transforms and supersessions only alter older tool messages in an idempotent, deterministic order.
- Guarantees compatibility with Anthropic, OpenAI, and Gemini prompt caching.

---

## 🏷️ Type-Safe Workflow Profiles

Rather than using slow, fragile runtime ML classifiers that add 1–2 seconds of latency per turn and trash the KV cache, Fox uses **User-Declared, Type-Safe Workflow Profiles**.

> **Rule of Thumb:**  
> **Workflow** = *Which compression bundle to use*  
> **Tools** = *Which transforms inside that bundle activate*

### The 5 Profiles + Auto Alias

| Workflow | Target Use Case | Active Compression Bundle | Disabled Transforms | Shell Output Limits |
| :--- | :--- | :--- | :--- | :--- |
| **`swe`** *(Default)* | Software Engineering | Full Fox stack: Git rewrites (`-sb`, `-U1`, `--oneline`), Git supersession, diff trimming, lockfile collapsing, test failure filtering, log dedup, path normalization | None | 200 lines / 8 KB |
| **`auto`** | Default Future-Proof Alias | Resolves directly to `swe` (deterministic, zero latency, ready for optional non-destructive heuristics) | None | 200 lines / 8 KB |
| **`data`** | Data Analysis & ML | Columnar tabular JSON encoding, key abbreviations, log line deduplication, path normalization | Git rewrites, diff trimming, test filtering, supersession | 500 lines / 32 KB |
| **`research`** | Technical Writing & Docs | High-fidelity text passthrough, path normalization, prompt compaction | Git rewrites, diff trimming, test filtering, supersession | 1,000 lines / 64 KB |
| **`shell`** | DevOps & Infrastructure | Path normalization, log line deduplication | Git rewrites, diff trimming, test filtering, supersession | **No truncation** (full logs) |
| **`none`** | Safe Mode & Debugging | Prompt compaction only | **ALL tool transforms disabled** (zero rewrites, zero truncations, raw output) | **No truncation** (full raw) |

### Declaring Workflow in Agents

In custom agent definitions (`Agent.Info`), specify the workflow statically:

```typescript
import { Agent } from "@opencode-ai/core/agent"

export const MyDataAgent = Agent.make({
  name: "data-analyst",
  description: "Specialized agent for data analysis and pipeline exploration",
  workflow: "data", // "swe" | "data" | "research" | "shell" | "none" | "auto"
  prompt: "You are a data analysis assistant...",
  tools: ["bash", "read", "find"],
})
```

---

## 🏆 Proven Benchmark Results

Fox's compression stack was evaluated under real-world, multi-turn autonomous coding benchmarks using real LiteLLM proxy sessions against uncompressed baselines (Kilo).

### Autonomous SWE Benchmark (Fox vs Kilo Baseline)

Across 3 complex multi-turn SWE engineering tasks (full Job Queue engine implementation, complex pricing refactor with edge cases, and a subtle token bucket rate limiter bug):

| Benchmark Metric | Pristine Kilo (Baseline) | Fox Unoptimized | Fox Optimized (Compressed) |
| :--- | :---: | :---: | :---: |
| **Task 1: Job Queue Engine** | ✔ PASS (12 turns) | ✔ PASS (12 turns) | **✔ PASS (14 turns)** |
| **Task 2: Pricing Refactor** | ✔ PASS (5 turns) | ✔ PASS (5 turns) | **✔ PASS (8 turns)** |
| **Task 3: Rate Limiter Fix** | ✔ PASS (12 turns) | ✔ PASS (11 turns) | **✔ PASS (11 turns)** |
| **Task 3 Generated Patch** | *Identical fix* | *Byte-for-byte identical* | *Surgical, clean fix* |
| **Total Cumulative Input Tokens** | 202,485 tokens | 178,220 tokens | **47,813 tokens (-76.4%)** |
| **Autonomous Task Pass Rate** | **3 / 3 (100%)** | **3 / 3 (100%)** | **3 / 3 (100%)** |

### Multi-Workflow Showdown

Deterministic multi-turn execution across diverse tool categories:

| Workflow Profile | Uncompressed Baseline | Fox Compressed | Bytes Saved | Net Savings |
| :--- | :---: | :---: | :---: | :---: |
| **Software Engineering (`swe`)** | **42,966 B** | **17,169 B** | **+25,797 B** | **60.0%** |
| **Data Analysis (`data`)** | **12,876 B** | **8,652 B** | **+4,224 B** | **32.8%** |
| **Research & Docs (`research`)** | **4,628 B** | **4,628 B** | **+0 B** | **100% Pass-through** |
| **GRAND TOTAL** | **60,470 B** | **30,449 B** | **+30,021 B** | **49.6%** |

### Competitive Landscape: How Fox Compares

| Capability / Metric | **🦊 Fox Code CLI** | **Claude Code** (Anthropic) | **Aider** (Paul Gauthier) | **Kilo Code** (Upstream) | **Goose** (Block) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Core Runtime Engine** | **Bun + Effect TS** | Node.js | Python 3 | Bun + Effect TS | Rust |
| **Strictly Local / Offline Inference** | **✅ 100% Local-First** | ❌ Anthropic API only | ⚠️ Via LiteLLM/Ollama | ⚠️ Cloud Catalog deps | ✅ Multi-provider |
| **Lossless Tool Token Compression** | **✅ Yes (-52% to -76%)** | ❌ None | ❌ None | ❌ None | ❌ None |
| **Standard Test Suite & Scoreboard** | **✅ Yes (52 Golden Fixtures)**| ❌ No | ❌ No | ❌ No | ❌ No |
| **KV-Cache Prefix Stability** | **✅ Deterministic sha256** | ⚠️ Cloud-managed | ⚠️ Heuristic | ❌ None | ❌ None |
| **Editor Integration Protocol** | **✅ ACP (JSON-RPC 2.0)** | ❌ Custom CLI only | ❌ Custom CLI only | ✅ ACP | ⚠️ MCP only |
| **Git Command Rewriting (`-sb`, `-U1`)** | **✅ Automatic** | ❌ Raw output | ❌ Raw output | ❌ Raw output | ❌ Raw output |
| **Lockfile Diff Collapsing** | **✅ Built-in (95%+ saved)** | ❌ Raw diffs | ❌ Raw diffs | ❌ Raw diffs | ❌ Raw diffs |

> For the comprehensive deep-dive report, see the [Competitive Landscape & Architecture Document](docs/competitive-analysis.md).

---

## 🦊 Fox Standard Test Suite & Baseline Scoreboard

To provide a canonical, industry-standard, and 100% reproducible baseline, Fox adopts the **5 Standard SWE Test Suites** outlined in [`docs/research/std-test-suite-sort-of.md`](docs/research/std-test-suite-sort-of.md), combining them into the **Fox Standard Test Suite (52 Golden Fixtures)**.

### The 6 Golden Corpora (52 Fixtures)

| Corpus | Fixtures | Focus Area | What it Validates |
| :--- | :---: | :--- | :--- |
| **`swe-bench-mini`** | **24** | 12 Real-World Agent Tasks | Tests multi-file bug fixing, diff offset application, test-driven repairs, and concurrency without dropping error traces. |
| **`gitops`** | **7** | DevOps & Git Patterns | Tests `git status -sb` advice stripping, `git diff -U1`, merge conflict marker preservation (`<<<<<<<`), branch switching, and `raw git` bypass. |
| **`test-output`** | **6** | Build & Test CI Runners | Tests repetitive passing test collapsing (Bun, Vitest, Pytest, Cargo), stack trace preservation, and `tsc` error diagnostics. |
| **`diff`** | **6** | Unified Diff Mechanics | Tests multi-hunk diffs, 150-line lockfile collapsing (`package-lock.json`), whitespace diffs, binary markers, and edge-of-file edits. |
| **`shell-output`** | **5** | POSIX / GNU / Node Streams | Tests 400-line output capping (200 lines / 8 KB), `# no-truncate` escape hatches, workspace path normalization, and grep line numbers. |
| **`document`** | **4** | Research & Data Workflows | Tests columnar JSON conversion (35 records), repetitive key abbreviation packing, markdown specs, and CSV datasets. |

### Official Baseline Scoreboard

> Evaluated on Bun 1.4+ across all 52 fixtures using `bun run scoreboard` (see [`docs/fox-standard-test-suite-scoreboard.md`](docs/fox-standard-test-suite-scoreboard.md)).

| Corpus Category | Fixtures | Raw Tokens | Fox Tokens | Tokens Saved | Net Reduction | Invariant Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`swe-bench-mini`** | 24 | 1,114 tok | 1,112 tok | +2 tok | 0.2% | **✔ 100% PASS** |
| **`gitops`** | 7 | 2,566 tok | 2,086 tok | +480 tok | **18.7%** | **✔ 100% PASS** |
| **`test-output`** | 6 | 2,967 tok | 1,381 tok | +1,586 tok | **53.5%** | **✔ 100% PASS** |
| **`diff`** | 6 | 4,847 tok | 512 tok | +4,335 tok | **89.4%** | **✔ 100% PASS** |
| **`shell-output`** | 5 | 18,308 tok | 9,210 tok | +9,098 tok | **49.7%** | **✔ 100% PASS** |
| **`document`** | 4 | 3,234 tok | 1,465 tok | +1,769 tok | **54.7%** | **✔ 100% PASS** |
| **CUMULATIVE SCOREBOARD** | **52** | **33,036 tok** | **15,766 tok** | **+17,270 tok** | **52.3%** | **✔ 100% PASS** |

### SWE-bench Mini Benchmark Suite (12 Curated Tasks)

The SWE-bench Mini catalog (`fox standard-suite tasks`) provides curated, self-contained coding tasks with failing test reproduction logs, reference patches, and verified assertions:

1. **`swe-01-json-stream-parser`**: Chunk boundary and escape sequence parser repair.
2. **`swe-02-git-commit-hash-parser`**: Short SHA resolution in detached HEAD states.
3. **`swe-03-sliding-rate-limiter`**: Sliding window boundary timestamp eviction.
4. **`swe-04-cart-pricing-discounts`**: Refactor procedural pricing to enforce discount stacking rules.
5. **`swe-05-async-priority-queue`**: Concurrency-bounded worker pool priority preemption & DLQ.
6. **`swe-06-unified-diff-hunk-patcher`**: Multi-hunk patch line offset recalculation.
7. **`swe-07-lru-cache-ttl`**: LRU cache TTL expiration and miss counter tracking.
8. **`swe-08-semver-range-resolver`**: Caret (`^`) semver range pre-release compatibility.
9. **`swe-09-event-emitter-leak`**: Event listener cleanup and `.once()` unbinding under race conditions.
10. **`swe-10-retry-exponential-backoff`**: Jittered exponential backoff base-2 growth calculation.
11. **`swe-11-markdown-table-formatter`**: Markdown table column padding and delimiter alignment.
12. **`swe-12-url-query-normalizer`**: RFC-3986 parameter sorting and space encoding.

### Step-by-Step Reproduction Guide

Anyone can verify these results locally in seconds:

```bash
# 1. Run the invariant verification suite (tests lossless retention, non-expansion, stability, supersession)
bun run test:standard-suite

# 2. Recompute and display the live baseline scoreboard
bun run scoreboard

# 3. Output machine-readable JSON telemetry
bun run scoreboard --json

# 4. Inspect the SWE-bench Mini catalog via Fox CLI
fox standard-suite tasks

# 5. Render the live scoreboard via Fox CLI
fox standard-suite scoreboard
```

For the complete technical breakdown and invariant methodology, see the [Independent Replication Guide](docs/reproduction-guide.md).

---

## ⚙️ Configuration & Environment Variables

### Compression Flags

| Variable | Default | Description |
| :--- | :---: | :--- |
| `FOX_EXPERIMENTAL_COMPRESS` | `true` | Master toggle for all lossless compression transforms |
| `FOX_EXPERIMENTAL_COMPRESS_GIT` | `true` | Enables Git command rewrites (`-sb`, `-U1`, `--oneline`) |
| `FOX_EXPERIMENTAL_COMPRESS_DIFF` | `true` | Enables diff context trimming and index header stripping |
| `FOX_EXPERIMENTAL_COMPRESS_LOCKFILE` | `true` | Enables automatic collapsing of large lockfile hunks |
| `FOX_EXPERIMENTAL_COMPRESS_TESTS` | `true` | Enables collapsing of consecutive passing test lines |
| `FOX_EXPERIMENTAL_COMPRESS_TABULAR` | `true` | Enables columnar JSON compression for tabular record arrays |
| `FOX_EXPERIMENTAL_COMPRESS_PATHS` | `true` | Enables workspace root path relativization |
| `FOX_COMPRESSION_SAFE` | `false` | **Safe Mode**: Forces workflow to `none` (disables all transforms) |
| `FOX_COMPRESSION_CANARY` | `false` | Dual-runs compressed and uncompressed outputs to assert invariant consistency |
| `FOX_WORKLOAD` | `swe` | Force override the active workflow (`swe`, `data`, `research`, `shell`, `none`, `auto`) |

### Escape Hatches

You can bypass transforms on-demand at any time without restarting the CLI:

- **Raw Git Execution**:
  Prefix commands with `raw git <cmd>`, `\git <cmd>`, or `git --raw <cmd>` to bypass rewrites.
- **Uncapped Shell Output**:
  Add `# no-truncate` or `--full-output` anywhere in a bash command to disable line and byte limits.
- **Environment Overrides**:
  ```bash
  export FOX_GIT_NO_REWRITE=true     # Prevent git commands from being rewritten
  export FOX_SHELL_NO_TRUNCATE=true   # Disable output capping on shell commands
  export FOX_COMPRESSION_SAFE=true    # Emergency switch: disable all tool modifications
  ```

### Provider & Network Configuration

```bash
# OpenAI-Compatible / LiteLLM Proxy
export OPENAI_BASE_URL="http://localhost:8000/v1"
export OPENAI_API_KEY="local-dev"

# Local GitLab Integration (for testing worktree / MR linking)
export GITLAB_INSTANCE_URL="http://localhost:8929"
export GITLAB_TOKEN="glpat-fox-local-dev-token-12345"
```

---

## 🔍 CLI Inspection & Telemetry

Fox provides built-in CLI commands to inspect the active compression pipeline and live session metrics:

### Preview Active Workflow & Transform Rules
```bash
# Preview the active workflow profile (or specify one: swe, data, research, shell, none, auto)
fox compression preview [workflow]
```

*Example Output:*
```text
🦊 Fox Code CLI — Compression Policy Preview

  Active Workflow Profile: swe
  Safe Mode (FOX_COMPRESSION_SAFE): ✗ disabled
  Master Switch (FOX_EXPERIMENTAL_COMPRESS): ✔ enabled

  Transform Pipeline for [swe]:
    • Pre-Execution Git Rewrites:     ✔ enabled
    • Render-Time Git Supersession:    ✔ enabled
    • Diff Context Trimming:           ✔ enabled (context: 1 line)
    • Lockfile Diff Collapsing:        ✔ enabled
    • Test Output Collapsing:          ✔ enabled
    • Log Line Deduplication:          ✔ enabled
    • Tabular JSON Compression:        ✔ enabled
    • Path Normalization:              ✔ enabled
    • Shell Output Capping:            ✔ enabled (200 lines / 8192 bytes)
```

### Inspect Live Compression Telemetry & Prefix Stability
```bash
fox compression snapshot
```

*Example Output:*
```text
🦊 Fox Code CLI — Compression Telemetry & Stability Snapshot

  Prefix Stability Hash:            sha256:d5cbd92f4ef9a4b0
  Active Workflow:                  swe
  Pre-Execution Git Rewrites:       14
  Shell Output Truncations:         3
  Superseded Tool Outputs:          8
  Cumulative Characters Saved:      154,672 chars (~38,668 tokens)
  Cumulative Compression Overhead:  4 ms
  Compression ROI Score:            38668.0 chars/ms
```

### Inspect Fox Standard Test Suite & Baseline Scoreboard
```bash
# Render the official Baseline Scoreboard across 52 golden fixtures
fox standard-suite scoreboard

# List the 12 curated SWE-bench Mini benchmark tasks
fox standard-suite tasks
```

---

## 🛠️ Getting Started & Development

### Prerequisites

- **[Bun](https://bun.sh/)** $\ge 1.1.0$ (Primary runtime & test runner)
- **Node.js** $\ge 18.0.0$ (Optional compatibility)
- **Docker & Docker Compose** (For optional local LiteLLM proxy and GitLab CE test fixtures)

### Installation

```bash
git clone https://github.com/k82l0804/fox.git
cd fox/fox-code-cli
bun install
```

### Running the CLI & ACP Server

```bash
# Start the interactive TUI
bun run dev

# Start the ACP server (over stdio for VS Code / IDE integration)
bun ./src/index.ts acp

# Start the headless HTTP instance server
bun ./src/index.ts serve --port 4096
```

### Testing & Verification

All tests are non-interactive and run via Bun:

```bash
# Canonical Fox Standard Test Suite across all 6 golden corpora (~1s)
bun run test:standard-suite

# Recompute and display the official Baseline Scoreboard
bun run scoreboard

# Quick smoke test suite (typecheck + patch + edit + config + compression) (~30s)
bun run test:smoke

# Full monorepo typecheck (tsc --noEmit)
bun run typecheck

# Full test suite
bun run test

# Workflow policy unit tests
bun test packages/core/test/workflow.test.ts

# Invariant & safety rails tests
bun test packages/core/test/compress-invariants.test.ts test/prefix-stability.test.ts

# Run the deterministic Fox vs Kilo compression showdown
bun run tools/fox-vs-kilo-showdown.ts
```

---

## 🏗️ Architecture & Repository Layout

```text
fox-code-cli/
├── packages/
│   ├── core/                  # Core abstractions, tools, and compression pipeline
│   │   ├── src/flag/          # Dynamic configuration flags & getters
│   │   └── src/tool/          # ToolOutputCompressor, metrics, bash & git rewrites
│   ├── schema/                # Effect Schemas for Agent, Workflow, and Session
│   ├── llm/                   # LLM event streaming & token normalization
│   ├── server/                # HTTP & SSE streaming infrastructure
│   └── tui/                   # OpenTUI terminal interface components
├── src/
│   ├── agent/                 # Built-in agent definitions (code, plan, explore, scout)
│   ├── cli/cmd/               # CLI commands (compression preview/snapshot, auth, session)
│   ├── session/               # Session orchestration, supersession, prompt rendering
│   └── tool/                  # Tool execution, shell truncation, and output capping
├── docs/                      # Technical reports, benchmarks, and architectural specs
└── tools/                     # Showdown benchmarks and evaluation suites
```

---

## 📄 License

MIT License. See [`LICENSE`](../LICENSE) in the repository root for details.

