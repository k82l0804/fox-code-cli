#!/usr/bin/env bash
# fox-vs-kilo-realworld-eval.sh — Autonomous Real-World A/B Capability Benchmark
# Compares Fox Code CLI (lossless compression ON) vs Kilo Code (baseline OFF)
# across 3 production-grade software engineering challenges.
#
# Tasks:
#   1. App Generation & Self-Debug: Task Queue & Worker Engine (queue.ts + tests + demo)
#   2. Code Refactor & Explanation: E-Commerce Pricing Matrix (clean code + inline comments + tests)
#   3. Bug Diagnosis & Repair: Sliding Window Rate Limiter (diagnose failing tests + surgical fix)
#
# Usage:
#   ./tools/fox-vs-kilo-realworld-eval.sh --all           # Run full A/B benchmark (Kilo + Fox)
#   ./tools/fox-vs-kilo-realworld-eval.sh --fox           # Run Fox (compressed) only
#   ./tools/fox-vs-kilo-realworld-eval.sh --kilo          # Run Kilo (baseline) only
#   ./tools/fox-vs-kilo-realworld-eval.sh --task 1        # Run single task across both
#   ./tools/fox-vs-kilo-realworld-eval.sh --report        # Show last results comparison
#
export PATH="$HOME/.local/bin:$PATH"
export OPENAI_BASE_URL="${OPENAI_BASE_URL:-http://localhost:8000/v1}"
export OPENAI_API_KEY="${OPENAI_API_KEY:-local-dev}"
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STRESS_DIR="${SCRIPT_DIR}/stress/realworld"
EVAL_BASE_DIR="/tmp/fox-eval"

FOX_PORT="${FOX_PORT:-4096}"
KILO_PORT="${KILO_PORT:-4097}"
FOX_URL="http://127.0.0.1:${FOX_PORT}"
KILO_URL="http://127.0.0.1:${KILO_PORT}"

FOX_SERVER_PID=""
KILO_SERVER_PID=""
APPROVER_PID=""

