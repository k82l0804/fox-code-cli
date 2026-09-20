# 🦊 Fox Standard Test Suite & Scoreboard — Independent Replication Guide

> **Document Version:** 1.0.0  
> **Target Audience:** Contributors, Researchers, Peer Reviewers, and Evaluators  
> **Specification Reference:** [`docs/research/std-test-suite-sort-of.md`](./research/std-test-suite-sort-of.md)  
> **Official Scoreboard:** [`docs/fox-standard-test-suite-scoreboard.md`](./fox-standard-test-suite-scoreboard.md)  
> **Status:** Fully Reproducible, Deterministic, Zero-External-Dependencies

---

## 🎯 Executive Summary

The **Fox Standard Test Suite** establishes the canonical baseline for **Lossless Token Compression** in autonomous AI software engineering agents. Across **52 golden corpora fixtures** (including **12 curated SWE-bench Mini tasks**), Fox delivers:

- **52.3% Net Context Reduction** on standard SWE corpora (33,036 $\to$ 15,766 tokens).
- **76.4% Cumulative Input Token Reduction** on multi-turn autonomous coding tasks.
- **100% Autonomous Task Pass Rate** maintained without dropping error traces or patch hunks.
- **Sub-Millisecond Overhead** (avg ~0.08 ms per fixture, 15,900+ chars/ms ROI).
- **Strict Invariant Guarantees**: 100% verified across Lossless Retention, Non-Expansion, Prefix Stability (sha256 determinism), Supersession, and Escape Hatches.

This guide provides step-by-step instructions for any developer or researcher to verify and replicate these results on their own machine in **under two minutes**.

---

## 📋 System Requirements

| Requirement | Minimum | Recommended | Notes |
| :--- | :--- | :--- | :--- |
| **OS** | Linux (Ubuntu 20.04+) or macOS | Linux (x86_64 or ARM64) | Tested on Linux x86_64 kernel 6.6+ |
| **Runtime** | Bun 1.1.0+ | Bun 1.2+ / 1.4+ | Core CLI & test runner runtime |
| **Node.js** | Node 20.0+ | Node 22.x LTS | For external package compatibility |
| **Git** | Git 2.30+ | Git 2.40+ | For git porcelain command rewrites |
| **Memory** | 2 GB RAM | 4 GB RAM | Fast in-memory compilation |

---

## ⚡ 1-Minute Quick Start (Deterministic Offline Reproduction)

No running server or LLM API keys are required to verify the complete standard test suite and baseline scoreboard.

```bash
# 1. Clone the repository (if not already cloned)
git clone https://github.com/k82l0804/fox.git
cd fox/fox-code-cli

# 2. Install workspace dependencies
bun install

# 3. Run the automated standard test suite (evaluates all 52 fixtures and 6 invariants)
CI=true bun run test:standard-suite

# 4. Generate the live ANSI scoreboard table and refresh docs
bun run scoreboard

# 5. Output machine-readable JSON telemetry
bun run scoreboard --json
```

**Expected Result:**
```
✓ test/standard-suite.test.ts (9 tests) 356 passed
Scoreboard summary: 52 fixtures, 33,036 raw tokens -> 15,766 compressed tokens (+17,270 tokens saved, 52.3% reduction)
Cumulative Latency: 4.35ms | Cumulative ROI: 15,914 chars/ms
Invariant Verification: 100% PASS
```

---

## 📂 The 6 Golden Corpora Architecture

The Fox Standard Test Suite is located in `fox-code-cli/test/corpora/` and partitioned into 6 distinct categories:

```
fox-code-cli/test/corpora/
├── index.ts                     # Central catalog exporter and normalizer
├── types.ts                     # Strict TypeScript interfaces and schemas
├── swe-bench-mini/              # 12 real-world SWE tasks (failing logs + patches)
│   └── tasks.ts                 # 24 fixtures (12 failure logs, 12 diff hunks)
├── gitops/                      # DevOps and git porcelain outputs
│   └── fixtures.ts              # 7 fixtures (status, diff, commit, conflict, branch, log, raw)
├── test-output/                 # CI test runner outputs
│   └── fixtures.ts              # 6 fixtures (Bun, Vitest, Pytest, Cargo, tsc, install)
├── diff/                        # Unified diff mechanics
│   └── fixtures.ts              # 6 fixtures (multi-hunk, lockfile, whitespace, binary, EOF, rename)
├── shell-output/                # POSIX and GNU terminal streams
│   └── fixtures.ts              # 5 fixtures (oversized log, # no-truncate, paths, grep, find)
└── document/                    # Research and data workloads
    └── fixtures.ts              # 4 fixtures (tabular JSON, key packing, markdown, CSV)
```

### Breakdown of Golden Fixtures

| Corpus Category | Count | Focus | Key Invariant Checked |
| :--- | :---: | :--- | :--- |
| **`swe-bench-mini`** | 24 | 12 real bug fixes + failing test logs | 100% stack trace and patch line retention |
| **`gitops`** | 7 | `git status`, `diff`, `log`, branch switch | Advice stripped, conflict markers (`<<<<<<<`) preserved |
| **`test-output`** | 6 | Bun, Vitest, Pytest, Cargo, `tsc` logs | $\ge 4$ passing tests collapsed; all errors preserved |
| **`diff`** | 6 | Multi-hunk diffs, 150-line lockfiles | Lockfile diff collapsed; code hunks untruncated |
| **`shell-output`** | 5 | 400-line logs, grep, find, paths | Capped at 200 lines / 8 KB; `# no-truncate` bypassed |
| **`document`** | 4 | 35-row tabular JSON, key packing | Columnar tabular conversion; schema packing |

