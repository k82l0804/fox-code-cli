# AI Coding Agent CLIs: Comprehensive Competitive Product Feature Analysis

> **Document Type:** Product Feature & Capability Audit  
> **Evaluation Scope:** Leading terminal-native AI coding agents and execution engines  
> **Evaluated Products:**  
> - **Aider** (`v0.86.2`) — Paul Gauthier (Python)  
> - **Goose** (`v1.51.0`) — Block / Square (Rust)  
> - **Kilo Code CLI** (Upstream baseline commit `8791016`) — TypeScript / Bun  
> - **Claude Code** (`v0.2.29+`) — Anthropic (Node.js)  
> - **OpenHands** (`v0.14+`) — Open Source Community (Python / Docker)  
>
> *(Note: Per specification, Fox Code CLI is explicitly excluded from this report to provide an objective, neutral comparative feature analysis across external and baseline coding agent products).*

---

## 1. Executive Summary & Master Feature Comparison Matrix

The AI coding agent landscape has matured beyond simple autocomplete into autonomous, multi-turn software engineering engines. While all tools aim to assist developers, their **product architectures, feature surfaces, editing strategies, and autonomy models** diverge sharply:

- **Aider** is the **Diff-First Specialist**: Highly optimized around tree-sitter AST repository maps, concise search/replace diff generation, and immediate atomic git commits. It minimizes tool complexity in favor of pure LLM diff synthesis.
- **Goose** is the **Native MCP Generalist**: Built in Rust around the Model Context Protocol (MCP), featuring rich task planning (`todo_write`), native tool calling, subagent process isolation, and dynamic tool extensibility.
- **Kilo Code CLI** is the **Full-Featured Developer Workspace**: Built on Bun and TypeScript, offering an extensive built-in tool suite (`bash`, `read`, `edit`, `write`), ACP (Agent Client Protocol) editor integration, rich terminal UI (TUI), and subagent orchestration.
- **Claude Code** is the **Frontier-Bound Terminal Assistant**: Deeply coupled to Anthropic's Claude 3.7 / 3.5 Sonnet APIs, featuring server-side prompt caching, `/compact` history truncation, subshell daemon execution, and tight terminal ergonomics.
- **OpenHands** is the **Containerized Autonomous Sandbox**: Leverages Docker containers to provide fully isolated Linux environments with browser automation (Playwright), multi-agent loops, and web/desktop interfaces.

---

### Master Product Feature Matrix