cleanup() {
  if [ -n "$APPROVER_PID" ]; then
    kill "$APPROVER_PID" 2>/dev/null || true
    wait "$APPROVER_PID" 2>/dev/null || true
    APPROVER_PID=""
  fi
  if [ -n "$FOX_SERVER_PID" ]; then
    echo "Stopping background Fox server (PID $FOX_SERVER_PID)..."
    kill "$FOX_SERVER_PID" 2>/dev/null || true
    wait "$FOX_SERVER_PID" 2>/dev/null || true
    FOX_SERVER_PID=""
  fi
  if [ -n "$KILO_SERVER_PID" ]; then
    echo "Stopping background Kilo baseline server (PID $KILO_SERVER_PID)..."
    kill "$KILO_SERVER_PID" 2>/dev/null || true
    wait "$KILO_SERVER_PID" 2>/dev/null || true
    KILO_SERVER_PID=""
  fi
  fuser -k "${FOX_PORT}/tcp" 2>/dev/null || true
  fuser -k "${KILO_PORT}/tcp" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ─── Server Management ───────────────────────────────────────────────────

ensure_server() {
  local mode="$1"
  local port url
  if [ "$mode" = "fox" ]; then
    port="$FOX_PORT"
    url="$FOX_URL"
  else
    port="$KILO_PORT"
    url="$KILO_URL"
  fi

  if curl -m 3 -sf "${url}/session" >/dev/null 2>&1; then
    echo "✔ Server for ${mode} ready at ${url}"
    return 0
  fi

  if [ "$mode" = "kilo" ]; then
    echo "▶ Starting Kilo baseline server (FOX_EXPERIMENTAL_COMPRESS=false) on port ${port}..."
    (
      cd "$ROOT_DIR"
      FOX_REQUEST_TIMEOUT_MS="${FOX_REQUEST_TIMEOUT_MS:-180000}" \
      FOX_EXPERIMENTAL_COMPRESS=false \
      FOX_EXPERIMENTAL_COMPRESS_PATHS=false \
      FOX_EXPERIMENTAL_COMPRESS_SCHEMA=false \
      FOX_EXPERIMENTAL_COMPRESS_DIFF=false \
      FOX_EXPERIMENTAL_COMPRESS_DATA=false \
      FOX_EXPERIMENTAL_COMPRESS_SUPERSEDE=false \
      FOX_EXPERIMENTAL_COMPRESS_GIT=false \
      bun run ./src/index.ts serve --port "$port" > "/tmp/kilo-server-${port}.log" 2>&1
    ) &
    KILO_SERVER_PID=$!

    # Wait up to 15s for server to listen
    local attempts=0
    while [ $attempts -lt 30 ]; do
      if curl -m 2 -sf "${url}/session" >/dev/null 2>&1; then
        echo "✔ Kilo baseline server started on port ${port} (PID: ${KILO_SERVER_PID})"
        return 0
      fi
      sleep 0.5
      attempts=$((attempts + 1))
    done
    echo "ERROR: Kilo baseline server failed to start on port ${port}. See /tmp/kilo-server-${port}.log" >&2
    exit 1
  else
    echo "▶ Starting Fox server (FOX_EXPERIMENTAL_COMPRESS=true) on port ${port}..."
    (
      cd "$ROOT_DIR"
      FOX_REQUEST_TIMEOUT_MS="${FOX_REQUEST_TIMEOUT_MS:-180000}" \
      FOX_EXPERIMENTAL_COMPRESS=true \
      bun run ./src/index.ts serve --port "$port" > "/tmp/fox-server-${port}.log" 2>&1
    ) &
    FOX_SERVER_PID=$!

    local attempts=0
    while [ $attempts -lt 30 ]; do
      if curl -m 2 -sf "${url}/session" >/dev/null 2>&1; then
        echo "✔ Fox server started on port ${port} (PID: ${FOX_SERVER_PID})"
        return 0
      fi
      sleep 0.5
      attempts=$((attempts + 1))
    done
    echo "ERROR: Fox server failed to start on port ${port}. See /tmp/fox-server-${port}.log" >&2
    exit 1
  fi
}

# ─── Permission Auto-Approver ────────────────────────────────────────────

auto_approve_loop() {
  local server_url="$1"
  local sandbox_dir="$2"
  while true; do
    # 1. Auto-approve tool permissions
    local pending
    pending=$(curl -m 2 -sf -H "x-kilo-directory: ${sandbox_dir}" "${server_url}/permission" 2>/dev/null || echo "[]")
    local req_ids
    req_ids=$(echo "$pending" | jq -r 'if type == "array" then .[].id // empty else empty end' 2>/dev/null || true)
    for rid in $req_ids; do
      if [ -n "$rid" ]; then
        curl -m 2 -sf -H "x-kilo-directory: ${sandbox_dir}" -X POST "${server_url}/permission/${rid}/reply" \
          -H "Content-Type: application/json" \
          -d '{"reply":"always"}' >/dev/null 2>&1 || true
      fi
    done

    # 2. Auto-dismiss interactive UI suggestions
    local suggestions
    suggestions=$(curl -m 2 -sf -H "x-kilo-directory: ${sandbox_dir}" "${server_url}/suggestion" 2>/dev/null || echo "[]")
    local sug_ids
    sug_ids=$(echo "$suggestions" | jq -r 'if type == "array" then .[].id // empty else empty end' 2>/dev/null || true)
    for sid in $sug_ids; do
      if [ -n "$sid" ]; then
        curl -m 2 -sf -H "x-kilo-directory: ${sandbox_dir}" -X POST "${server_url}/suggestion/${sid}/dismiss" >/dev/null 2>&1 || true
      fi
    done

    sleep 0.5
  done
}

# ─── Sandbox Scaffolding ─────────────────────────────────────────────────

get_task_dir() {
  case "$1" in
    1) echo "task-1-job-queue" ;;
    2) echo "task-2-refactor" ;;
    3) echo "task-3-debug" ;;
    *) echo "task-$1" ;;
  esac
}

scaffold_sandbox() {
  local mode="$1"
  local task_id="$2"
  local task_name
  task_name=$(get_task_dir "$task_id")
  local sandbox="${EVAL_BASE_DIR}/${mode}/task-${task_id}"

  rm -rf "$sandbox"
  mkdir -p "$sandbox"

  case "$task_id" in
    1)
      cp "${STRESS_DIR}/${task_name}/package.json" "$sandbox/"
      ;;
    2)
      cp "${STRESS_DIR}/${task_name}/package.json" "$sandbox/"
      cp "${STRESS_DIR}/${task_name}/cart_garbage.ts" "$sandbox/"
      cp "${STRESS_DIR}/${task_name}/test_regression.ts" "$sandbox/"
      ;;
    3)
      cp "${STRESS_DIR}/${task_name}/package.json" "$sandbox/"
      cp "${STRESS_DIR}/${task_name}/rate_limiter.ts" "$sandbox/"
      cp "${STRESS_DIR}/${task_name}/test_rate_limiter.ts" "$sandbox/"
      ;;
  esac

  # Initialize clean git tracking in sandbox
  (cd "$sandbox" && GIT_TERMINAL_PROMPT=0 git init -q && git config user.email "eval@fox.local" && git config user.name "Fox Evaluator" && git add . && git commit -q -m "Initial commit")
  echo "$sandbox"
}

