# 🦊 Fox Challenge Ladder — Historical Report

> **Version:** 1.0 (Phase 1B Complete)
> **Date:** 2026-09-22
> **Fixtures:** 334 (expanded from 300)
> **Fox CLI Version:** 0.1.0

---

## Executive Summary

The Fox Challenge Ladder is a 334-fixture deterministic compression stress test. After Phase 1B (Compression Hardening), Fox achieves **334/334 (100.0%)** with **15.8% average token savings** across all fixture categories, while maintaining a 100% correctness pass rate.

Three compression bugs were found and fixed, and the test suite was expanded with 34 new fixtures covering advanced GitOps workflows, CI/CD pipelines, adversarial encodings, and deep structural DOM trees.

---

## Scoreboard

### Per-Tier Results

| Tier | Name | Fixtures | Score | Max | % |
|------|------|----------|-------|-----|---|
| 1 | Baseline | 80 | 80.0 | 80 | **100.0%** |
| 2 | Long-Horizon | 100 | 100.0 | 100 | **100.0%** |
| 3 | Adversarial | 66 | 66.0 | 66 | **100.0%** |
| 4 | External Benchmarks | 88 | 88.0 | 88 | **100.0%** |
| **Total** | | **334** | **334.0** | **334** | **100.0%** |

### Per-Category Results

| Category | Tier | Fixtures | Score | % | Avg Compression |
|----------|------|----------|-------|---|-----------------|
| swe-bench-mini | 1 | 40 | 40.0/40 | 100.0% | 2.0% |
| gitops | 1 | 10 | 10.0/10 | 100.0% | 12.0% |
| test-output | 1 | 10 | 10.0/10 | 100.0% | 24.4% |
| diff | 1 | 10 | 10.0/10 | 100.0% | 19.6% |
| shell-output | 1 | 5 | 5.0/5 | 100.0% | 16.1% |
| document | 1 | 5 | 5.0/5 | 100.0% | 26.8% |
| gitops-workflows | 2 | 30 | 30.0/30 | 100.0% | 0.0% |
| swe-multifile | 2 | 25 | 25.0/25 | 100.0% | 0.9% |
| shell-pipelines | 2 | 25 | 25.0/25 | 100.0% | 6.7% |
| multi-doc-research | 2 | 20 | 20.0/20 | 100.0% | 0.0% |
| malformed-diffs | 3 | 16 | 16.0/16 | 100.0% | 5.2% |
| corrupted-logs | 3 | 17 | 17.0/17 | 100.0% | 5.6% |
| partial-stacktraces | 3 | 17 | 17.0/17 | 100.0% | 0.0% |
| ambiguous-workflows | 3 | 16 | 16.0/16 | 100.0% | 0.0% |
| gaia-style | 4 | 22 | 22.0/22 | 100.0% | 0.0% |
| webarena-style | 4 | 23 | 23.0/23 | 100.0% | 0.0% |
| osworld-style | 4 | 22 | 22.0/22 | 100.0% | 0.0% |
| swe-bench-verified | 4 | 21 | 21.0/21 | 100.0% | 0.0% |

---

## A/B Showdown — Optimized vs Unoptimized

### Per-Category Token Savings

| Category | Fixtures | Unopt Tokens | Opt Tokens | Saved | % Saved |
|----------|----------|-------------|------------|-------|---------|
| swe-bench-mini | 40 | 2,541 | 2,471 | 70 | 2.8% |
| gitops | 10 | 3,554 | 3,074 | 480 | 13.5% |
| test-output | 10 | 4,100 | 2,532 | 1,568 | 38.2% |
| diff | 10 | 5,416 | 1,024 | 4,392 | **81.1%** |
| shell-output | 5 | 18,308 | 9,697 | 8,611 | **47.0%** |
| document | 5 | 3,683 | 1,914 | 1,769 | **48.0%** |
| gitops-workflows | 30 | 23,859 | 23,859 | 0 | 0.0% |
| swe-multifile | 25 | 7,975 | 7,885 | 90 | 1.1% |
| shell-pipelines | 25 | 28,168 | 25,960 | 2,208 | 7.8% |
| multi-doc-research | 20 | 7,256 | 7,256 | 0 | 0.0% |
| malformed-diffs | 16 | 2,890 | 1,837 | 1,053 | 36.4% |
| corrupted-logs | 17 | 4,230 | 3,033 | 1,197 | 28.3% |
| partial-stacktraces | 17 | 2,588 | 2,588 | 0 | 0.0% |
| ambiguous-workflows | 16 | 3,166 | 3,166 | 0 | 0.0% |
| gaia-style | 22 | 2,517 | 2,517 | 0 | 0.0% |
| webarena-style | 23 | 9,051 | 9,051 | 0 | 0.0% |
| osworld-style | 22 | 3,710 | 3,710 | 0 | 0.0% |
| swe-bench-verified | 21 | 3,264 | 3,215 | 49 | 1.5% |

### Grand Totals

| Metric | Value |
|--------|-------|
| **Total fixtures** | 334 |
| **Unoptimized tokens** | 136,276 |
| **Optimized tokens** | 114,789 |
| **Tokens saved** | **21,487 (15.8%)** |
| **Characters saved** | 85,967 |
| **Avg latency per fixture** | 0.01ms |
| **Correctness pass rate** | 100.0% |

### Top 5 Token Savers

| Fixture | Tokens Saved | % Saved |
|---------|-------------|---------|
| shell-t1-01 | 8,611 | 80.7% |
| diff-t1-02 | 4,243 | 99.1% |
| corrupted-log-t3-07 | 1,197 | 95.8% |
| malformed-diff-t3-07 | 1,001 | 48.2% |
| doc-t1-02 | 900 | 75.4% |