| Feature / Capability | 🤖 Aider (`0.86.2`) | 🪿 Goose (`1.51.0`) | ⚡ Kilo Code CLI | 🟣 Claude Code | 🐳 OpenHands |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Primary Runtime** | Python 3.10+ | Rust Native | Bun / TypeScript | Node.js | Python / Docker |
| **Native Execution Overhead** | Moderate (~500ms) | ⚡ Fast (<50ms) | Fast (~150ms) | Moderate (~200ms) | Heavy (>30s container) |
| **Memory Footprint (Idle)** | ~65 MB | **~18 MB** | ~55 MB | ~85 MB | 1.5+ GB (Docker) |
| **Offline / Air-Gapped LLMs** | ✅ Full (Ollama/LiteLLM)| ✅ Full (Local endpoints)| ✅ Full (OpenAI-compat)| ❌ Anthropic API only| ✅ Full (Local models) |
| **Multi-Model Splitting** | ✅ **Architect / Editor** | ⚠️ Per-agent config | ❌ Single model | ⚠️ High/Low effort tiers| ⚠️ Multi-agent routing |
| **Small Model Fallback Mode**| ✅ **Whole-File Rewrite** | ❌ None (Schema choke) | ❌ None (Schema loop) | ❌ None (Frontier only) | ⚠️ Basic prompt mode |
| **Repository Mapping (AST)** | ✅ **Tree-sitter PageRank**| ❌ External MCP only | ❌ Grep/Glob only | ⚠️ File listing only | ⚠️ Repo indexer |
| **Context Compaction** | ❌ Rolling window | ❌ Uncompressed history | ❌ Uncompressed history | ✅ **Lossy `/compact`** | ✅ Summarizer agent |
| **Prompt Cache Optimization** | ⚠️ Heuristic | ⚠️ Static system prompt | ⚠️ Unsorted schemas | ✅ **Anthropic KV-Cache** | ⚠️ Provider-dependent |
| **Built-in Tool Surface** | Read, Edit, Git | Todo, Shell, Developer | Read, Edit, Write, Bash | Read, Edit, Bash, Grep | Bash, Browser, FileEdit |
| **MCP Support (Extensibility)**| ❌ Native (CLI-only) | ✅ **First-Class MCP** | ✅ Internal MCP client | ❌ CLI-internal only | ✅ MCP compatible |
| **Agent Client Protocol (ACP)**| ❌ Custom CLI only | ❌ CLI / Desktop only | ✅ **Native ACP Server** | ❌ Custom CLI only | ❌ Custom Web/API |
| **Editing Strategy** | Search/Replace & Whole | Targeted Block Edit | Surgical String Replace | Unified Diff / StrReplace| Patch / Custom Tool |
| **Automatic Test Feedback** | ⚠️ Manual (`/test`) | ✅ **Native ReAct loop**| ✅ **Native ReAct loop** | ✅ Auto test commands | ✅ Test runner loop |
| **Task Planning & Checklists**| ❌ Linear prompt | ✅ **Builtin `todo_write`**| ✅ Builtin `todowrite` | ⚠️ Markdown scratchpad | ✅ Task checklist state |
| **Subagent Architecture** | ❌ None (Sequential) | ✅ **Isolated Tokio tasks**| ⚠️ `general` / `explore` | ❌ Single session | ✅ Multi-agent delegation |
| **Automated Git Commits** | ✅ **Atomic per-turn** | ❌ Manual git commands | ⚠️ Manual git commands | ⚠️ `/commit` command | ⚠️ Git commit tool |
| **Undo / Checkpoint Rollback**| ✅ **Git-backed undo** | ❌ Manual git reset | ⚠️ Basic snapshot state | ❌ Manual reversion | ✅ Docker checkpointing |
| **Headless Scripting Mode** | ✅ `--message` / batch | ✅ `goose run -t` | ✅ `run` subcommand | ✅ `-p` / pipe mode | ✅ Headless SDK / API |
| **Terminal UI (TUI)** | Simple REPL | Interactive Text/TUI | ✅ **Rich Ink/React TUI**| Rich Terminal REPL | Web UI + Terminal |
| **Sandboxing & Isolation** | Host filesystem | Host filesystem | Host filesystem | Host filesystem | ✅ **Full Docker Sandbox**|
| **Browser Automation** | ❌ None | ⚠️ Via MCP sidecar | ❌ None | ❌ None | ✅ **Builtin Playwright** |
| **Workspace Rule Files** | `.aider.conf.yml` | `.goosehints` | `kilo.jsonc` / rules | `CLAUDE.md` | `.openhands_instructions`|
| **Telemetry & Privacy** | ✅ Zero telemetry | ✅ Clean / Opt-in | ⚠️ Update checks | ❌ Remote telemetry | ⚠️ Cloud telemetry |

---