# ─── Task Execution Driver ───────────────────────────────────────────────

run_agent_task() {
  local mode="$1"
  local task_id="$2"
  local server_url
  if [ "$mode" = "fox" ]; then
    server_url="$FOX_URL"
  else
    server_url="$KILO_URL"
  fi

  echo ""
  echo "─────────────────────────────────────────────────────────────────"
  echo " Running Task ${task_id} | Agent: ${mode^^} | Server: ${server_url}"
  echo "─────────────────────────────────────────────────────────────────"

  local sandbox
  sandbox=$(scaffold_sandbox "$mode" "$task_id")
  echo "▶ Sandbox: ${sandbox}"

  local task_dir
  task_dir=$(get_task_dir "$task_id")
  local prompt_file="${STRESS_DIR}/${task_dir}/prompt.txt"
  local prompt
  prompt=$(cat "$prompt_file")

  # 1. Create Session
  local curl_opts=(-sf -H "x-kilo-directory: ${sandbox}")
  local s_resp
  s_resp=$(curl "${curl_opts[@]}" -X POST "${server_url}/session" \
    -H "Content-Type: application/json" \
    -d '{}' 2>/dev/null) || {
    echo "ERROR: Failed to create session on ${server_url}" >&2
    return 1
  }
  local sid
  sid=$(echo "$s_resp" | jq -r '.id // empty')
  echo "▶ Session ID: ${sid}"

  # 2. Allow-everything + deny interactive prompts
  curl "${curl_opts[@]}" -X POST "${server_url}/permission/allow-everything" \
    -H "Content-Type: application/json" \
    -d "{\"enable\": true, \"sessionID\": \"${sid}\"}" > /dev/null 2>&1 || true

  for perm in suggest question plan_enter plan_exit; do
    curl "${curl_opts[@]}" -X POST "${server_url}/permission" \
      -H "Content-Type: application/json" \
      -d "{\"sessionID\": \"${sid}\", \"permission\": \"${perm}\", \"pattern\": \"*\", \"action\": \"deny\"}" > /dev/null 2>&1 || true
  done

  # 3. Start auto-approver background process
  auto_approve_loop "$server_url" "$sandbox" &
  APPROVER_PID=$!

  # 4. Dispatch Prompt
  local t_start
  t_start=$(date +%s%N)

  echo "▶ Dispatching prompt to agent..."
  curl "${curl_opts[@]}" -X POST "${server_url}/session/${sid}/message" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg p "$prompt" '{parts: [{type: "text", text: $p}]}')" \
    > /dev/null 2>&1 &
  local msg_pid=$!

  echo "▶ Agent dispatched. Waiting for autonomous completion..."

  # 5. Wait for assistant completion
  local timeout="${TASK_TIMEOUT_SEC:-600}"
  local elapsed=0
  local completed=false

  while [ $elapsed -lt $timeout ]; do
    local msgs
    msgs=$(curl "${curl_opts[@]}" "${server_url}/session/${sid}/message" 2>/dev/null || echo "[]")
    local last_role last_completed
    last_role=$(echo "$msgs" | jq -r 'if type == "array" and length > 0 then .[-1].info.role // "none" else "none" end' 2>/dev/null)
    last_completed=$(echo "$msgs" | jq -r 'if type == "array" and length > 0 then .[-1].info.time.completed // "null" else "null" end' 2>/dev/null)

    if [ "$last_role" = "assistant" ] && [ "$last_completed" != "null" ]; then
      completed=true
      break
    fi
    sleep 3
    elapsed=$((elapsed + 3))
    printf "."
  done
  echo ""

  local t_end
  t_end=$(date +%s%N)
  local duration_ms=$(( (t_end - t_start) / 1000000 ))

  wait "$msg_pid" 2>/dev/null || true

  kill "$APPROVER_PID" 2>/dev/null || true
  wait "$APPROVER_PID" 2>/dev/null || true
  APPROVER_PID=""

  if [ "$completed" = false ]; then
    echo "⚠ Warning: Agent timed out after ${timeout}s"
  else
    echo "✔ Agent completed task autonomously in $(( duration_ms / 1000 ))s"
  fi

  # 6. Retrieve Session Telemetry
  local session_info
  session_info=$(curl "${curl_opts[@]}" "${server_url}/session/${sid}" 2>/dev/null || echo "{}")
  local input_tokens output_tokens reasoning_tokens cache_read
  input_tokens=$(echo "$session_info" | jq -r '.tokens.input // 0')
  output_tokens=$(echo "$session_info" | jq -r '.tokens.output // 0')
  reasoning_tokens=$(echo "$session_info" | jq -r '.tokens.reasoning // 0')
  cache_read=$(echo "$session_info" | jq -r '.tokens.cache.read // 0')

  # Count turns (assistant messages)
  local turn_count
  turn_count=$(curl "${curl_opts[@]}" "${server_url}/session/${sid}/message" 2>/dev/null | jq '[.[] | select(.info.role == "assistant")] | length' 2>/dev/null || echo 0)

  # 7. Functional Validation
  local test_passed=false
  local test_output=""
  local extra_output=""

  case "$task_id" in
    1)
      if (cd "$sandbox" && timeout 30s bun test test/queue.test.ts > /tmp/t1_test.log 2>&1); then
        test_passed=true
      fi
      test_output=$(cat /tmp/t1_test.log 2>/dev/null || echo "No test output")
      if (cd "$sandbox" && timeout 15s bun run src/index.ts > /tmp/t1_demo.log 2>&1); then
        extra_output=$(cat /tmp/t1_demo.log 2>/dev/null | tail -n 10)
      fi
      ;;
    2)
      if (cd "$sandbox" && timeout 30s bun test_regression.ts > /tmp/t2_test.log 2>&1); then
        test_passed=true
      fi
      test_output=$(cat /tmp/t2_test.log 2>/dev/null || echo "No test output")
      # Check comment count and any types
      local comment_lines
      comment_lines=$(grep -E '^\s*(//|\*|/\*)' "${sandbox}/cart_garbage.ts" 2>/dev/null | wc -l || echo 0)
      extra_output="comment_lines=${comment_lines}"
      ;;
    3)
      if (cd "$sandbox" && timeout 30s bun test_rate_limiter.ts > /tmp/t3_test.log 2>&1); then
        test_passed=true
      fi
      test_output=$(cat /tmp/t3_test.log 2>/dev/null || echo "No test output")
      ;;
  esac

  echo "▶ Test Result: $([ "$test_passed" = true ] && echo "PASS [100%]" || echo "FAIL")"
  echo "▶ Telemetry: in=${input_tokens}, out=${output_tokens}, cache_read=${cache_read}, turns=${turn_count}, time=${duration_ms}ms"

  # Save Task Result JSON
  local res_file="${EVAL_BASE_DIR}/${mode}/task-${task_id}-result.json"
  mkdir -p "$(dirname "$res_file")"
  jq -n \
    --arg mode "$mode" \
    --argjson task "$task_id" \
    --arg sid "$sid" \
    --argjson passed "$test_passed" \
    --argjson input_tokens "$input_tokens" \
    --argjson output_tokens "$output_tokens" \
    --argjson reasoning_tokens "$reasoning_tokens" \
    --argjson cache_read "$cache_read" \
    --argjson turns "$turn_count" \
    --argjson duration_ms "$duration_ms" \
    --arg test_output "$test_output" \
    --arg extra "$extra_output" \
    '{
      mode: $mode,
      task: $task,
      sessionId: $sid,
      passed: $passed,
      inputTokens: $input_tokens,
      outputTokens: $output_tokens,
      reasoningTokens: $reasoning_tokens,
      cacheRead: $cache_read,
      turns: $turns,
      durationMs: $duration_ms,
      testOutput: $test_output,
      extra: $extra
    }' > "$res_file"

  echo "Saved result to ${res_file}"
}

