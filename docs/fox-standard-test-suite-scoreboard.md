# 🦊 Fox Standard Test Suite: Baseline Scoreboard

> **Generated:** 2026-09-22  
> **Test Harness:** `test/standard-suite.test.ts`  
> **Specification:** [docs/research/std-test-suite-sort-of.md](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/research/std-test-suite-sort-of.md)  
> **Status:** **100% Invariant Validation Verified (All 6 Corpora)**

---

## Executive Scoreboard Summary

Fox establishes its canonical baseline across **52 golden fixtures** spanning 6 standard SWE corpora, including **12 SWE-bench Mini tasks**, GitOps workflows, CI test runner streams, multi-hunk diffs, shell outputs, and structured research documents.

| Metric | Raw Baseline (Kilo Mode) | Fox Compressed (Fox Mode) | Delta / Efficiency |
| :--- | :---: | :---: | :---: |
| **Total Benchmark Tokens** | **33,036** | **15,766** | **+17,270 tokens (52.3% saved)** |
| **Total Pipeline Overhead** | 0.00 ms | **5.69 ms** | Sub-millisecond avg per tool turn |
| **Compression ROI** | 0.0 chars/ms | **12,166.3 chars/ms** | High ROI tier (>5.0 threshold) |
| **Invariant Verification** | N/A | **100% Passed (356+ assertions)** | Zero diagnostic or patch line loss |
| **Prefix Stability Hash** | Volatile | **Deterministic sha256** | 100% stable KV-cache reusability |

---

## Category Breakdown Table

| Corpus Category | Fixtures | Raw Tokens | Fox Tokens | Tokens Saved | Reduction (%) | Invariant Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`swe-bench-mini`** | 24 | 1,114 | 1,112 | +2 | **0.2%** | ✔ PASS |
| **`gitops`** | 7 | 2,566 | 2,086 | +480 | **18.7%** | ✔ PASS |
| **`test-output`** | 6 | 2,967 | 1,381 | +1,586 | **53.5%** | ✔ PASS |
| **`diff`** | 6 | 4,847 | 512 | +4,335 | **89.4%** | ✔ PASS |
| **`shell-output`** | 5 | 18,308 | 9,210 | +9,098 | **49.7%** | ✔ PASS |
| **`document`** | 4 | 3,234 | 1,465 | +1,769 | **54.7%** | ✔ PASS |
| **TOTAL / OVERALL** | **52** | **33,036** | **15,766** | **+17,270** | **52.3%** | **✔ 100% PASS** |

---

## SWE-bench Mini Task Catalog (12 Tasks)

The curated SWE-bench Mini benchmark suite exercises realistic bug repair, refactoring, diff application, and concurrency edge cases:

| Task ID | Title | Category | Failing Test Log | Fix Diff | Target Assertions |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `swe-01-json-stream-parser` | JSON Stream Chunk Boundary and Escape Parser | `bug-fix` | Lossless | Lossless | 2 |
| `swe-02-git-commit-hash-parser` | Git Porcelain SHA and Abbreviation Resolver | `bug-fix` | Lossless | Lossless | 2 |
| `swe-03-sliding-rate-limiter` | Sliding Window Rate Limiter Quota and Eviction | `concurrency` | Lossless | Lossless | 5 |
| `swe-04-cart-pricing-discounts` | Tiered Pricing and Stacking Discount Engine | `refactor` | Lossless | Lossless | 2 |
| `swe-05-async-priority-queue` | Bounded Worker Pool Priority Scheduling & DLQ | `concurrency` | Lossless | Lossless | 1 |
| `swe-06-unified-diff-hunk-patcher` | Multi-Hunk Unified Diff Line Offset Calculator | `patch-apply` | Lossless | Lossless | 1 |
| `swe-07-lru-cache-ttl` | LRU Cache TTL Expiration & Hit/Miss Counters | `bug-fix` | Lossless | Lossless | 2 |
| `swe-08-semver-range-resolver` | Semver Caret (^) Range Pre-Release Compatibility | `bug-fix` | Lossless | Lossless | 3 |
| `swe-09-event-emitter-leak` | Event Listener Cleanup & Once Unbinding Under Race | `bug-fix` | Lossless | Lossless | 1 |
| `swe-10-retry-exponential-backoff` | Jittered Exponential Backoff Delay Calculation | `performance` | Lossless | Lossless | 4 |
| `swe-11-markdown-table-formatter` | Markdown Table Column Padding & Delimiter Escaping | `formatting` | Lossless | Lossless | 3 |
| `swe-12-url-query-normalizer` | URL Canonical Query Parameter Sorter & Encoder | `bug-fix` | Lossless | Lossless | 1 |

---

## Core Invariants Enforced

1. **Lossless Preservation Invariant**: All assertion messages, failure traces, error codes, diff `+`/`-` hunk lines, and commit SHAs are 100% preserved.
2. **Non-Expansion Invariant**: No transform produces an output greater than the original input text (`compressed.length <= raw.length`).
3. **Prefix Stability Invariant**: System prompt environment prefix and tool schema ordering produce identical sha256 hashes across turns, ensuring maximum KV cache reuse.
4. **Supersession Correctness**: Obsolete reads, status checks, and diffs are superseded only upon validated downstream state mutations.
5. **Escape Hatch Fidelity**: `# no-truncate`, `--full-output`, and `raw git` bypass compression with 100% fidelity.
6. **ROI Ceiling**: Average transform latency remains sub-millisecond per fixture.

---

## Reproduction Commands

```bash
# Run the complete Fox Standard Test Suite invariant verification
CI=true timeout 30s bun run test:standard-suite

# Recompute and display the live baseline scoreboard
bun run scoreboard

# Inspect JSON telemetry from the scoreboard
bun run scoreboard --json
```