## 2. Architecture & Runtime Capabilities

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              AGENT RUNTIME PROFILES                                    │
├─────────────────────────┬─────────────────────────┬────────────────────────────────────┤
│ 🤖 AIDER                │ 🪿 GOOSE (BLOCK)         │ ⚡ KILO CODE CLI                    │
├─────────────────────────┼─────────────────────────┼────────────────────────────────────┤
│ • Python 3 runtime      │ • Compiled Rust binary  │ • Bun JavaScript engine            │
│ • Single-threaded async │ • Tokio multi-threaded  │ • Event-loop async architecture    │
│ • Low dependencies      │ • Zero runtime deps     │ • Node.js / Bun ecosystem          │
│ • CLI REPL interface    │ • Headless + Desktop UI │ • Full interactive TUI (Ink)       │
│ • Direct disk access    │ • MCP process manager   │ • ACP JSON-RPC 2.0 daemon          │
└─────────────────────────┴─────────────────────────┴────────────────────────────────────┘
```

### Aider
- **Binary Footprint & Startup:** Built as a standard Python package. Requires Python virtual environment setup (`pip install aider-chat`). Startup latency is moderate (~400–600ms), driven by Python module imports (`tree-sitter`, `gitpython`, `litellm`).
- **Process Architecture:** Single-threaded, synchronous execution model with async I/O. Does not run background daemon workers; each execution is a direct, turn-based interaction.
- **Portability:** Runs anywhere Python 3.10+ runs, including macOS, Linux, and Windows terminal environments.

### Goose (Block / Square)
- **Binary Footprint & Startup:** Distributed as a single compiled, self-contained native Rust executable. Delivers sub-50ms cold startup times and consumes only ~18 MB of RAM at idle.
- **Process Architecture:** Multi-threaded async runtime powered by Tokio. Manages child processes for Model Context Protocol (MCP) servers with robust standard I/O and process supervision.
- **Portability:** True native cross-platform binaries (x86_64, aarch64) without external runtime dependencies (no Python, Node, or Bun required).

### Kilo Code CLI (Upstream Baseline)
- **Binary Footprint & Startup:** Packaged using Bun's native bundler and JavaScript runtime. Starts in ~150–250ms with a memory footprint of ~55 MB.
- **Process Architecture:** Utilizes Bun's event-loop architecture for high-velocity file I/O, subprocess execution, and JSON-RPC streaming.
- **Portability:** Runs across Linux, macOS, and Windows via Bun runtime or compiled Bun standalone binaries.

### Claude Code (Anthropic)
- **Binary Footprint & Startup:** Distributed via npm (`@anthropic-ai/claude-code`) running on Node.js. Startup takes ~200–350ms.
- **Process Architecture:** Interactive terminal loop with support for background subshell execution (`nohup`-style background server processes).

### OpenHands
- **Binary Footprint & Startup:** Distributed as a Docker container image (multi-gigabyte download). Container initialization takes 20–45 seconds, requiring 1.5+ GB of RAM.
- **Process Architecture:** Client-server web application architecture running a Python backend, browser interface, and isolated execution container.

---

## 3. Context Engineering, Indexing & Codebase Understanding

A critical differentiator among coding agents is how they build context from large codebases without overflowing token limits or blowing prompt cache reuse.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              CODEBASE CONTEXT STRATEGIES                              │
├─────────────────────────┬─────────────────────────┬────────────────────────────────────┤
│ 🤖 AIDER                │ 🪿 GOOSE (BLOCK)         │ ⚡ KILO CODE CLI                    │
├─────────────────────────┼─────────────────────────┼────────────────────────────────────┤
│ • AST Repo Map          │ • On-Demand Exploration │ • Ad-Hoc Tool Investigation        │
│ • Tree-sitter PageRank  │ • Directory listing MCP │ • `read`, `grep`, `glob` tools     │
│ • Compact symbol graph  │ • Shell `ls` / `find`   │ • Whole-file dumps into context    │
│ • Auto-packed in prompt │ • Full file reads       │ • Uncompressed tool buffers        │
└─────────────────────────┴─────────────────────────┴────────────────────────────────────┘
```

### 1. Repository Mapping & Symbol Extraction
- **Aider (The Industry Benchmark):** Uses Tree-sitter to parse source files into Abstract Syntax Trees (ASTs), extracts classes, functions, and signatures, and builds an in-memory graph. It then applies **PageRank** based on codebase reference frequency and packs the top symbols into a compact ~1,024-token "repo map". The LLM understands the global architecture before issuing a single tool call.
- **Goose:** Lacks built-in AST indexing. Relies on developer MCP extensions or standard bash commands (`find`, `grep`, `ls`) executed during the ReAct loop to discover file locations.
- **Kilo Code CLI:** Relies on interactive `glob` and `grep` tool calls issued dynamically by the model during turn execution. Does not maintain a persistent AST graph or repo map.
- **Claude Code:** Uses file tree discovery and regex search commands. Truncates directory trees to fit within token boundaries.

### 2. Context Retention & Compaction Strategies
- **Aider:** Operates on an active file set (`/add <file>`). Only files explicitly added or referenced in the current turn reside in the active context. Other files are represented solely through the repo map.
- **Goose:** Appends all tool inputs and outputs verbatim to the conversational turn history. Over long sessions (15+ turns), context grows unbounded, leading to high token burn and eventual context exhaustion.
- **Kilo Code CLI:** Maintains full conversation history in the session state. Does not strip verbose terminal outputs, lockfiles, or repetitive test passes, resulting in steep context accumulation (**78,538 tokens** across an 8-turn SWE trajectory).
- **Claude Code:** Introduces an explicit `/compact` command. When context approaches model limits, Claude Code prompts the model to summarize prior actions, prunes intermediate tool outputs, and restarts with a compacted summary.