# ─── Report Generator ────────────────────────────────────────────────────

generate_report() {
  echo ""
  echo "═════════════════════════════════════════════════════════════════"
  echo "   REAL-WORLD AUTONOMOUS A/B BENCHMARK SCORECARD: FOX VS KILO    "
  echo "═════════════════════════════════════════════════════════════════"

  python3 -c "
import json, os, glob

eval_dir = '${EVAL_BASE_DIR}'
tasks = [1, 2, 3]
task_names = {
    1: 'Task 1: App Gen & Self-Debug (Job Queue Engine)',
    2: 'Task 2: Refactor & Comments (Pricing Matrix)',
    3: 'Task 3: Bug Diagnosis & Fix (Rate Limiter)'
}

kilo_total_in = 0
kilo_total_out = 0
kilo_total_cache = 0
kilo_total_ms = 0
kilo_total_turns = 0

fox_total_in = 0
fox_total_out = 0
fox_total_cache = 0
fox_total_ms = 0
fox_total_turns = 0

print(f'| {\"Task\":<42} | {\"Kilo Pass\":<9} | {\"Fox Pass\":<9} | {\"Kilo In\":<8} | {\"Fox In\":<8} | {\"In Savings\":<10} | {\"Turns (K/F)\":<11} |')
print('|' + '-'*44 + '|' + '-'*11 + '|' + '-'*11 + '|' + '-'*10 + '|' + '-'*10 + '|' + '-'*12 + '|' + '-'*13 + '|')

for t in tasks:
    kf = os.path.join(eval_dir, 'kilo', f'task-{t}-result.json')
    ff = os.path.join(eval_dir, 'fox', f'task-{t}-result.json')
    k = json.load(open(kf)) if os.path.exists(kf) else None
    f = json.load(open(ff)) if os.path.exists(ff) else None

    k_pass = '✔ PASS' if (k and k.get('passed')) else ('✗ FAIL' if k else 'N/A')
    f_pass = '✔ PASS' if (f and f.get('passed')) else ('✗ FAIL' if f else 'N/A')

    kin = k.get('inputTokens', 0) if k else 0
    fin = f.get('inputTokens', 0) if f else 0
    kilo_total_in += kin
    fox_total_in += fin

    kout = k.get('outputTokens', 0) if k else 0
    fout = f.get('outputTokens', 0) if f else 0
    kilo_total_out += kout
    fox_total_out += fout

    kcache = k.get('cacheRead', 0) if k else 0
    fcache = f.get('cacheRead', 0) if f else 0
    kilo_total_cache += kcache
    fox_total_cache += fcache

    kms = k.get('durationMs', 0) if k else 0
    fms = f.get('durationMs', 0) if f else 0
    kilo_total_ms += kms
    fox_total_ms += fms

    kturns = k.get('turns', 0) if k else 0
    fturns = f.get('turns', 0) if f else 0
    kilo_total_turns += kturns
    fox_total_turns += fturns

    savings_pct = f'{(kin - fin) / kin * 100:.1f}%' if kin > 0 else '0.0%'
    turns_str = f'{kturns} / {fturns}'

    print(f'| {task_names[t]:<42} | {k_pass:<9} | {f_pass:<9} | {kin:<8} | {fin:<8} | {savings_pct:<10} | {turns_str:<11} |')

print('|' + '='*44 + '|' + '='*11 + '|' + '='*11 + '|' + '='*10 + '|' + '='*10 + '|' + '='*12 + '|' + '='*13 + '|')
tot_savings_pct = f'{(kilo_total_in - fox_total_in) / kilo_total_in * 100:.1f}%' if kilo_total_in > 0 else '0.0%'
print(f'| {\"TOTAL SUMMARY\":<42} | {\"-\":<9} | {\"-\":<9} | {kilo_total_in:<8} | {fox_total_in:<8} | {tot_savings_pct:<10} | {kilo_total_turns}/{fox_total_turns:<9} |')
print('')
print(f'Cumulative Token Savings: {kilo_total_in - fox_total_in:,} input tokens saved ({tot_savings_pct})')
print(f'Total Execution Time: Kilo = {kilo_total_ms/1000:.1f}s | Fox = {fox_total_ms/1000:.1f}s')
print(f'Total Cache Reads: Kilo = {kilo_total_cache:,} | Fox = {fox_total_cache:,}')
"
  echo "═════════════════════════════════════════════════════════════════"
}