---

## 🛡️ The 6 Core Invariants Tested

The test runner [`test/standard-suite.test.ts`](../test/standard-suite.test.ts) rigorously asserts 6 fundamental system invariants across all 52 fixtures:

### Invariant 1: Lossless Preservation
- **Assertion:** All stack traces, error codes, failed assertion messages, diff change lines (`+`/`-`), and git commit hashes in raw outputs must be byte-for-byte preserved in compressed output.
- **Verification:**
  ```bash
  bun test test/standard-suite.test.ts -t "Invariant 1"
  ```

### Invariant 2: Non-Expansion
- **Assertion:** No transform ever expands the input text (`compressed.length <= raw.length`). If a transform produces more characters (e.g. from table formatting overhead), it must immediately fall back to the original text.
- **Verification:**
  ```bash
  bun test test/standard-suite.test.ts -t "Invariant 2"
  ```

### Invariant 3: Prefix Stability (KV-Cache Retention)
- **Assertion:** Identical system prompts and tool declarations across multiple turns produce identical sha256 checksums, guaranteeing 100% provider-side KV-cache hits.
- **Verification:**
  ```bash
  bun test test/standard-suite.test.ts -t "Invariant 3"
  ```

### Invariant 4: Render-Time Supersession
- **Assertion:** When a subsequent state mutation occurs (e.g. `git commit` following `git status`), earlier tool outputs are marked as superseded dynamically during prompt assembly. History in the SQLite database remains unaltered.
- **Verification:**
  ```bash
  bun test test/standard-suite.test.ts -t "Invariant 4"
  ```

### Invariant 5: Escape Hatch Fidelity
- **Assertion:** When commands contain `# no-truncate`, `--full-output`, or are prefixed with `raw git` / `\git`, all compression and truncation transforms are bypassed completely.
- **Verification:**
  ```bash
  bun test test/standard-suite.test.ts -t "Invariant 5"
  ```

### Invariant 6: Sub-Millisecond Latency & High ROI
- **Assertion:** Transform overhead must average sub-millisecond per tool turn, and compression ROI must strictly exceed the minimum threshold of 5.0 characters saved per millisecond spent.
- **Verification:**
  ```bash
  bun test test/standard-suite.test.ts -t "Invariant 6"
  ```

---

## 💻 Inspecting via the Fox CLI

After building the CLI, Fox provides interactive commands to query the standard test suite:

```bash
# Build the Fox CLI binary
bun run build

# 1. View all 12 SWE-bench Mini tasks with descriptions and categories
./bin/fox standard-suite tasks

# 2. Render the live baseline scoreboard in your terminal
./bin/fox standard-suite scoreboard

# 3. Inspect runtime compression performance and active workflow
./bin/fox compression stats
```

---

## 🔬 Advanced: Replicating the Multi-Turn Autonomous SWE Benchmark

To replicate the **-76.4% cumulative token reduction** in an end-to-end autonomous agent loop against an LLM:

### 1. Start the Dev Proxy (or connect to your local LLM)

```bash
cd ../openai-proxy
cp .env.example .env
# Enter your GEMINI_API_KEY in .env
make up
make health
```

### 2. Run the Benchmark Showdown

```bash
cd ../fox-code-cli

# Run the automated multi-turn comparison script
bash tools/fork-showdown-kilo-vs-unoptimized-fox.sh
```

**Observed Multi-Turn Results:**
- **Pristine Baseline (Kilo):** 202,485 tokens across 3 tasks (100% pass rate)
- **Fox Optimized (Compressed):** 47,813 tokens across 3 tasks (100% pass rate)
- **Net Token Savings:** **+154,672 tokens (-76.4%)**

---

## ❓ Troubleshooting & FAQs

### Q1: Does compression drop error traces during test failures?
**No.** Test output filtering specifically identifies lines matching pass patterns (`✓`, `PASS`, `ok`) and only collapses consecutive passing lines. Any line containing `FAIL`, `Error:`, `Expected:`, `Received:`, or stack traces (`at ...`) is 100% preserved.

### Q2: Why did a transform skip in earlier test iterations?
Fox features an automatic **ROI Circuit Breaker**: if a transform runs 3 consecutive times with zero characters saved (e.g. tabular compression evaluated on plain prose), Fox temporarily skips that transform to avoid wasting CPU cycles. In standalone test loops, `CompressionMetrics.resetROI()` is called between fixtures to guarantee clean per-fixture metrics.

### Q3: How do I disable compression completely?
Set `FOX_COMPRESSION_SAFE=true` or `FOX_WORKLOAD=none`. This instantly turns off all Git rewrites, diff trimming, output truncation, and JSON encoding.

---

## 📜 Canonical Verification Checklist

Before publishing new benchmarks or pushing upstream commits, verify the following checklist:

- [x] `CI=true timeout 30s bun run test:standard-suite` (All 9 suites / 356 assertions pass)
- [x] `bun run scoreboard` (52 fixtures evaluated, 52.3% token reduction)
- [x] `timeout 45s bun run typecheck` (0 TypeScript errors)
- [x] `CI=true timeout 60s bun run test:smoke` (181 passed)
- [x] `docs/fox-standard-test-suite-scoreboard.md` reflects current baseline metrics