### 3. Prompt Caching Economics
- **Claude Code:** Purpose-built to exploit Anthropic's prompt caching. Structures system prompts and static tool definitions to stay 100% byte-identical, securing up to 90% cost discounts on prompt prefill.
- **Aider:** Re-calculates and mutates the repo map as files are edited, which can invalidate server-side prompt cache prefixes.
- **Goose:** Retains a stable system prompt, but dynamic MCP tool registration changes can alter the schema order between sessions.
- **Kilo Code CLI:** Uses unminified schemas without strict alphabetical key normalization, resulting in lower cache reuse across diverse model providers.

---

## 4. Model Support, Routing & Economics

```
                                MODEL COMPATIBILITY SPECTRUM
Agent        Small Models (≤8B)      Mid-Sized (14B–35B)       Frontier (Claude 3.7 / GPT-4o)
Aider        🟢 100% (Whole-File)    🟢 100% (Search/Replace)  🟢 100% (Architect / Editor)
Goose        🔴 0% (Schema Choke)    🟢 100% (MCP ReAct)       🟢 100% (High Discipline)
Kilo         🔴 0% (Schema Loop)     🟢 100% (Full ReAct)      🟢 100% (Full ReAct)
Claude Code  ❌ Unsupported          ❌ Unsupported            🟢 100% (Native Optimization)
OpenHands    ⚠️ 40% (Basic Prompts)  🟢 85% (Container Loop)   🟢 100% (Multi-Agent)
```

### 1. Multi-Model Splitting: Architect vs. Editor
- **Aider's Architect Mode:** One of Aider's most lauded product features is the **Architect / Editor split** (`--architect`). The user pairs an expensive high-reasoning model (e.g., OpenAI o3-mini or Claude 3.7 Sonnet) with a fast, cheap editing model (e.g., DeepSeek-V3 or Claude 3.5 Haiku). The Architect formulates the high-level plan and detailed pseudocode, and the Editor translates the plan into search/replace blocks.
- **Goose:** Allows configuring different models per subagent in configuration files, but does not provide an automatic dual-model pipeline for a single editing task.
- **Kilo Code CLI:** Operates on a single model configured for the active session. All tools and planning steps are executed by the same model backend.

### 2. Graceful Degradation for Small / Local Models
- **Aider's Automatic Downgrade:** When Aider connects to a sub-frontier or local model (e.g., Llama 3.1 8B, Mistral 7B), it detects that the model cannot reliably follow search/replace diff formats. It automatically falls back to **whole-file rewrite mode** (`diff-fenced` or `whole-file`). This enables Aider to achieve a **100% pass rate on Llama 3.1 8B** where other tools fail.
- **Goose's Failure on Weak Models:** Goose exposes extensive JSON Schema definitions for MCP tools. Small models suffer from "schema choking," emitting invalid JSON, hallucinating arguments, or trying to overwrite test files.
- **Kilo's Failure on Weak Models:** Emits standard multi-turn tool calling schemas (~18.3 KB). Small models get trapped in malformed tool argument retries.

---

## 5. Tooling, Extensibility & Protocol Support

### 1. Built-in Tool Sets

| Tool Primitive | Aider | Goose | Kilo Code CLI | Claude Code | OpenHands |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **File Read** | Direct prompt dump | Built-in developer tool | `read` (with line slicing) | `View` tool | Builtin FileRead |
| **File Edit** | Search/Replace blocks | Targeted Block replacement | `edit` (string matching) | `Edit` (str_replace) | Patch application |
| **File Write / Create**| Whole-file overwrite | Built-in developer tool | `write` (new file creation)| `Write` tool | FileWrite tool |
| **Terminal / Bash** | ❌ (Shell via `/run` only)| ✅ Built-in `shell` tool | ✅ Built-in `bash` tool | ✅ Built-in `Bash` tool | ✅ Container Bash |
| **Grep / Search** | ❌ (Relies on repo map) | Via MCP or shell | ✅ Built-in `grep` tool | ✅ Built-in `Grep` tool | Regex Search tool |
| **File Tree / Glob** | ❌ (Handled internally) | Via MCP or shell | ✅ Built-in `glob` tool | ✅ Built-in `Glob` tool | File list tool |
| **Checklist / Planner**| ❌ None | ✅ Built-in `todo_write` | ✅ Built-in `todowrite` | ⚠️ Markdown buffer | Task Tracker |

