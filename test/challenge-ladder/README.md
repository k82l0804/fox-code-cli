# 🦊 Fox Challenge Ladder — Developer Guide

## What Is It?

The Fox Challenge Ladder is a **334-fixture deterministic stress test** for Fox's compression pipeline. It measures whether compression saves tokens without destroying critical content that the LLM needs to see.

**Key concept:** When Fox compresses tool output before feeding it to the LLM, it must *never* lose information the model needs to make decisions. The Challenge Ladder verifies this across increasingly difficult scenarios.

---

## Quick Start

```bash
# Run the full Challenge Ladder (334 fixtures, ~200ms)
cd fox-code-cli
bun run test:challenge

# Run as part of smoke tests
bun run test:smoke

# Run as part of the full test suite
bun run test
```

**Expected output:**

```
🦊 FOX CHALLENGE LADDER — SCOREBOARD
══════════════════════════════════════════════════════════════
  Tier 1 — Baseline                80.0/80  (100.0%)
  Tier 2 — Long-Horizon          100.0/100  (100.0%)
  Tier 3 — Adversarial             65.7/66  (99.5%)
  Tier 4 — External Benchmarks     88.0/88  (100.0%)
 ─────────────────────────────────────────────────────────────
  🏆 FOX CHALLENGE SCORE:  333.7/334  (99.9%)
══════════════════════════════════════════════════════════════
```

---

## Architecture

```
test/challenge-ladder/
├── index.ts                    # Master registry — aggregates all tiers
├── types.ts                    # Fixture, result, and scoring types
├── scoring.ts                  # Compression pipeline + scoring engine + A/B comparison
├── validator.ts                # Fixture validation (unique IDs, required fields)
├── tier-1-baseline/            # 80 fixtures — basic compression invariants
│   ├── index.ts
│   ├── swe-bench-mini.ts       # 40 short GitHub issues + patches
│   ├── gitops.ts               # 10 git status/log/diff outputs
│   ├── test-output.ts          # 10 test runner outputs (pass/fail collapse)
│   ├── diff-expanded.ts        # 10 large diffs (context trimming)
│   ├── shell-output.ts         # 5 shell command outputs
│   └── document.ts             # 5 documentation/research content
├── tier-2-long-horizon/        # 100 fixtures — multi-step workflows
│   ├── index.ts
│   ├── gitops-workflows.ts     # 20 multi-step git workflows
│   ├── gitops-expansion.ts     # 10 advanced git patterns (rebases, cherry-picks, etc.)
│   ├── swe-multifile.ts        # 20 multi-file SWE workflows
│   ├── swe-expansion.ts        # 5 advanced SWE (circular deps, polyglot traces)
│   ├── shell-pipelines.ts      # 20 chained shell commands
│   ├── cicd-expansion.ts       # 5 CI/CD pipeline traces (Docker, K8s, Rust, Python)
│   └── multi-doc-research.ts   # 20 multi-document research traces
├── tier-3-adversarial/         # 66 fixtures — adversarial edge cases
│   ├── index.ts
│   ├── malformed-diffs.ts      # 16 broken/malformed diffs
│   ├── corrupted-logs.ts       # 17 logs with corruption patterns
│   ├── partial-stacktraces.ts  # 17 truncated/partial stack traces
│   ├── ambiguous-workflows.ts  # 16 ambiguous content (could be multiple types)
│   └── adversarial-expansion.ts # 6 new modalities (encodings, binary, circular stacks)
└── tier-4-external/            # 88 fixtures — real-world benchmark simulations
    ├── index.ts
    ├── gaia-style.ts           # 22 GAIA-style reasoning tasks
    ├── webarena-style.ts       # 23 WebArena-style DOM snapshots
    ├── osworld-style.ts        # 22 OSWorld-style system state
    ├── swe-bench-verified.ts   # 21 SWE-bench verified patches
    └── structural-expansion.ts # 8 deep structural complexity tests
```

---

## Tier Descriptions

### Tier 1 — Baseline (80 fixtures)
**Scoring:** Binary pass/fail. Each fixture checks 3 invariants:
1. **Lossless** — `mustContain` keywords survive compression
2. **Non-expansion** — output ≤ input size
3. **Stability** — compressing twice gives the same result

**When this breaks:** You changed a transform that strips a keyword.

### Tier 2 — Long-Horizon (100 fixtures)
**Scoring:** Per-step non-expansion + combined `mustContain`. These are multi-step agent traces (3–9 steps concatenated with `---` separators).

**When this breaks:** A transform runs across step boundaries and destroys data from one step while processing another.

### Tier 3 — Adversarial (66 fixtures)
**Scoring:** Three-axis partial scoring: ⅓ routing + ⅓ invariants + ⅓ robustness. Partial credit is possible.

**When this breaks:** A compressor heuristic fails on ambiguous content (e.g., a diff of a file that itself contains diffs).

### Tier 4 — External Benchmarks (88 fixtures)
**Scoring:** Binary pass/fail on all `mustContain` keywords. These simulate the content types that appear in GAIA, WebArena, OSWorld, and SWE-bench benchmarks.

**When this breaks:** A transform not designed for HTML/JSON/XML accidentally modifies structured content.

---

## CI Gates

The test file enforces these minimum thresholds:

