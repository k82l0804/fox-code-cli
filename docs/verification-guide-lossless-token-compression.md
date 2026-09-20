# Lossless Token Compression — Verification & Replication Guide

> **Purpose**: This document enables independent verification of Fox CLI's lossless token compression features. All automated tests can be run with a single command. Manual benchmarks require a running Fox server and an LLM provider.

---

## Quick Start

```bash
cd fox-code-cli

# Run ALL automated tests (no server needed, ~30s)
bun run test:smoke

# Run compression-specific tests only (~1s)
bun run test:compress

# Run deterministic showdown (no server needed, ~2s)
bun run tools/fox-vs-kilo-showdown.ts
```

---

## What's Being Tested

### Compression Features

| Feature | Flag | Description |
|---------|------|-------------|
| Schema minification | `FOX_EXPERIMENTAL_COMPRESS_SCHEMA` | Strips `description` and `additionalProperties` from tool JSON schemas |
| Path normalization | `FOX_EXPERIMENTAL_COMPRESS_PATHS` | Replaces workspace root paths with `./` relative paths |
| Tabular compression | `FOX_EXPERIMENTAL_COMPRESS_DATA` | Converts JSON arrays of objects into columnar format |
| Log deduplication | `FOX_EXPERIMENTAL_COMPRESS_DATA` | Collapses 3+ identical consecutive lines |
| JSON key packing | `FOX_EXPERIMENTAL_COMPRESS_DATA` | Replaces verbose keys with short aliases + legend |
| System prompt compaction | `FOX_EXPERIMENTAL_COMPRESS` | Uses compact prompt variants (70% smaller) |

**Master switch**: `FOX_EXPERIMENTAL_COMPRESS=true` enables all features.

### Prompt Compaction

| File | Original | Compact | Savings |
|------|---------|---------|---------|
| `src/session/prompt/default.txt` | 8,422b | `default-compact.txt` 2,502b | 70% |
| `src/foxcode/soul.txt` | 1,605b | `soul-compact.txt` 828b | 48% |
| **Combined** | **10,027b** | **3,330b** | **67%** |

---

## Automated Tests

### 1. Unit Tests — `bun run test:compress`

**What it tests**: Each compression transform in isolation with known inputs and expected outputs.

**Location**: `packages/core/test/compress.test.ts`

**Coverage**:
- Path normalization: workspace root replacement, edge cases (no paths, partial matches)
- Tabular compression: JSON arrays → columnar, arrays of primitives (skipped), nested objects
- Log deduplication: 3+ identical lines → collapsed, mixed content
- JSON key packing: object key abbreviation with legend, small objects (skipped)
- Pipeline integration: all transforms chained, empty input, non-compressible input
- Metrics: character counting, percentage calculation, summary format

**Run**:
```bash
CI=true bun run test:compress
# Expected: 39+ tests, 0 failures, <1s
```

### 2. Smoke Tests — `bun run test:smoke`

**What it tests**: Typecheck + compression tests + all core package tests (patch, edit, config).

**Location**: `scripts/test-smoke.sh`

**Run**:
```bash
CI=true bun run test:smoke
# Expected: 141+ tests, 0 failures, <30s
```

### 3. Typecheck — `bun run typecheck`

**What it tests**: Full monorepo type-checking including the new compact prompt imports and flag-gated selection in `system.ts`.

**Run**:
```bash
timeout 45s bun run typecheck
# Expected: exit 0, no errors
```

### 4. Deterministic Showdown — `fox-vs-kilo-showdown.ts`

**What it tests**: Byte-level comparison of compression transforms on simulated tool outputs. This is **fully deterministic** — same input produces same output every time, regardless of model or API availability.

**Location**: `tools/fox-vs-kilo-showdown.ts`

**Run**:
```bash
bun run tools/fox-vs-kilo-showdown.ts
```

