# 🦊 Fox Code CLI — Documentation Hub

Welcome to the **Fox Code CLI** documentation library. This directory contains current architectural specifications, benchmark reports, execution roadmaps, and session handoffs.

> [!TIP]
> **Looking for historical or superseded documents?**  
> All superseded research notes, early benchmarks, completed cleanup plans, and review trackers have been organized chronologically in [`archived/`](./archived/README.md).

---

## 🧭 Active Documentation Index

```
docs/
├── README.md                                 # This navigation hub
├── 2026-09-22T15-54_fox-challenge-ladder-report.md           # Master benchmark report (334 fixtures, 100% pass)
├── 2026-09-22T15-16_daemon-architecture.md                   # Daemon & IPC client architecture specification
├── challenge-history/                        # Deterministic test run JSON telemetry snapshots
│   └── 2026-09-22.json                      # Latest baseline run (334/334, 19.1% compression)
├── future/                                  # Strategic roadmaps & autonomous SWE architecture
│   ├── 2026-09-21T06-12_plan-competitive-features-roadmap.md # Master roadmap (v1.5.0) with phased milestones
│   ├── 2026-09-22T15-16_priorities-plan-competitive-features-roadmap.md # Reconciled priorities & risk matrix
│   ├── 2026-09-22T15-16_autonomous-dual-agent-design.md     # Fox Guardian dual-agent architecture & design
│   ├── 2026-09-22T15-16_autonomous-agent-workflow.md         # Reference architecture (10-step closed loop)
│   ├── 2026-09-22T15-16_autonomous-agent-std-tests.md        # Benchmark strategy (SWE-bench, RepoQA, etc.)
│   ├── 2026-09-22T15-16_adaptive-compression.md              # Phase 2.0 Adaptive Compression design & classifier
│   └── 2026-09-22T15-16_opinion-ideal-sw-agent-workflow.md   # Core design principles and research backing
├── handoffs/                                # Inter-session state handoffs & next-step briefs
│   ├── 2026-09-22T20-15_phase-2-handoff.md                   # Handoff for Phase 2 Autonomous Guardian & Loop
│   ├── 2026-09-22T16-24_phase-1-remaining.md                 # Handoff for Phase 1 remaining items (Completed in CLI)
│   └── 2026-09-22T15-16_competitive-features-session.md # Competitive features session brief
├── reports/                                 # In-depth architectural & competitive reports
│   ├── 2026-09-23T09-18_competitive-analysis-fox-aider-goose.md # Capability-Proportional Execution analysis
│   ├── 2026-09-23T09-38_competitive-benchmark-aider-goose-kilo.md # Competitor Benchmark Report (Aider vs Goose vs Kilo)
│   └── 2026-09-23T10-07_competitive-analysis-product-features.md # Product Features Competitive Analysis (Aider vs Goose vs Kilo vs Peers)
└── archived/                                # Chronologically ordered archive of superseded docs
    └── README.md                            # Supersession index & redirect guide
```

---

## 📚 Core Documentation Areas

### 1. Benchmarks & Testing
- **[`2026-09-22T20-40_competitive-agent-benchmark-aider-goose.md`](./2026-09-22T20-40_competitive-agent-benchmark-aider-goose.md)**  
  *Competitive Multi-Agent SWE Benchmark Report*. Empirical evaluation of Fox Code CLI vs Aider (0.86.2) and Goose (1.51.0) on real-world engineering challenges (Task Queue, Pricing Refactor, Rate Limiter) using `tools/competitor-eval.sh`.
- **[`2026-09-22T15-54_fox-challenge-ladder-report.md`](./2026-09-22T15-54_fox-challenge-ladder-report.md)**  
  *Canonical benchmark report (v1.1)*. Details the 334-fixture deterministic stress test across 4 tiers: Baseline (80), Long-Horizon (100), Adversarial (66), and External Benchmarks (88). Verifies 100% pass rate with 19.1% average token savings after Phase 2.0 Adaptive Compression.
- **[`challenge-history/`](./challenge-history/)**  
  Automated JSON telemetry snapshots produced by `bun run challenge:snapshot`.

### 2. Architecture & Systems Design
- **[`2026-09-22T15-16_daemon-architecture.md`](./2026-09-22T15-16_daemon-architecture.md)**  
  Architecture specification for the Fox background daemon, JSON-RPC 2.0 over Unix domain sockets / Windows named pipes, multi-session state isolation, and client lifecycle management.
- **[`future/2026-09-22T20-55_spec-react-fast-path.md`](./future/2026-09-22T20-55_spec-react-fast-path.md)**  
  *ReAct Fast-Path Specification*. Single-turn speculative edit pipeline with zero-risk fallback to eliminate multi-turn latency on localized repairs.
- **[`future/2026-09-22T20-55_spec-state-tracking-planner.md`](./future/2026-09-22T20-55_spec-state-tracking-planner.md)**  
  *State-Tracking Planner Specification*. Native `task_checklist` tool and Guardian verification gate for disciplined task decomposition.
- **[`future/2026-09-22T20-55_spec-atomic-multifile-mutations.md`](./future/2026-09-22T20-55_spec-atomic-multifile-mutations.md)**  
  *Atomic Multi-File Mutations Specification*. Multi-file unified diff parsing and `batch_write` for zero-to-one application scaffolding in a single turn.
