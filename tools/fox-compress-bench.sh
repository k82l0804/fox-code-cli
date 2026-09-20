#!/usr/bin/env bash
# fox-compress-bench.sh — Automated A/B benchmark for compression features
#
# Usage:
#   ./tools/fox-compress-bench.sh                # Full A/B benchmark
#   ./tools/fox-compress-bench.sh --baseline     # Baseline only
#   ./tools/fox-compress-bench.sh --compressed   # Compressed only
#   ./tools/fox-compress-bench.sh --report       # Show last results
#
# Requires: fox server running (fox serve), jq
#
# What it does:
#   1. Runs benchmark prompts WITHOUT compression → baseline
#   2. Runs same prompts WITH compression → compressed
#   3. Compares token counts, latency, and reports savings
#
set -euo pipefail

FOX_SERVER="${FOX_SERVER:-http://localhost:4096}"
FOX_DIR="${FOX_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BENCH_DIR="${BENCH_DIR:-/tmp/fox-compress-bench}"
REPORT_FILE="${BENCH_DIR}/report.txt"

mkdir -p "$BENCH_DIR"

CURL_OPTS=(-sf -H "x-kilo-directory: ${FOX_DIR}")
if [ -n "${FOX_SERVER_PASSWORD:-}" ]; then
  CURL_OPTS+=(-H "Authorization: Bearer ${FOX_SERVER_PASSWORD}")
fi

# Prompts designed to exercise compression features:
# - Paths (grep/read), Tabular (JSON output), Dedup (bash ls), Schema (all)
PROMPTS=(
  "Find all TypeScript files that import from 'effect' and count them."
  "Read package.json and list all dependencies."
  "Run ls -la src/ and describe what you see."
  "Search for all TODO comments in the codebase."
  "Read tsconfig.json and summarize the compiler options."
)

# ─── Helpers ─────────────────────────────────────────────────────────────