**Expected output**:
```
  🦊 FOX vs KILO — Compression Showdown

  📐 SCHEMA MINIFICATION (per LLM request)
  Kilo (raw schemas):     18,331 bytes
  Fox (minified schemas): 4,391 bytes
  Saved per request:      13,940 bytes (76.0%)

  🔧 TOOL OUTPUT COMPRESSION (per call)
  TOTAL                   28,854    19,050   +9,804   34.0%

  🦊 VERDICT: Fox out-foxed Kilo!
```

**What to verify**:
- Schema savings should be ~76% (consistent across environments)
- Tool output savings should be ~34% (deterministic)
- All fixtures should show non-negative savings (no regressions)

---

## Manual Benchmarks

These require a running Fox server with an LLM provider configured.

### Prerequisites

```bash
# Ensure you have an LLM provider configured
# (e.g., LiteLLM proxy, OpenAI API key, or local model)
make -C ../openai-proxy up  # or configure your provider

# Verify the provider works
FOX_EXPERIMENTAL_COMPRESS=true bun run ./src/index.ts serve &
sleep 5
curl -sf http://127.0.0.1:4096/session | jq length
# Should return a number (list of sessions)
```

### 5. Fox Bench — `tools/fox-bench.sh`

**What it tests**: End-to-end agentic loop performance across 4 standard prompts. Measures token usage, latency, cache hit rates, and cost.

**Run**:
```bash
# Start server (no compression = Kilo baseline)
bun run ./src/index.ts serve &
sleep 5
bash tools/fox-bench.sh
# Note the "Tokens In" for each prompt

# Kill server, restart with compression
kill %1; sleep 2
FOX_EXPERIMENTAL_COMPRESS=true bun run ./src/index.ts serve &
sleep 5
bash tools/fox-bench.sh
# Compare "Tokens In" values
```

**Standard prompts**:
1. "What files are in the current directory?"
2. "Read the README.md and summarize it in one sentence."
3. "Find all TypeScript files that import from 'effect' and count them."
4. "Create a simple hello world script in /tmp/fox-bench-hello.ts"

> **⚠️ Important caveat**: Total session tokens will differ between runs because the model chooses different execution paths (different number of tool calls). This is normal and expected. Focus on **per-step token counts** (shown in the per-step breakdown) rather than totals.

### 6. Quality Check — `tools/fox-quality-check.sh`

**What it tests**: Side-by-side comparison of actual model responses from Kilo mode vs Fox mode, verifying that compression doesn't degrade answer quality.

**Run**:
```bash
# Step 1: Capture Kilo (no compression) responses
bun run ./src/index.ts serve &
sleep 5
bash tools/fox-quality-check.sh --capture kilo
kill %1; sleep 2

# Step 2: Capture Fox (compressed) responses
FOX_EXPERIMENTAL_COMPRESS=true bun run ./src/index.ts serve &
sleep 5
bash tools/fox-quality-check.sh --capture fox
kill %1

# Step 3: Compare
bash tools/fox-quality-check.sh --compare
```

**Expected output**:
```
  🦊 Fox vs Kilo — Quality Comparison

  [1] What files are in the current directory? Just list them.
      ✅ Fox contains expected: 'package.json'
      ✅ Kilo contains expected: 'package.json'

  [2] Read package.json and tell me the project name and version.
      ✅ Fox contains expected: '@fox/cli'

  [3] How many TypeScript files are in the src/ directory?
      ✅ Fox produced response

  Quality score: 3/3 prompts passed
  🦊 VERDICT: Fox produces same-quality responses with fewer tokens!
```

**What to verify**:
- All 3 prompts should pass quality checks
- Fox total input tokens should be lower than Kilo
- Responses should contain the same factual content

---

## File Reference

### Source Files

