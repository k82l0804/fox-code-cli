# Lossless Token Compression — Test Plan

> **Status**: Living document for Fox CLI compression feature testing  
> **Last Updated**: 2026-09-20  
> **Location**: `docs/test-plan-lossless-token-compression.md`

### Quick Start — Automated Tests

```bash
# Unit tests (39 tests, ~100ms)
bun run test:compress

# Included in smoke suite
bun run test:smoke

# Included in full suite
bun run test

# A/B benchmark (requires running server)
bash tools/fox-compress-bench.sh
```

| Test File | What it covers |
|-----------|---------------|
| `packages/core/test/compress.test.ts` | All transforms + metrics + pipeline |
| `tools/fox-compress-bench.sh` | A/B benchmark: baseline vs compressed |

---

## 1. Implementation Status

### Feature Inventory

| ID | Feature | Layer | Flag | Status | File(s) |
|----|---------|-------|------|--------|---------|
| 4.1A | Schema minification | LLM request prep | `FOX_EXPERIMENTAL_COMPRESS_SCHEMA` | ✅ Implemented | `src/session/llm.ts` |
| 4.2 | Path prefix normalization | Tool output compressor | `FOX_EXPERIMENTAL_COMPRESS_PATHS` | ✅ Implemented | `packages/core/src/tool/compress.ts` |
| 4.3 | KV-cache prefix freezing | Schema ordering | `FOX_EXPERIMENTAL_COMPRESS_SCHEMA` | ✅ Implemented | Schema sort in LLM prep |
| 4.4 | Tool output superseding | Session processor | `FOX_EXPERIMENTAL_COMPRESS_SUPERSEDE` | ⬜ Not yet | — |
| 4.5 | Diff context trimming | Tool output compressor | — | ⬜ Not yet | — |
| 4.7a | Tabular data compression | Tool output compressor | `FOX_EXPERIMENTAL_COMPRESS_DATA` | ✅ Implemented | `packages/core/src/tool/compress.ts` |
| 4.7b | Log line deduplication | Tool output compressor | `FOX_EXPERIMENTAL_COMPRESS_DATA` | ✅ Implemented | `packages/core/src/tool/compress.ts` |
| 4.7c | JSON key compression | Tool output compressor | `FOX_EXPERIMENTAL_COMPRESS_DATA` | ✅ Implemented | `packages/core/src/tool/compress.ts` |
| — | Compression metrics | Global accumulator | Always | ✅ Implemented | `packages/core/src/tool/compression-metrics.ts` |
| — | TUI compression panel | Sidebar plugin | Always (when data exists) | ✅ Implemented | `src/foxcode/plugins/sidebar-compression.tsx` |

### Execution Path (Critical Architecture Note)

There are **two separate tool execution systems** in Fox CLI:

```
AI SDK Runtime (default):  src/tool/tool.ts → wrap() → ToolOutputCompressor.process()
Native LLM Runtime:        packages/core/src/tool/tool.ts → settle() → toModelOutput()
```

The compression pipeline is wired into **both** paths. When testing, verify the AI SDK path (default `bun run dev`) since that's what >99% of users run.

---

## 2. Unit Tests

### 2.1 Path Normalization (`relativizePaths`)

```
Test file: packages/core/test/tool/compress-paths.test.ts
```

| # | Test Case | Input | Expected Output |
|---|-----------|-------|-----------------|
| P1 | Single absolute path | `File: /home/user/project/src/main.ts` | `File: src/main.ts` |
| P2 | Multiple paths same prefix | `/home/user/project/a.ts\n/home/user/project/b.ts` | `a.ts\nb.ts` |
| P3 | Path in grep output | `/home/user/project/src/foo.ts:42: const x = 1` | `src/foo.ts:42: const x = 1` |
| P4 | Mixed paths and text | `Error in /home/user/project/src/bar.ts\nSome text` | `Error in src/bar.ts\nSome text` |
| P5 | No paths present | `Just some text` | `Just some text` (unchanged) |
| P6 | Path outside workspace | `/usr/lib/node_modules/foo.ts` | Unchanged |
| P7 | Very long repeated paths | 100 lines with same `/home/user/very/deep/path/` | Significant char savings |

### 2.2 Tabular Compression (`compressTabular`)

```
Test file: packages/core/test/tool/compress-tabular.test.ts
```

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| T1 | TSV with repeated values | `name\tage\nAlice\t30\nBob\t30` | Compressed or unchanged |
| T2 | Markdown table | `| col1 | col2 |\n|---|---|\n| a | b |` | Whitespace reduced |
| T3 | No tables present | `plain text` | Unchanged |
| T4 | Large CSV (500 rows) | Generated CSV fixture | Measurable savings |
| T5 | Mixed table + text | Table embedded in prose | Only table compressed |

