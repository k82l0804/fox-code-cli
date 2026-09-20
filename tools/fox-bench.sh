#!/usr/bin/env bash
# fox-bench.sh — Benchmark Fox CLI agentic loop performance
#
# Usage:
#   ./tools/fox-bench.sh                     # Run all benchmark prompts
#   ./tools/fox-bench.sh --prompt "explain this code"  # Single prompt
#   ./tools/fox-bench.sh --report            # Show report from last run
#
# Requirements:
#   - Fox CLI built and in PATH (or use FOX_BIN env var)
#   - Fox server running: fox serve
#   - jq installed
#   - Set FOX_SERVER to the server URL (e.g. http://127.0.0.1:4096)
#
# What it measures:
#   - Total session wall time (first user message → last assistant completed)
#   - Per-step latency (each assistant message: created → completed)
#   - Token usage per step (input, output, reasoning, cache)
#   - Total tokens and cost for the session
#
export PATH="$HOME/.local/bin:$PATH"
set -euo pipefail

FOX_BIN="${FOX_BIN:-fox}"
FOX_SERVER="${FOX_SERVER:-http://localhost:4096}"
FOX_DIR="${FOX_DIR:-$(pwd)}"
BENCH_DIR="${BENCH_DIR:-/tmp/fox-bench}"
RESULTS_FILE="${BENCH_DIR}/results.jsonl"

mkdir -p "$BENCH_DIR"

# Default benchmark prompts — short tasks that exercise the full loop
BENCH_PROMPTS=(
  "What files are in the current directory?"
  "Read the README.md and summarize it in one sentence."
  "Find all TypeScript files that import from 'effect' and count them."
  "Create a simple hello world script in /tmp/fox-bench-hello.ts"
)

# Common curl options — pass the project directory header so the server
# can resolve the instance. No auth by default.
CURL_OPTS=(-sf -H "x-kilo-directory: ${FOX_DIR}")
if [ -n "${FOX_SERVER_PASSWORD:-}" ]; then
  CURL_OPTS+=(-H "Authorization: Bearer ${FOX_SERVER_PASSWORD}")
fi

print_usage() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  --prompt TEXT     Run a single prompt"
  echo "  --report          Show report from last run"
  echo "  --server URL      Fox server URL (default: $FOX_SERVER)"
  echo "  --dir PATH        Project directory (default: cwd)"
  echo "  --help            Show this help"
  echo ""
  echo "Environment:"
  echo "  FOX_SERVER          Server URL (default: http://localhost:4096)"
  echo "  FOX_DIR             Project directory (default: cwd)"
  echo "  FOX_SERVER_PASSWORD Auth password (optional)"
  echo "  FOX_BIN             Fox binary path (default: fox)"
}

# Check if fox server is reachable — there's no /health endpoint,
# so we test with GET /session (list sessions).
check_server() {
  if ! curl "${CURL_OPTS[@]}" "${FOX_SERVER}/session" > /dev/null 2>&1; then
    echo "ERROR: Fox server not reachable at ${FOX_SERVER}"
    echo ""
    echo "Start it with:  fox serve"
    echo "Then set:       export FOX_SERVER=http://127.0.0.1:<port>"
    echo ""
    echo "Tip: The URL is printed by 'fox serve' on startup."
    exit 1
  fi
  echo "✓ Server reachable at ${FOX_SERVER}"
}

# Create a new session — POST /session with empty body
create_session() {
  local resp
  resp=$(curl "${CURL_OPTS[@]}" -X POST "${FOX_SERVER}/session" \
    -H "Content-Type: application/json" \
    -d '{}' 2>/dev/null) || {
    echo "ERROR: Failed to create session" >&2
    return 1
  }
  local sid
  sid=$(echo "$resp" | jq -r '.id // empty')
  if [ -n "$sid" ]; then
    # Enable allow-everything permission for this benchmark session
    curl "${CURL_OPTS[@]}" -X POST "${FOX_SERVER}/permission/allow-everything" \
      -H "Content-Type: application/json" \
      -d "{\"enable\": true, \"sessionID\": \"${sid}\"}" > /dev/null 2>&1 || true
  fi
  echo "$sid"
}