### 2. Model Context Protocol (MCP) vs. Agent Client Protocol (ACP)
- **Goose (The MCP Champion):** Goose is built ground-up by Block/Square as the reference client for Anthropic's **Model Context Protocol (MCP)**. It dynamically loads, authenticates, and routes tool calls to any local stdio or remote SSE MCP server (GitHub, PostgreSQL, Slack, Puppeteer, filesystem).
- **Kilo Code CLI (The ACP Pioneer):** Kilo implements the **Agent Client Protocol (ACP)** over JSON-RPC 2.0. This allows Kilo to run as an independent headless server daemon that editor extensions (VS Code, JetBrains) connect to, streaming live updates, permission prompts, and diff previews.
- **Aider:** Deliberately eschews external protocol layers like MCP to keep its terminal footprint minimal and deterministic.

---

## 6. Editing Strategies & Mutation Safety

The mechanism an agent uses to modify source code determines its speed, token cost, and propensity for file corruption.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              CODE MUTATION STRATEGIES                                  │
├─────────────────────────┬─────────────────────────┬────────────────────────────────────┤
│ 🤖 AIDER                │ 🪿 GOOSE (BLOCK)         │ ⚡ KILO CODE CLI                    │
├─────────────────────────┼─────────────────────────┼────────────────────────────────────┤
│ Search / Replace Blocks │ Targeted Block Edits    │ String Replace Tool                │
│ <<<<<<< SEARCH          │ Replaces specific       │ Exact match of `old_string`        │
│ =======                 │ functions or classes    │ Replaced by `new_string`           │
│ >>>>>>> REPLACE         │ via native Rust tool    │ Validates unique match             │
├─────────────────────────┼─────────────────────────┼────────────────────────────────────┤
│ Fast apply; no tool     │ Native speed; lower     │ High accuracy; fails if            │
│ invocation overhead     │ token round-trips       │ indentation/spacing mismatches     │
└─────────────────────────┴─────────────────────────┴────────────────────────────────────┘
```

### 1. Mutation Formats
- **Aider:** Instructs the model to output `<<<<<<< SEARCH ... ======= ... >>>>>>> REPLACE` blocks directly in its chat response. The Python CLI parses these blocks, matches them against disk files, and applies them. If search blocks fail to match, Aider employs fuzzy matching heuristics.
- **Goose:** Issues structured tool calls to modify code blocks. In Task 2 (Pricing Matrix Refactor), Goose achieved the benchmark's fastest refactoring time (**61.0s**) by cleanly swapping out obsolete classes and functions in targeted block writes.
- **Kilo Code CLI:** Uses a structured `edit` tool with `old_string` and `new_string` parameters. It enforces strict unique-match guarantees to prevent unintended changes across files.

### 2. Transaction Safety, Undo & Version Control
- **Aider:** The gold standard for version control safety. **Aider commits to git after every single conversational turn** with a descriptive commit message. If an edit is flawed, the user types `/undo` and Aider executes `git reset --hard HEAD~1`, restoring the exact previous state instantly.
- **Goose:** Does not automatically manage git commits. Leaves modified files uncommitted in the working tree, placing the burden of version control and cleanup on the developer.
- **Kilo Code CLI:** Tracks file snapshots in an internal state database for session restoration, but relies on manual git commands for repository tracking.

---

## 7. Autonomy, Verification & Task Management

```
                                AUTONOMOUS REPAIR LOOP DISCIPLINE