### 2.3 Log Deduplication (`deduplicateLogLines`)

```
Test file: packages/core/test/tool/compress-dedup.test.ts
```

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| D1 | 10 identical lines | `ERROR: timeout\n` × 10 | `ERROR: timeout (×10)` |
| D2 | Near-identical (timestamps differ) | `[12:01] ERR\n[12:02] ERR\n...` | Deduplicated |
| D3 | No duplicates | 10 unique lines | Unchanged |
| D4 | Mixed duplicates | 3 unique + 7 repeated | Only repeated collapsed |
| D5 | Threshold: 2 copies | 2 identical lines | NOT collapsed (below threshold) |

### 2.4 JSON Key Compression (`compressJsonKeys`)

```
Test file: packages/core/test/tool/compress-json.test.ts
```

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| J1 | Array of objects, repeated keys | `[{"name":"a","value":1},{"name":"b","value":2}]` | Keys shortened or tabular |
| J2 | Nested JSON | `{"a":{"b":{"c":1}}}` | Unchanged (not array) |
| J3 | Empty array | `[]` | Unchanged |
| J4 | Large array (100 objects, 10 keys) | Generated fixture | Measurable savings |
| J5 | Non-JSON text | `not json at all` | Unchanged |

### 2.5 Schema Minification

```
Test file: packages/core/test/tool/compress-schema.test.ts (or in LLM prep tests)
```

| # | Test Case | Expected |
|---|-----------|----------|
| S1 | Schema with `description` fields | Descriptions stripped |
| S2 | Schema with `additionalProperties: false` | Removed |
| S3 | Nested `$defs` with descriptions | All descriptions stripped |
| S4 | Schema roundtrip: minified schema still validates tool input | ✅ Valid |
| S5 | Minified schemas produce same tool-call success rate | ✅ No regression |

### 2.6 Compression Metrics Accumulator

```
Test file: packages/core/test/tool/compression-metrics.test.ts
```

| # | Test Case | Expected |
|---|-----------|----------|
| M1 | `reset()` clears all counters | All zeros |
| M2 | `record()` accumulates charsBefore/charsAfter | Correct sums |
| M3 | `summary()` computes pctSaved correctly | `(before-after)/before * 100` |
| M4 | `active()` returns false before any recording | `false` |
| M5 | `active()` returns true after `record()` | `true` |
| M6 | Multiple `record()` calls accumulate | Sum of all calls |
| M7 | `recordSchema()` tracks separately | `schemaSaved` field populated |

---

## 3. Integration Tests

### 3.1 Pipeline Integration

These tests verify the full compression pipeline from tool output through to what the model receives.

```
Test file: test/compression-pipeline.test.ts
```

| # | Test | Method |
|---|------|--------|
| I1 | Compression is called for `read` tool | Start server, send prompt → check metrics |
| I2 | Compression is called for `grep` tool | Prompt triggers grep → metrics show charsBefore > 0 |
| I3 | Compression is called for `bash` tool | Prompt triggers bash → metrics recorded |
| I4 | Metrics survive step lifecycle | Run 3-step session → total metrics accumulate correctly |
| I5 | Compression disabled when flag off | No `FOX_EXPERIMENTAL_COMPRESS` → metrics show `active() = false` |
| I6 | Schema minification applied | Compare raw vs minified schema byte sizes |

### 3.2 Safety / Correctness Tests

| # | Test | Expected |
|---|------|----------|
| C1 | Compressed grep output still contains all file paths | No paths lost |
| C2 | Compressed read output preserves all file content | Byte-for-byte content match |
| C3 | Tool call success rate with compression ≥ without | No regression |
| C4 | Minified schemas still validate all tool inputs | JSON Schema validation passes |
| C5 | Compression never increases output by >1% | Bounded inflation check |

---

## 4. Benchmark Methodology

### 4.1 Benchmark Infrastructure

Use `tools/fox-bench.sh` as the harness. Extend it with:

1. **Compression metrics capture**: Read from session SSE events or server logs
2. **A/B mode**: Run same prompts with and without `FOX_EXPERIMENTAL_COMPRESS`
3. **Report format**: JSONL with per-step token counts + compression summary

### 4.2 Simulated Workloads

Create fixture directories under `tools/bench-fixtures/` with deterministic content that exercises each compression feature:

#### Workload A: Software Development

```
tools/bench-fixtures/sw-dev/
├── src/
│   ├── main.ts          (200 lines, imports from 10 modules)
│   ├── utils.ts          (150 lines, repeated path references)
│   ├── handler.ts        (300 lines, nested functions)
│   └── types.ts          (100 lines, exported types)
├── test/
│   └── main.test.ts      (100 lines)
├── package.json
├── tsconfig.json
└── README.md
```