# Background daemon to auto-approve any interactive permission prompts during benchmarks
auto_approve_loop() {
  while true; do
    local pending
    pending=$(curl "${CURL_OPTS[@]}" "${FOX_SERVER}/permission" 2>/dev/null || echo "[]")
    local req_ids
    req_ids=$(echo "$pending" | jq -r 'if type == "array" then .[].id // empty else empty end' 2>/dev/null)
    for rid in $req_ids; do
      if [ -n "$rid" ]; then
        curl "${CURL_OPTS[@]}" -X POST "${FOX_SERVER}/permission/${rid}/reply" \
          -H "Content-Type: application/json" \
          -d '{"reply":"always"}' >/dev/null 2>&1 || true
      fi
    done
    sleep 0.5
  done
}

# Send a prompt to a session — POST /session/:id/message
send_prompt() {
  local session_id="$1"
  local prompt="$2"
  curl "${CURL_OPTS[@]}" -X POST "${FOX_SERVER}/session/${session_id}/message" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg p "$prompt" '{parts: [{type: "text", text: $p}]}')" \
    > /dev/null 2>&1
}

# Wait for session to finish by polling the run state
wait_for_completion() {
  local session_id="$1"
  local timeout="${2:-120}"
  local elapsed=0
  while [ $elapsed -lt $timeout ]; do
    local resp
    resp=$(curl "${CURL_OPTS[@]}" "${FOX_SERVER}/session/${session_id}" 2>/dev/null || echo "{}")
    # A session with no running loop has an "idle" status or just exists without active processing.
    # Check if the last assistant message has a completed timestamp.
    local msgs
    msgs=$(curl "${CURL_OPTS[@]}" "${FOX_SERVER}/session/${session_id}/message" 2>/dev/null || echo "[]")
    local last_role last_completed
    last_role=$(echo "$msgs" | jq -r 'if type == "array" then .[-1].info.role // "none" else "none" end' 2>/dev/null)
    last_completed=$(echo "$msgs" | jq -r 'if type == "array" then .[-1].info.time.completed // "null" else "null" end' 2>/dev/null)

    if [ "$last_role" = "assistant" ] && [ "$last_completed" != "null" ]; then
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  echo "TIMEOUT after ${timeout}s" >&2
  return 1
}

# Extract performance metrics from the session DB
extract_metrics() {
  local session_id="$1"
  "$FOX_BIN" db --format json "
    SELECT
      m.id,
      json_extract(m.data, '$.role') as role,
      json_extract(m.data, '$.agent') as agent,
      json_extract(m.data, '$.modelID') as model,
      json_extract(m.data, '$.time.created') as time_created,
      json_extract(m.data, '$.time.completed') as time_completed,
      CASE
        WHEN json_extract(m.data, '$.time.completed') IS NOT NULL
        THEN json_extract(m.data, '$.time.completed') - json_extract(m.data, '$.time.created')
        ELSE NULL
      END as latency_ms,
      json_extract(m.data, '$.tokens.input') as tokens_input,
      json_extract(m.data, '$.tokens.output') as tokens_output,
      json_extract(m.data, '$.tokens.reasoning') as tokens_reasoning,
      json_extract(m.data, '$.tokens.cache.read') as cache_read,
      json_extract(m.data, '$.tokens.cache.write') as cache_write,
      json_extract(m.data, '$.cost') as cost,
      json_extract(m.data, '$.finish') as finish_reason
    FROM message m
    WHERE m.session_id = '${session_id}'
    ORDER BY m.time_created ASC
  " 2>/dev/null
}

# Extract session-level aggregates
extract_session_summary() {
  local session_id="$1"
  "$FOX_BIN" db --format json "
    SELECT
      s.id,
      s.title,
      s.cost,
      s.tokens_input,
      s.tokens_output,
      s.tokens_reasoning,
      s.tokens_cache_read,
      s.tokens_cache_write,
      s.time_created,
      s.time_updated,
      (s.time_updated - s.time_created) as total_ms,
      (SELECT COUNT(*) FROM message m WHERE m.session_id = s.id AND json_extract(m.data, '$.role') = 'assistant') as assistant_steps
    FROM session s
    WHERE s.id = '${session_id}'
  " 2>/dev/null
}