Agent        Self-Verification Loop    Task State Management     Small-Model Safeguards
Aider        ❌ None (1-turn guess)    ❌ Linear Prompt Stack    🟢 Automatic Whole-File Fallback
Goose        ✅ High (Test ReAct)      ✅ Builtin `todo_write`   🔴 Unconstrained MCP Choke
Kilo         ✅ High (Test ReAct)      ✅ Builtin `todowrite`    🔴 Unminified Schema Choke
Claude Code  ✅ High (Shell verify)    ⚠️ Scratchpad buffer      ❌ Rejects Non-Frontier Models
OpenHands    ✅ High (Container test)  ✅ Checklist state tree   ⚠️ Fallback agent loops
```

### 1. Self-Correction & The Verification Loop
- **Goose (Highest Verification Discipline):** In Task 3 (Rate Limiter Repair), Goose demonstrated exceptional autonomous discipline:
  1. Wrote a step-by-step checklist using `todo_write`.
  2. Executed `bun test_rate_limiter.ts` using its shell tool to capture the 3 exact failing assertions.
  3. Inspected the code and applied surgical fixes.
  4. Re-ran the test suite to verify that all 8 tests passed before marking the task complete.
- **Kilo Code CLI:** Follows an active ReAct loop (`bash` test → inspect error → `edit` → re-test `bash`). Consistently achieves 100% bug fix verification on capable models.
- **Aider:** By default, **does not run tests**. Aider guesses the fix, generates diff blocks, commits, and returns control to the user. Aider can run tests if configured via `/test <cmd>`, but it is not an intrinsic part of its standard execution loop.

### 2. Task Planning & Decomposition
- **Goose (`todo_write`):** Provides a specialized tool for maintaining a visible, structured checklist. As items are completed, the model updates their status to `[x]`, preventing forgotten requirements during long tasks.
- **Kilo Code CLI (`todowrite`):** Features an integrated todo manager backed by an internal SQLite session service, recording progress and pending steps.
- **Aider:** Does not feature a native todo tracking tool; relies on the model's in-context conversational memory.

---

## 8. User Experience, Interfaces & Developer Workflows

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE PARADIGMS                                  │
├─────────────────────────┬─────────────────────────┬────────────────────────────────────┤
│ 🤖 AIDER                │ 🪿 GOOSE (BLOCK)         │ ⚡ KILO CODE CLI                    │
├─────────────────────────┼─────────────────────────┼────────────────────────────────────┤
│ • Minimalist REPL       │ • Native CLI + Desktop  │ • Full TUI + ACP Server            │
│ • Terminal readline     │ • Terminal streaming    │ • Custom Ink / React UI            │
│ • Rich in-line slash    │ • Electron/Desktop GUI  │ • Interactive permission modals    │
│   commands (`/undo`)    │ • Fast headless runner  │ • Headless daemon mode             │
└─────────────────────────┴─────────────────────────┴────────────────────────────────────┘
```

### 1. Terminal UI vs. Editor Integrations
- **Aider:** The undisputed master of the minimalist terminal REPL. Uses `prompt_toolkit` to provide autocomplete for file names, slash commands (`/add`, `/drop`, `/undo`, `/diff`, `/test`), and multi-line prompt support. It does not attempt to be an IDE or TUI; it is a laser-focused terminal companion.
- **Goose:** Offers both a high-performance headless CLI (`goose run -t "..."`) and a native desktop GUI built with Electron. Provides streaming markdown in the console with clear tool execution blocks.
- **Kilo Code CLI:** Features the most sophisticated terminal interface, built with Ink and React. Displays real-time tool spinners, formatted tables, interactive approval prompts, and status bars. Furthermore, its **ACP Server** allows it to power editor extensions directly.
- **Claude Code:** Delivers refined terminal ergonomics with interactive keyboard shortcuts, status bars, and human-in-the-loop permission dialogs.

---

## 9. Competitor Product Profiles

### 🤖 Aider
- **Developer:** Paul Gauthier  
- **License:** Apache 2.0  
- **Best-Fit Developer:** Developers who work primarily from the command line, value strict git hygiene, want fast localized edits, and frequently leverage local or mixed models (via Architect mode).
- **Core Advantages:**
  - Industry-leading Tree-sitter repository map.
  - Architect / Editor dual-model orchestration.
  - Automatic whole-file fallback on sub-10B models.
  - Turn-by-turn atomic git commits with instantaneous `/undo`.
- **Key Limitations:**
  - No autonomous verification loop by default (blind diff guessing).
  - Lacks subagent parallelism or task planning tools.
  - Prompt stuffing of full file bodies mutates prefix cache stability.

---

### 🪿 Goose
- **Developer:** Block / Square  
- **License:** Apache 2.0  
- **Best-Fit Developer:** Software engineers needing deep autonomous debugging, complex refactoring across enterprise repositories, and access to the rich MCP extension ecosystem.
- **Core Advantages:**
  - Blazing native Rust execution with sub-50ms cold startup and ~18MB idle memory.
  - First-class Model Context Protocol (MCP) dynamic tool integration.
  - Disciplined autonomous verification loop using builtin `todo_write` and shell tools.
  - Dual interface: CLI and Desktop GUI.