**Prompts** (10-turn session):
1. "Read package.json and summarize the project"
2. "Find all TypeScript files that export types"
3. "Search for all `import` statements in src/"
4. "Read src/main.ts and explain the entry point"
5. "Find all TODO comments in the codebase"
6. "Run `ls -la src/` and describe the file structure"
7. "Read src/handler.ts and find potential bugs"
8. "Search for all functions that take more than 3 parameters"
9. "Read tsconfig.json and explain the compiler options"
10. "Summarize all findings from this session"

**Expected compression targets**:
- Path normalization: 5–15% on grep/read outputs
- Schema minification: -1k to -2k bytes per turn (fixed)
- Overall: 8–20% token reduction

#### Workload B: Data Analysis

```
tools/bench-fixtures/data-analysis/
├── data/
│   ├── sales.csv         (500 rows, 8 columns)
│   ├── users.json        (100 objects, 12 keys each)
│   ├── app.log           (1000 lines, repeated patterns)
│   └── metrics.tsv       (200 rows, timestamps + values)
├── queries.sql
└── README.md
```

**Prompts**:
1. "Read sales.csv and describe the schema"
2. "Find the top 10 rows by revenue"
3. "Read users.json and count unique countries"
4. "Search app.log for ERROR entries"
5. "Read metrics.tsv and identify anomalies"
6. "Find all SQL queries that reference the users table"

**Expected compression targets**:
- Tabular compression: 20–40% on CSV/TSV
- JSON key compression: 15–30% on JSON arrays
- Log deduplication: 30–60% on repetitive logs
- Overall: 15–35% token reduction

#### Workload C: Large Codebase Navigation

```
Use the fox-code-cli workspace itself as the fixture.
```

**Prompts**:
1. "Find all files that import from `@opencode-ai/core`"
2. "Read src/session/processor.ts and explain the step lifecycle"
3. "Search for all Effect.fn calls and count them"
4. "Find all tool definitions in packages/core/src/tool/"
5. "Read the 5 largest TypeScript files and summarize each"

**Expected compression targets**:
- Path normalization: 10–25% (deep paths like `/home/user/workarea/fox/fox-code-cli/packages/core/src/tool/...`)
- Schema minification: -1.3k bytes per turn
- Overall: 10–20% token reduction

### 4.3 Benchmark Matrix

```
Workload × Compression Mode × Model
```

#### Compression Modes

| Mode | Flags |
|------|-------|
| **Baseline** | No `FOX_EXPERIMENTAL_COMPRESS` |
| **Schema only** | `FOX_EXPERIMENTAL_COMPRESS_SCHEMA=true` |
| **Paths only** | `FOX_EXPERIMENTAL_COMPRESS_PATHS=true` |
| **Data only** | `FOX_EXPERIMENTAL_COMPRESS_DATA=true` |
| **All transforms** | `FOX_EXPERIMENTAL_COMPRESS=true` |

#### Models

| Model | Type | Notes |
|-------|------|-------|
| gpt-4o-mini (via LiteLLM) | Local proxy | Default dev model |
| gemma-4-30b | Corporate | Throttled |
| gpt-oss-120b | Corporate | Throttled |

#### Metrics per cell

| Metric | Source | Category |
|--------|--------|----------|
| Input tokens | Session SSE | Token savings |
| Output tokens | Session SSE | — |
| Cache read tokens | Session SSE | Performance |
| Cache rate (%) | Computed | Performance |
| TTFT (ms) | Session SSE | Performance |
| Total latency (ms) | Wall clock | Performance |
| Chars saved | Compression metrics | Token savings |
| % saved | Computed | Token savings |
| Schema bytes saved | Compression metrics | Token savings |
| Tool-call success rate | Session outcome | Correctness |
| Task completion | Manual/automated | Correctness |

### 4.4 Running a Benchmark

```bash
# Start server
FOX_EXPERIMENTAL_COMPRESS=true FOX_TRACING=1 bun run ./src/index.ts serve

# Run workload A (sw-dev) with all compression
FOX_DIR=tools/bench-fixtures/sw-dev bash tools/fox-bench.sh

# Run workload A without compression (baseline)
FOX_DIR=tools/bench-fixtures/sw-dev bash tools/fox-bench.sh

# Compare results
bash tools/fox-bench.sh --report
```

---

## 5. Logging & Observability

### 5.1 What's Currently Logged