| File | Purpose |
|------|---------|
| [`compress.ts`](packages/core/src/tool/compress.ts) | Compression transforms (pipeline) |
| [`compression-metrics.ts`](packages/core/src/tool/compression-metrics.ts) | Per-call and aggregate metrics |
| [`tool.ts`](packages/core/src/tool/tool.ts) | Integration point (AI SDK `wrap()`) |
| [`system.ts`](src/session/system.ts) | Flag-gated prompt selection |
| [`default-compact.txt`](src/session/prompt/default-compact.txt) | Compact system prompt (70% smaller) |
| [`soul-compact.txt`](src/foxcode/soul-compact.txt) | Compact personality prompt (48% smaller) |
| [`flag.ts`](packages/core/src/flag/flag.ts) | Feature flag definitions |

### Test Files

| File | Purpose | Automated? |
|------|---------|-----------|
| [`compress.test.ts`](packages/core/test/compress.test.ts) | Unit tests for all transforms | ✅ Yes |
| [`fox-vs-kilo-showdown.ts`](tools/fox-vs-kilo-showdown.ts) | Deterministic byte-level comparison | ✅ Yes |
| [`fox-bench.sh`](tools/fox-bench.sh) | E2E token usage benchmark | ⚠️ Needs server |
| [`fox-quality-check.sh`](tools/fox-quality-check.sh) | Response quality comparison | ⚠️ Needs server |

### Research Documents

| File | Purpose |
|------|---------|
| [`est-savings-lossless-token-compression.md`](docs/research/est-savings-lossless-token-compression.md) | Original estimates (contains known overestimates) |
| [`test-plan-ideas-lossless-token-compression.md`](docs/research/test-plan-ideas-lossless-token-compression.md) | Test strategy brainstorm |
| [`stepping-back-lossless-token-compression.md`](docs/research/stepping-back-lossless-token-compression.md) | Recalibration & 12-point roadmap |
| [`test-plan-lossless-token-compression.md`](docs/test-plan-lossless-token-compression.md) | Master test plan |

---

## Reproducing Our Results

### Result 1: "35% fewer input tokens, same quality"

```bash
# Automated verification (deterministic, no server)
bun run tools/fox-vs-kilo-showdown.ts
# → Expect: 34% tool output savings, 76% schema savings

# Live verification (needs server + LLM)
bash tools/fox-quality-check.sh --capture kilo   # with server (no compress)
bash tools/fox-quality-check.sh --capture fox     # with server (compress on)
bash tools/fox-quality-check.sh --compare
# → Expect: 3/3 quality, Fox < Kilo on input tokens
```

### Result 2: "70% system prompt reduction"

```bash
# Direct byte comparison (no dependencies)
wc -c src/session/prompt/default.txt src/session/prompt/default-compact.txt \
     src/foxcode/soul.txt src/foxcode/soul-compact.txt
# → Expect: 10,027b original → 3,330b compact (67% reduction)
```

### Result 3: "141 tests pass"

```bash
CI=true bun run test:smoke
# → Expect: 141 tests, 0 failures
```

---

## Known Limitations

1. **Model non-determinism**: The model takes different execution paths between runs, making total-session token comparisons unreliable. Use per-tool-call metrics instead.

2. **Output verbosity**: Compact prompts may produce slightly more verbose model responses if brevity instructions aren't sufficiently reinforced. We addressed this with inline examples in `default-compact.txt`.

3. **Workload dependency**: SW dev workloads benefit most from path normalization and schema minification. Data workloads benefit from tabular/JSON compression. Research workloads see minimal savings with current transforms.

4. **LLM provider required**: Manual benchmarks need a working LLM provider. Automated tests (unit tests, showdown) work offline.

---

## Adding New Tests

To add a compression transform test:

```typescript
// In packages/core/test/compress.test.ts
test("myTransform: describe what it does", () => {
  const input = "raw tool output"
  const result = myTransform(input, { workspaceRoot: "/workspace", toolName: "test" })
  expect(result).toBe("expected compressed output")
  expect(result.length).toBeLessThan(input.length)
})
```

To add a quality check prompt:

```bash
# In tools/fox-quality-check.sh, add to PROMPTS and EXPECTED arrays:
PROMPTS+=("Your new prompt here")
EXPECTED+=("expected_substring_in_answer")
```