# ─── Main Dispatch ───────────────────────────────────────────────────────

cmd="${1:---all}"
target_task="${2:-all}"

case "$cmd" in
  --task)
    task_num="$2"
    ensure_server kilo
    run_agent_task kilo "$task_num"
    ensure_server fox
    run_agent_task fox "$task_num"
    generate_report
    ;;
  --fox-task)
    task_num="$2"
    ensure_server fox
    run_agent_task fox "$task_num"
    ;;
  --kilo-task)
    task_num="$2"
    ensure_server kilo
    run_agent_task kilo "$task_num"
    ;;
  --kilo)
    ensure_server kilo
    for t in 1 2 3; do
      run_agent_task kilo "$t"
    done
    ;;
  --fox)
    ensure_server fox
    for t in 1 2 3; do
      run_agent_task fox "$t"
    done
    ;;
  --report)
    generate_report
    ;;
  --all)
    echo "Starting Autonomous Real-World A/B Showdown: Fox vs Kilo..."
    ensure_server kilo
    for t in 1 2 3; do
      run_agent_task kilo "$t"
    done
    ensure_server fox
    for t in 1 2 3; do
      run_agent_task fox "$t"
    done
    generate_report
    ;;
  *)
    echo "Usage: $0 [--all|--fox|--kilo|--task <N>|--fox-task <N>|--kilo-task <N>|--report]"
    exit 1
    ;;
esac