run_prompt() {
  local prompt="$1"
  local session_id

  session_id=$(curl "${CURL_OPTS[@]}" -X POST "${FOX_SERVER}/session" \
    -H 'Content-Type: application/json' -d '{}' | jq -r '.id')

  if [ -z "$session_id" ] || [ "$session_id" = "null" ]; then
    echo "ERROR: Failed to create session" >&2
    return 1
  fi

  # Auto-approve permissions
  curl "${CURL_OPTS[@]}" -X POST "${FOX_SERVER}/permission/allow-everything" \
    -H "Content-Type: application/json" \
    -d "{\"enable\": true, \"sessionID\": \"${session_id}\"}" > /dev/null 2>&1 || true

  # Send prompt and wait for completion
  curl "${CURL_OPTS[@]}" -X POST "${FOX_SERVER}/session/${session_id}/message" \
    -H 'Content-Type: application/json' \
    -d "{\"parts\": [{\"type\": \"text\", \"text\": \"$prompt\"}]}" \
    > /dev/null 2>&1

  # Wait for processing
  local elapsed=0
  while [ $elapsed -lt 90 ]; do
    local msgs
    msgs=$(curl "${CURL_OPTS[@]}" "${FOX_SERVER}/session/${session_id}/message" 2>/dev/null || echo "[]")
    local last_role last_completed
    last_role=$(echo "$msgs" | jq -r 'if type == "array" then .[-1].info.role // "none" else "none" end' 2>/dev/null)
    last_completed=$(echo "$msgs" | jq -r 'if type == "array" then .[-1].info.time.completed // "null" else "null" end' 2>/dev/null)
    if [ "$last_role" = "assistant" ] && [ "$last_completed" != "null" ]; then
      break
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  # Collect metrics from messages
  local messages
  messages=$(curl "${CURL_OPTS[@]}" "${FOX_SERVER}/session/${session_id}/message" 2>/dev/null)

  if [ -z "$messages" ] || [ "$messages" = "null" ]; then
    echo "{\"error\": \"no messages\", \"prompt\": \"$prompt\"}"
    return 0
  fi

  # Extract token usage from assistant messages
  echo "$messages" | jq -c '{
    prompt: "'"$prompt"'",
    session: "'"$session_id"'",
    steps: [.[] | select(.info.role == "assistant") | {
      input_tokens: (.info.tokens.input // 0),
      output_tokens: (.info.tokens.output // 0),
      cache_read: (.info.tokens.cache.read // 0),
      cache_write: (.info.tokens.cache.write // 0),
      reasoning: (.info.tokens.reasoning // 0),
      duration_ms: (.info.time.completed - .info.time.created // 0)
    }],
    total_input: ([.[] | select(.info.role == "assistant") | .info.tokens.input // 0] | add),
    total_output: ([.[] | select(.info.role == "assistant") | .info.tokens.output // 0] | add),
    total_cache_read: ([.[] | select(.info.role == "assistant") | .info.tokens.cache.read // 0] | add),
    step_count: ([.[] | select(.info.role == "assistant")] | length)
  }' 2>/dev/null || echo "{\"error\": \"parse failed\", \"prompt\": \"$prompt\"}"
}

run_suite() {
  local label="$1"
  local output_file="$2"

  echo "Running ${label} suite (${#PROMPTS[@]} prompts)..."
  echo "[]" > "$output_file"

  for i in "${!PROMPTS[@]}"; do
    local prompt="${PROMPTS[$i]}"
    echo "  [$((i+1))/${#PROMPTS[@]}] ${prompt:0:60}..."
    local result
    result=$(run_prompt "$prompt")
    # Append to array
    jq --argjson new "$result" '. += [$new]' "$output_file" > "${output_file}.tmp" \
      && mv "${output_file}.tmp" "$output_file"
  done

  echo "  → Saved to $output_file"
}

compare_results() {
  local baseline="$1"
  local compressed="$2"

  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  COMPRESSION BENCHMARK RESULTS"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""

  python3 -c "
import json, sys

with open('$baseline') as f: base = json.load(f)
with open('$compressed') as f: comp = json.load(f)

total_base_input = sum(r.get('total_input', 0) or 0 for r in base)
total_comp_input = sum(r.get('total_input', 0) or 0 for r in comp)
total_base_cache = sum(r.get('total_cache_read', 0) or 0 for r in base)
total_comp_cache = sum(r.get('total_cache_read', 0) or 0 for r in comp)

saved = total_base_input - total_comp_input
pct = (saved / total_base_input * 100) if total_base_input > 0 else 0
cache_diff = total_comp_cache - total_base_cache

print(f'  Prompts:          {len(base)}')
print(f'')
print(f'  ┌─────────────────────────────────────────────┐')
print(f'  │  Metric              Baseline   Compressed  │')
print(f'  ├─────────────────────────────────────────────┤')
print(f'  │  Input tokens    {total_base_input:>10,}  {total_comp_input:>10,}  │')
print(f'  │  Cache read      {total_base_cache:>10,}  {total_comp_cache:>10,}  │')
print(f'  ├─────────────────────────────────────────────┤')
print(f'  │  Tokens saved    {saved:>+10,}              │')
print(f'  │  Reduction              {pct:>5.1f}%              │')
print(f'  │  Cache diff      {cache_diff:>+10,}              │')
print(f'  └─────────────────────────────────────────────┘')
print()

# Per-prompt breakdown
print(f'  Per-prompt breakdown:')
print(f'  {\"Prompt\":<50} {\"Base\":>8} {\"Comp\":>8} {\"Saved\":>8} {\"Pct\":>6}')
print(f'  {\"─\"*50} {\"─\"*8} {\"─\"*8} {\"─\"*8} {\"─\"*6}')
for b, c in zip(base, comp):
    bi = b.get('total_input', 0) or 0
    ci = c.get('total_input', 0) or 0
    s = bi - ci
    p = (s / bi * 100) if bi > 0 else 0
    prompt = (b.get('prompt', '?'))[:48]
    print(f'  {prompt:<50} {bi:>8,} {ci:>8,} {s:>+8,} {p:>5.1f}%')
print()
" 2>&1

  # Save report
  {
    echo "Benchmark: $(date -Iseconds)"
    echo "Baseline: $baseline"
    echo "Compressed: $compressed"
    echo "---"
    python3 -c "
import json
with open('$baseline') as f: base = json.load(f)
with open('$compressed') as f: comp = json.load(f)
bi = sum(r.get('total_input',0) or 0 for r in base)
ci = sum(r.get('total_input',0) or 0 for r in comp)
s = bi - ci
p = (s/bi*100) if bi>0 else 0
print(f'total_baseline_input={bi}')
print(f'total_compressed_input={ci}')
print(f'tokens_saved={s}')
print(f'pct_reduction={p:.1f}')
" 2>/dev/null
  } > "$REPORT_FILE"
}

# ─── Main ────────────────────────────────────────────────────────────────

case "${1:-all}" in
  --baseline)
    run_suite "BASELINE (no compression)" "${BENCH_DIR}/baseline.json"
    ;;
  --compressed)
    run_suite "COMPRESSED" "${BENCH_DIR}/compressed.json"
    ;;
  --report)
    if [ -f "${BENCH_DIR}/baseline.json" ] && [ -f "${BENCH_DIR}/compressed.json" ]; then
      compare_results "${BENCH_DIR}/baseline.json" "${BENCH_DIR}/compressed.json"
    else
      echo "No results found. Run the benchmark first."
      exit 1
    fi
    ;;
  all|"")
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Fox Compression A/B Benchmark"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo "Phase 1: BASELINE (compression OFF)"
    echo "  Please ensure server is running WITHOUT FOX_EXPERIMENTAL_COMPRESS"
    echo ""
    run_suite "BASELINE" "${BENCH_DIR}/baseline.json"
    echo ""
    echo "Phase 2: COMPRESSED (compression ON)"
    echo "  Please restart server WITH FOX_EXPERIMENTAL_COMPRESS=true"
    echo "  (or the script will use whatever server is currently running)"
    echo ""
    run_suite "COMPRESSED" "${BENCH_DIR}/compressed.json"
    echo ""
    compare_results "${BENCH_DIR}/baseline.json" "${BENCH_DIR}/compressed.json"
    ;;
  *)
    echo "Usage: $0 [--baseline|--compressed|--report|all]"
    exit 1
    ;;
esac