| Gate | Threshold | What it catches |
|------|-----------|-----------------|
| Tier 1 pass rate | ≥ 95% (76/80) | Baseline regressions |
| Tier 2 avg score | ≥ 0.9 | Multi-step workflow corruption |
| Tier 3 avg score | ≥ 0.9 | Adversarial robustness drops |
| Tier 4 pass rate | ≥ 95% (76/88) | Benchmark fidelity regressions |
| **Global score** | **≥ 285** | Any significant compression regression |

---

## A/B Showdown (Optimized vs Unoptimized)

Test 6 in the suite runs every fixture twice:
- **Unoptimized** = raw content (no compression, just passthrough)
- **Optimized** = full compression pipeline

This produces:
- Per-category token savings (where compression delivers the most value)
- Grand total token savings (overall ROI)
- Top 5 biggest savers (which fixtures benefit most)

Use this to evaluate the impact of compression changes.

---

## How to Add New Fixtures

### 1. Choose the right tier
- **Tier 1** if it's a simple single-output compression test
- **Tier 2** if it involves multi-step workflows (agent traces)
- **Tier 3** if it's an adversarial edge case
- **Tier 4** if it simulates a real benchmark

### 2. Create or edit a fixture file

```typescript
// In the appropriate tier directory
import type { ChallengeFixture } from "../types"

export const MY_FIXTURES: readonly ChallengeFixture[] = [
  {
    id: "unique-id-here",       // Must be globally unique
    tier: 2,                     // 1, 2, 3, or 4
    category: "gitops-workflows", // Existing or new category
    description: "What this tests",
    seed: 99001,                 // Unique seed for reproducibility
    input: {
      content: "The raw content to compress",
      tool: "bash",              // Tool that produced this output
      command: "git status",     // Optional: command that was run
      // For multi-step (Tier 2):
      steps: [
        { tool: "bash", command: "git status", content: "step output", timestamp: "..." },
      ],
    },
    expected: {
      type: "completion",        // "completion" | "objective" | "robustness"
      mustContain: ["keyword1", "keyword2"],  // MUST survive compression
      workflow: "swe",           // Workflow classification hint
    },
  },
]
```

### 3. Register in the tier index

```typescript
// In tier-X/index.ts
import { MY_FIXTURES } from "./my-file"

export function getTierXFixtures(): readonly ChallengeFixture[] {
  return [
    ...EXISTING_FIXTURES,
    ...MY_FIXTURES,  // Add here
  ]
}
```

### 4. Update counts in `types.ts`

```typescript
export const TIER_META = {
  // Update maxScore to match new fixture count
  2: { name: "Long-Horizon", maxScore: 100 },  // was 80, now 100
}

export const EXPECTED_FIXTURE_COUNTS = {
  2: 100,  // Update to match
}
```

### 5. Update `challenge-ladder.test.ts`

Update the `expect(fixtures.length).toBe(N)` and `expect(validation.fixtureCount).toBe(N)` assertions.

### 6. Run and verify

```bash
bun run test:challenge
```

---

## Interpreting Results

### Good: Score ≥ 99%
Compression is working correctly. Safe to ship.

### Warning: Score 95–99%
A few fixtures are failing. Check the "Worst fixtures" list in the scoreboard.

### Bad: Score < 95%
Something broke. Run individual fixtures to isolate:

```bash
# Run just Tier 1
bun test test/challenge-ladder.test.ts -t "Tier 1"
```

### A/B Showdown: What to look for
- **High savings + 100% pass rate** = perfect (the goal)
- **High savings + low pass rate** = compression is too aggressive
- **Low savings + 100% pass rate** = compression is too conservative (safe but not saving tokens)
- **0% savings** = this category bypasses compression entirely (by design or missing transform)

---

## Common Issues

### "Fixture validation errors: Empty step content"
Multi-step fixtures require non-empty `content` on every step. Commands like `git add` that produce no output should use a placeholder like `"staged: file.ts"`.

### "ROI auto-skip causing non-determinism"
The compression pipeline has a stateful ROI tracker. Always call `resetROI()` before running fixtures. The scoring engine does this automatically.

### "filterTestOutput collapsing non-test content"
Content with 4+ consecutive `✓` lines gets collapsed. The guard requires ≥6 pass/fail lines. If your fixture has ✓ symbols but isn't test output, either:
- Reduce the ✓ count below 6, or
- Use a different symbol

---

## Files Reference

| File | Purpose |
|------|---------|
| [`test/challenge-ladder.test.ts`](../test/challenge-ladder.test.ts) | Main test file with CI gates |
| [`test/challenge-ladder/scoring.ts`](../test/challenge-ladder/scoring.ts) | Compression pipeline, scoring, and A/B comparison |
| [`test/challenge-ladder/types.ts`](../test/challenge-ladder/types.ts) | Type definitions and tier metadata |
| [`test/challenge-ladder/validator.ts`](../test/challenge-ladder/validator.ts) | Fixture validation rules |
| [`packages/core/src/tool/compress.ts`](../packages/core/src/tool/compress.ts) | The actual compression pipeline under test |
| [`packages/core/src/tool/compression-metrics.ts`](../packages/core/src/tool/compression-metrics.ts) | ROI tracking for compression transforms |
| [`docs/fox-challenge-ladder-report.md`](../docs/fox-challenge-ladder-report.md) | Latest results report |