# Print a formatted report for one session
print_report() {
  local session_id="$1"
  local prompt="$2"

  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  Prompt: ${prompt:0:60}"
  echo "═══════════════════════════════════════════════════════════════"

  local summary
  summary=$(extract_session_summary "$session_id")
  if [ -n "$summary" ]; then
    echo "$summary" | jq -r '
      .[] |
      "  Session:    \(.id)",
      "  Title:      \(.title // "untitled")",
      "  Steps:      \(.assistant_steps)",
      "  Total Time: \(.total_ms // 0)ms",
      "  Tokens In:  \(.tokens_input)",
      "  Tokens Out: \(.tokens_output)",
      "  Cache Read: \(.tokens_cache_read)",
      "  Cost:       $\(.cost // 0)"
    ' 2>/dev/null
  fi

  echo ""
  echo "  Per-Step Breakdown:"
  echo "  ─────────────────────────────────────────────────────────────"
  printf "  %-6s %-10s %-10s %-10s %-10s %-10s %s\n" "Step" "Latency" "In Tokens" "Out Tokens" "Cache Rd" "Cost" "Finish"
  echo "  ─────────────────────────────────────────────────────────────"

  local metrics
  metrics=$(extract_metrics "$session_id")
  local step=0
  if [ -n "$metrics" ]; then
    echo "$metrics" | jq -r '
      .[] | select(.role == "assistant") |
      "\(.latency_ms // "-")\t\(.tokens_input // 0)\t\(.tokens_output // 0)\t\(.cache_read // 0)\t\(.cost // 0)\t\(.finish_reason // "-")"
    ' 2>/dev/null | while IFS=$'\t' read -r lat tin tout crd cst fin; do
      step=$((step + 1))
      printf "  %-6d %-10s %-10s %-10s %-10s %-10s %s\n" "$step" "${lat}ms" "$tin" "$tout" "$crd" "\$${cst}" "$fin"
    done
  fi
  echo ""
}

# Run a single benchmark
run_benchmark() {
  local prompt="$1"
  echo "▶ Running: ${prompt:0:60}..."

  local start_time
  start_time=$(date +%s%3N)

  local session_id
  session_id=$(create_session)
  if [ -z "$session_id" ]; then
    echo "  ✗ Failed to create session"
    return 1
  fi
  echo "  Session: ${session_id}"

  auto_approve_loop &
  local approver_pid=$!

  send_prompt "$session_id" "$prompt"
  wait_for_completion "$session_id" 120

  kill "$approver_pid" 2>/dev/null || true
  wait "$approver_pid" 2>/dev/null || true

  local end_time
  end_time=$(date +%s%3N)
  local wall_ms=$((end_time - start_time))

  echo "  ✓ Completed in ${wall_ms}ms"

  # Save result
  jq -n \
    --arg sid "$session_id" \
    --arg prompt "$prompt" \
    --argjson wall "$wall_ms" \
    --arg ts "$(date -Iseconds)" \
    '{session_id: $sid, prompt: $prompt, wall_ms: $wall, timestamp: $ts}' \
    >> "$RESULTS_FILE"

  print_report "$session_id" "$prompt"
}

# Show report from results file
show_report() {
  if [ ! -f "$RESULTS_FILE" ]; then
    echo "No results found. Run benchmarks first."
    exit 1
  fi
  echo ""
  echo "Fox CLI Benchmark Results"
  echo "═══════════════════════════════════════════════════════════════"
  while IFS= read -r line; do
    local sid prompt
    sid=$(echo "$line" | jq -r '.session_id')
    prompt=$(echo "$line" | jq -r '.prompt')
    print_report "$sid" "$prompt"
  done < "$RESULTS_FILE"
}

# Clean up any child jobs on exit or interrupt
trap 'kill $(jobs -p) 2>/dev/null || true' EXIT INT TERM

# Main
case "${1:-}" in
  --help)
    print_usage
    exit 0
    ;;
  --report)
    show_report
    exit 0
    ;;
  --prompt)
    check_server
    run_benchmark "${2:?Missing prompt text}"
    ;;
  --server)
    FOX_SERVER="${2:?Missing server URL}"
    shift 2
    "$0" "$@"
    ;;
  --dir)
    FOX_DIR="${2:?Missing directory path}"
    shift 2
    "$0" "$@"
    ;;
  *)
    check_server
    echo ""
    echo "Fox CLI Agentic Loop Benchmark"
    echo "Server: ${FOX_SERVER}"
    echo "Directory: ${FOX_DIR}"
    echo "Results: ${RESULTS_FILE}"
    echo ""
    # Clear previous results
    > "$RESULTS_FILE"
    for prompt in "${BENCH_PROMPTS[@]}"; do
      run_benchmark "$prompt"
    done
    echo ""
    echo "Done. Run '$0 --report' to review."
    ;;
esac