| Data | Where | Level |
|------|-------|-------|
| Per-transform char savings | `log.debug("compression.*")` | DEBUG |
| Total compression summary | `log.info("compression.total")` | INFO |
| Schema minification bytes | `CompressionMetrics.recordSchema()` | Metrics accumulator |
| Per-step metrics summary | Emitted at `step-finish` via `CompressionMetrics.summary()` | SSE events |
| Jaeger spans | OTLP → Jaeger (`FOX_TRACING=1`) | Trace |

### 5.2 How to Verify Each Feature is Working

| Feature | Verification Method |
|---------|-------------------|
| Schema minification | Check `Schemas: -X.Xk bytes` in TUI compression panel |
| Path normalization | Jaeger: look for `compression.path_normalization` span with `charsSaved > 0` |
| Tabular compression | Jaeger: `compression.structured_data.tabular` span |
| Log dedup | Jaeger: `compression.structured_data.dedup` span |
| JSON keys | Jaeger: `compression.structured_data.json_keys` span |
| KV-cache optimization | Check `Cache rate` in Token Usage panel; should be >50% for multi-turn |
| Metrics accumulation | TUI: `Total saved` row in Session section shows cumulative |

### 5.3 Jaeger Usage

```bash
# Start Jaeger
docker compose -f tools/jaeger.yml up -d

# Start Fox with tracing
FOX_EXPERIMENTAL_COMPRESS=true FOX_TRACING=1 bun run dev

# View traces
open http://localhost:16686
# → Service: "fox" → Find Traces
# → Look for "Tool.execute" spans → child compression spans
```

---

## 6. Regression Testing Strategy

### 6.1 CI Smoke Test

Add to `bun run test:smoke`:

```typescript
// test/compression-smoke.test.ts
test("compression metrics accumulate correctly", () => {
  CompressionMetrics.reset()
  CompressionMetrics.record("tool_output", 1000, 800, 5.0)
  CompressionMetrics.record("tool_output", 500, 450, 2.0)
  const s = CompressionMetrics.summary()
  expect(s.charsBefore).toBe(1500)
  expect(s.charsAfter).toBe(1250)
  expect(s.charsSaved).toBe(250)
  expect(s.pctSaved).toBeCloseTo(16.7, 0)
  expect(s.overheadMs).toBe(7.0)
})

test("path normalization removes workspace prefix", () => {
  const result = ToolOutputCompressor.process(
    "File: /home/user/project/src/main.ts:42",
    { workspaceRoot: "/home/user/project", toolName: "grep" }
  )
  expect(result).toBe("File: src/main.ts:42")
})
```

### 6.2 Snapshot Tests

For each compression transform, maintain a set of input/output fixture pairs:

```
packages/core/test/fixtures/compress/
├── paths/
│   ├── grep-output.input.txt
│   └── grep-output.expected.txt
├── tabular/
│   ├── csv-500rows.input.txt
│   └── csv-500rows.expected.txt
└── dedup/
    ├── repeated-logs.input.txt
    └── repeated-logs.expected.txt
```

If a snapshot changes, the test fails and forces a review.

### 6.3 Correctness Invariants

Every compression transform must satisfy:

1. **Lossless semantics**: The model can still answer correctly from compressed output
2. **Bounded inflation**: Output is never >1% larger than input
3. **Idempotent**: `compress(compress(x)) === compress(x)`
4. **Safe on empty**: `compress("") === ""`
5. **Safe on non-matching**: Non-compressible input passes through unchanged

---

## 7. Future Work

| Priority | Feature | Test Approach |
|----------|---------|---------------|
| High | Tool output superseding (4.4) | Integration test: 3 reads of same file → only latest kept |
| High | Diff context trimming (4.5) | Unit test: large diff → trimmed → still applies cleanly |
| Medium | Workload detection | Unit test: classify tool mix → correct workload type |
| Medium | Compression cost budgeting | Unit test: slow transform (>200ms) → auto-skipped |
| Low | Indexing-aware retrieval (4.6) | Integration test: indexed workspace → minimal context |

---

## Appendix: Quick Reference

### Enable compression
```bash
FOX_EXPERIMENTAL_COMPRESS=true bun run dev
```

### Enable individual features
```bash
FOX_EXPERIMENTAL_COMPRESS_PATHS=true   # Path normalization only
FOX_EXPERIMENTAL_COMPRESS_DATA=true    # Tabular + dedup + JSON keys
FOX_EXPERIMENTAL_COMPRESS_SCHEMA=true  # Schema minification
```

### Check if compression is working
1. **TUI**: Look for `▼ Compression` panel in sidebar
2. **Jaeger**: `FOX_TRACING=1` → http://localhost:16686 → service "fox"
3. **Logs**: Set `FOX_LOG_LEVEL=DEBUG` → look for `compression.*` entries