- **[`future/2026-09-22T15-16_autonomous-dual-agent-design.md`](./future/2026-09-22T15-16_autonomous-dual-agent-design.md)**  
  *Fox Guardian* design specification: dual-agent architecture with an Intake Gatekeeper, Failure Classifier, Verification & Lint Gate, and Pre-Commit Inspector running in an isolated sub-process.
- **[`future/2026-09-22T15-16_autonomous-agent-workflow.md`](./future/2026-09-22T15-16_autonomous-agent-workflow.md)**  
  The 10-step autonomous SWE closed-loop reference architecture: `intake → search → plan → edit → verify → detect → route → prune → commit → handoff`.

### 3. Roadmaps & Strategy
- **[`future/2026-09-21T06-12_plan-competitive-features-roadmap.md`](./future/2026-09-21T06-12_plan-competitive-features-roadmap.md)**  
  *Master Architectural Roadmap (v1.5.0)*. Contains competitive audits against Claude Code, Aider, Codex, OpenCode, and Cursor, plus the Master Deferred Items Traceability Ledger and phased delivery schedule (Phase 1, 2A, 2B, 3).
- **[`future/2026-09-22T15-16_priorities-plan-competitive-features-roadmap.md`](./future/2026-09-22T15-16_priorities-plan-competitive-features-roadmap.md)**  
  Strategic priorities, risk analysis, and tier ordering guiding implementation.
- **[`future/2026-09-22T15-16_adaptive-compression.md`](./future/2026-09-22T15-16_adaptive-compression.md)**  
  Phase 2.0 Adaptive Compression design: heuristic content classifier (`compression-levels.ts`) and adaptive transforms.
- **[`future/2026-09-22T15-16_autonomous-agent-std-tests.md`](./future/2026-09-22T15-16_autonomous-agent-std-tests.md)**  
  Standard autonomous agent benchmark strategy: SWE-bench Verified, RepoQA, and local validation suites.

### 4. Active Handoffs
- **[`handoffs/2026-09-22T20-15_phase-2-handoff.md`](./handoffs/2026-09-22T20-15_phase-2-handoff.md)**  
  *Canonical Phase 2 Handoff*. Full roadmap and execution guide for Phase 2A (Guardian Agent Core, Auto-Verification Execution, Checkpoint Reversal, Multi-Model Escalation).
- **[`handoffs/2026-09-22T16-24_phase-1-remaining.md`](./handoffs/2026-09-22T16-24_phase-1-remaining.md)**  
  Handoff document detailing Phase 1 items (Checkpoints and Model Profiles landed in CLI; ACP debounce deferred to extension).
- **[`handoffs/2026-09-22T15-16_competitive-features-session.md`](./handoffs/2026-09-22T15-16_competitive-features-session.md)**  
  Summary of competitive roadmap execution, Phase 2.0 implementation, and regression fixes.

### 5. Architectural & Competitive Reports
- **[`reports/2026-09-23T10-07_competitive-analysis-product-features.md`](./reports/2026-09-23T10-07_competitive-analysis-product-features.md)**  
  *AI Coding Agent CLIs: Comprehensive Competitive Product Feature Analysis*. Deep architectural and functional audit comparing Aider, Goose, Kilo Code CLI, Claude Code, and OpenHands across 24 core capabilities, editing paradigms, context management, and runtime models.
- **[`reports/2026-09-23T09-38_competitive-benchmark-aider-goose-kilo.md`](./reports/2026-09-23T09-38_competitive-benchmark-aider-goose-kilo.md)**  
  *Competitor Agent Benchmark Report: Aider vs. Goose vs. Kilo Code CLI*. Empirical performance results, token and schema economics, constrained-model stress tests, and master comparative matrix across external and baseline coding CLIs.
- **[`reports/2026-09-23T09-18_competitive-analysis-fox-aider-goose.md`](./reports/2026-09-23T09-18_competitive-analysis-fox-aider-goose.md)**  
  *Fox vs Aider vs Goose: Capability-Proportional Execution*. Architectural evaluation of multi-model routing, task decomposition, subagent specialization, and small-model failure mitigation across competitive SWE CLIs.

---

## 🏷️ Document Naming Convention

All Markdown (`.md`) files in `docs/` (recursively across all subdirectories, including `future/`, `handoffs/`, and `archived/`) must follow the ISO 8601 prefix standard:

```
YYYY-MM-DDTHH-MM_<descriptive-name>.md
```

- **Natural Chronological Sorting**: File browsers and `ls` automatically display documents in exact historical sequence.
- **Entrypoint Exception**: `README.md` files are the only exempt files, remaining un-prefixed to serve as landing pages.
- **Archiving Rule**: Any document superseded by later implementations or roadmaps must be moved to `docs/archived/` via `git mv`, preserving its timestamp prefix. See [`.agents/rules/documentation-naming.md`](../../.agents/rules/documentation-naming.md).

---

## 🗄️ Historical & Archived Docs

All prior research notes, early benchmark runs (52 fixtures), completed codebase cleanup plans, and initial review trackers are preserved in **[`archived/`](./archived/README.md)**. Files are prefixed with ISO 8601 timestamps (`YYYY-MM-DDTHH-MM_`) for chronological ordering.