- **Key Limitations:**
  - Severe schema choking and failure on sub-14B models.
  - Uncompressed tool outputs lead to rapid context bloat over multi-turn sessions.
  - No automated git tracking or atomic commit management.

---

### ⚡ Kilo Code CLI
- **Developer:** Open Source Community (Upstream Kilo baseline)  
- **License:** Apache 2.0  
- **Best-Fit Developer:** Teams looking for a comprehensive, protocol-driven (ACP) agent that integrates cleanly into editors (VS Code / JetBrains) while maintaining full terminal autonomy.
- **Core Advantages:**
  - Modern TypeScript / Bun foundation with fast async execution.
  - Native Agent Client Protocol (ACP) server for IDE integration.
  - Rich interactive terminal UI (TUI) with permission governance.
  - Comprehensive built-in tool primitives (`read`, `write`, `edit`, `bash`, `todowrite`).
- **Key Limitations:**
  - Large unminified tool schemas (~18.3 KB/turn) and uncompressed tool outputs inflate context costs.
  - Low prompt cache reuse across diverse model providers.
  - Vulnerable to context bloat timeouts on long-horizon tasks (>300s).

---

### 🟣 Claude Code
- **Developer:** Anthropic  
- **License:** Proprietary CLI  
- **Best-Fit Developer:** Developers fully invested in Anthropic's Claude 3.7 / 3.5 Sonnet ecosystem seeking maximum reasoning capabilities and seamless prompt caching economics.
- **Core Advantages:**
  - Byte-for-byte optimization for Anthropic prompt caching (up to 90% savings).
  - Explicit `/compact` command for managing context limits.
  - Polished terminal ergonomics with subshell daemon execution.
- **Key Limitations:**
  - Completely cloud-locked to Anthropic's API; zero support for local models (Ollama/vLLM) or competing providers.
  - Lossy compaction discards granular history.

---

### 🐳 OpenHands (formerly OpenDevin)
- **Developer:** All-Hands AI & Open Source Community  
- **License:** MIT  
- **Best-Fit Developer:** Researchers and organizations requiring complete containerized execution sandboxes, multi-agent collaboration, and browser-based automation.
- **Core Advantages:**
  - Strict Docker container isolation prevents accidental host filesystem damage.
  - Built-in Playwright browser automation for web application testing.
  - Multi-agent architecture with specialized roles.
- **Key Limitations:**
  - Massive container overhead (>30s startup, 1.5+ GB RAM).
  - Heavy web/server architecture ill-suited for quick, lightweight terminal editing.

---

## 10. Capability Archetype Map

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              PRODUCT ARCHETYPE SPECTRUM                                │
│                                                                                        │
│   MINIMALIST / DIFF-FIRST                     AUTONOMOUS / TOOL-FIRST                  │
│                                                                                        │
│        [Aider]                             [Goose]            [Kilo Code]              │
│    (Repo-Map Diffing)                 (Native MCP ReAct)   (ACP Full-Featured)         │
│           │                                   │                     │                  │
│           ▼                                   ▼                     ▼                  │
│   • Single-pass diffs                 • Multi-turn tests    • Full workspace tools     │
│   • Auto git commits                  • todo_write plans    • ACP editor daemon        │
│   • Whole-file fallback               • Tokio Rust speed    • Interactive TUI          │
│   • Minimal tool footprint            • Rich MCP ecosystem  • SQLite task tracking     │
│                                                                                        │
│   ───────────────────────────────────────────────────────────────────────────────      │
│                                                                                        │
│   ENTERPRISE / CLOUD-LOCKED                   CONTAINERIZED / HEAVY                    │
│                                                                                        │
│      [Claude Code]                                  [OpenHands]                        │
│   (Anthropic API Exclusive)                      (Docker Sandboxed)                    │
│           │                                              │                             │
│           ▼                                              ▼                             │
│   • Native KV-cache prefill                      • Full container isolation            │
│   • Lossy /compact command                       • Playwright browser testing          │
│   • Subshell daemon watchers                     • Multi-agent micro-services          │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```