### Compression Efficiency by Tier

| Tier | Unopt Tokens | Opt Tokens | Saved | % |
|------|-------------|------------|-------|---|
| Tier 1 (Baseline) | 37,602 | 20,712 | 16,890 | **44.9%** |
| Tier 2 (Long-Horizon) | 67,258 | 64,960 | 2,298 | 3.4% |
| Tier 3 (Adversarial) | 12,874 | 10,624 | 2,250 | 17.5% |
| Tier 4 (External) | 18,542 | 18,493 | 49 | 0.3% |

---

## Global Metrics

| Metric | Value |
|--------|-------|
| Avg prefill tokens | 408 |
| Avg compression ratio | 3.8% |
| Avg latency per fixture | 0.02ms |
| Max horizon length (≥50% success) | 9 steps |
| Total passed / failed | 334 / 0 |

---

## Failing Fixtures

None — 334/334 pass.

---

## Bugs Found & Fixed (Phase 1B)

### Bug 1: `compressGitStatus` destroyed multi-step agent traces
- **Impact:** +20 points (Tier 2 gitops-workflows: 52.5% → 100%)
- **Root cause:** Function dropped ALL lines that didn't match git status patterns. Multi-step traces with `On branch main` in step 1 had their entire content replaced.
- **Fix:** Added guards for `[Step `, `tool=`, `---` boundaries, and mixed-content ratio check.

### Bug 2: ROI auto-skip caused non-deterministic output
- **Impact:** +2 points (Tier 1 stability fixes)
- **Root cause:** `CompressionMetrics.shouldSkip()` accumulated statistics across fixtures. By fixture N's stability check, different transforms were being skipped.
- **Fix:** Call `resetROI()` before each fixture in the scoring engine.

### Bug 3: `filterTestOutput` collapsed non-test content
- **Impact:** +1 point (Tier 4 gaia-t4-09)
- **Root cause:** CI pipeline reports with ✓ symbols were treated as test output and collapsed.
- **Fix:** Added guard requiring ≥6 pass/fail pattern lines before the transform activates.

### Bug 4: `trimDiffContext` processed inner diff markers in meta-diffs
- **Impact:** +0.08 points (Tier 3 malformed-diff-t3-10)
- **Root cause:** Content lines containing `@@` were treated as hunk boundaries. In a meta-diff (diff of a diff file), inner `@@` markers are content, not structure.
- **Fix:** Added regex guard `@@ -\d` to only treat lines matching the full hunk header pattern as boundaries.

### Bug 5: `trimHunkContext` rewrote headers on small hunks
- **Impact:** +0.25 points (Tier 3 adv-overlap-t3-01)
- **Root cause:** Even small hunks (≤12 body lines) had context lines trimmed and headers recalculated, changing `@@ -10,5 +10,7 @@` to `@@ -10,3 +10,4 @@`.
- **Fix:** Added early return for hunks with ≤12 body lines — they're already compact and trimming risks header corruption for minimal savings.

---

## Score Progression

| Date | Phase | Fixtures | Score | % | Notes |
|------|-------|----------|-------|---|-------|
| 2026-09-22 | Initial | 300 | 287.4 | 95.8% | First Challenge Ladder run |
| 2026-09-22 | Phase 1B | 300 | 299.9 | 100.0% | 3 compression bugs fixed |
| 2026-09-22 | Phase 1B + Expansion | 334 | 333.7 | 99.9% | +34 fixtures, A/B showdown |
| **2026-09-22** | **Phase 1B + Diff Fix** | **334** | **334.0** | **100.0%** | Fixed meta-diff + small hunk trimming |

---

## CI Gate Thresholds

| Gate | Threshold | Current | Headroom |
|------|-----------|---------|----------|
| Tier 1 pass rate | ≥ 95% (76/80) | 100% (80/80) | +4 fixtures |
| Tier 2 avg score | ≥ 0.9 | 1.0 | +0.1 |
| Tier 3 avg score | ≥ 0.9 | 1.0 | +0.1 |
| Tier 4 pass rate | ≥ 95% (76/88) | 100% (88/88) | +12 fixtures |
| **Global score** | **≥ 285** | **334.0** | **+49** |

---

## Optimization Opportunities

Categories with 0% compression that could potentially be safely compressed:

| Category | Fixtures | Tokens | Potential Savings |
|----------|----------|--------|-------------------|
| gitops-workflows | 30 | 23,859 | Low — multi-step traces, intentionally preserved |
| multi-doc-research | 20 | 7,256 | Medium — research content may have collapsible patterns |
| partial-stacktraces | 17 | 2,588 | Low — stack traces should be preserved |
| ambiguous-workflows | 16 | 3,166 | Low — ambiguous content, safety priority |
| gaia-style | 22 | 2,517 | Low — reasoning inputs, safety priority |
| webarena-style | 23 | 9,051 | Medium — DOM snapshots could be trimmed |
| osworld-style | 22 | 3,710 | Low — system state should be preserved |

**Total potential:** ~52,147 additional tokens (~38% of remaining uncompressed) if workload classification (Phase 1B.6) can safely identify compressible patterns.

---

## How to Reproduce

```bash
cd fox-code-cli

# Run the Challenge Ladder
CI=true bun test test/challenge-ladder.test.ts --timeout 60000

# Run just the A/B Showdown
CI=true bun test test/challenge-ladder.test.ts -t "A/B Showdown" --timeout 60000

# Run just a specific tier
CI=true bun test test/challenge-ladder.test.ts -t "Tier 1" --timeout 60000
```

---

## Environment

| Component | Version |
|-----------|---------|
| Fox CLI | 0.1.0 |
| Bun | 1.4.2 |
| OS | Linux |
| Challenge Ladder | v1.0 (334 fixtures) |
