#!/usr/bin/env bash
# fork-showdown-kilo-vs-unoptimized-fox.sh
# Head-to-head comparison of:
#   1. Pristine Kilo Code CLI (Original fork commit 4cdca9b) on port 4097
#   2. Fox Code CLI (UNOPTIMIZED: FOX_EXPERIMENTAL_COMPRESS=false) on port 4098
#
# Tests the hypothesis: "Since Fox is a fork, will unoptimized Fox behave the exact same as Kilo?"

export PATH="$HOME/.local/bin:$PATH"
export OPENAI_BASE_URL="${OPENAI_BASE_URL:-http://localhost:8000/v1}"
export OPENAI_API_KEY="${OPENAI_API_KEY:-local-dev}"
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STRESS_DIR="${SCRIPT_DIR}/stress/realworld"
EVAL_BASE_DIR="/tmp/fox-eval"
PRISTINE_DIR="/tmp/kilo-pristine"

KILO_PORT=4097
FOX_UNOPT_PORT=4098

KILO_URL="http://127.0.0.1:${KILO_PORT}"
FOX_UNOPT_URL="http://127.0.0.1:${FOX_UNOPT_PORT}"

KILO_PID=""
FOX_UNOPT_PID=""
APPROVER_PID=""

cleanup() {
  if [ -n "$APPROVER_PID" ]; then
    kill "$APPROVER_PID" 2>/dev/null || true
    wait "$APPROVER_PID" 2>/dev/null || true
    APPROVER_PID=""
  fi
  if [ -n "$KILO_PID" ]; then
    echo "Stopping Pristine Kilo server (PID $KILO_PID)..."
    kill "$KILO_PID" 2>/dev/null || true
    wait "$KILO_PID" 2>/dev/null || true
    KILO_PID=""
  fi
  if [ -n "$FOX_UNOPT_PID" ]; then
    echo "Stopping Fox Unoptimized server (PID $FOX_UNOPT_PID)..."
    kill "$FOX_UNOPT_PID" 2>/dev/null || true
    wait "$FOX_UNOPT_PID" 2>/dev/null || true
    FOX_UNOPT_PID=""
  fi
  fuser -k "${KILO_PORT}/tcp" 2>/dev/null || true
  fuser -k "${FOX_UNOPT_PORT}/tcp" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ─── Server Management ───────────────────────────────────────────────────

ensure_pristine_kilo() {
  if curl -m 2 -sf "${KILO_URL}/session" >/dev/null 2>&1; then
    echo "✔ Pristine Kilo server already ready at ${KILO_URL}"
    return 0
  fi

  echo "▶ Starting Pristine Kilo server (commit 4cdca9b) on port ${KILO_PORT}..."
  mkdir -p "$PRISTINE_DIR"
  if [ ! -d "${PRISTINE_DIR}/node_modules" ]; then
    ln -s "${ROOT_DIR}/node_modules" "${PRISTINE_DIR}/node_modules"
  fi

  (
    cd "$PRISTINE_DIR"
    FOX_REQUEST_TIMEOUT_MS="${FOX_REQUEST_TIMEOUT_MS:-180000}" \
    bun run ./src/index.ts serve --port "$KILO_PORT" > "/tmp/pristine-kilo-server-${KILO_PORT}.log" 2>&1
  ) &
  KILO_PID=$!

  local attempts=0
  while [ $attempts -lt 30 ]; do
    if curl -m 2 -sf "${KILO_URL}/session" >/dev/null 2>&1; then
      echo "✔ Pristine Kilo server started on port ${KILO_PORT} (PID: ${KILO_PID})"
      return 0
    fi
    sleep 0.5
    attempts=$((attempts + 1))
  done
  echo "ERROR: Pristine Kilo server failed to start on port ${KILO_PORT}. See /tmp/pristine-kilo-server-${KILO_PORT}.log" >&2
  exit 1
}

ensure_fox_unoptimized() {
  if curl -m 2 -sf "${FOX_UNOPT_URL}/session" >/dev/null 2>&1; then
    echo "✔ Fox Unoptimized server already ready at ${FOX_UNOPT_URL}"
    return 0
  fi

  echo "▶ Starting Fox Unoptimized server (FOX_EXPERIMENTAL_COMPRESS=false) on port ${FOX_UNOPT_PORT}..."
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
    bun run ./src/index.ts serve --port "$FOX_UNOPT_PORT" > "/tmp/fox-unopt-server-${FOX_UNOPT_PORT}.log" 2>&1
  ) &
  FOX_UNOPT_PID=$!

  local attempts=0
  while [ $attempts -lt 30 ]; do
    if curl -m 2 -sf "${FOX_UNOPT_URL}/session" >/dev/null 2>&1; then
      echo "✔ Fox Unoptimized server started on port ${FOX_UNOPT_PORT} (PID: ${FOX_UNOPT_PID})"
      return 0
    fi
    sleep 0.5
    attempts=$((attempts + 1))
  done
  echo "ERROR: Fox Unoptimized server failed to start on port ${FOX_UNOPT_PORT}. See /tmp/fox-unopt-server-${FOX_UNOPT_PORT}.log" >&2
  exit 1
}

# ─── Permission Auto-Approver ────────────────────────────────────────────

auto_approve_loop() {
  local server_url="$1"
  local sandbox_dir="$2"
  while true; do
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

  (cd "$sandbox" && GIT_TERMINAL_PROMPT=0 git init -q && git config user.email "eval@fox.local" && git config user.name "Evaluator" && git add . && git commit -q -m "Initial commit")
  echo "$sandbox"
}

# ─── Task Execution Driver ───────────────────────────────────────────────

run_task() {
  local mode="$1" # "pristine-kilo" or "fox-unoptimized"
  local task_id="$2"
  local server_url
  if [ "$mode" = "pristine-kilo" ]; then
    server_url="$KILO_URL"
  else
    server_url="$FOX_UNOPT_URL"
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
  local prompt
  prompt=$(cat "${STRESS_DIR}/${task_dir}/prompt.txt")

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

  curl "${curl_opts[@]}" -X POST "${server_url}/permission/allow-everything" \
    -H "Content-Type: application/json" \
    -d "{\"enable\": true, \"sessionID\": \"${sid}\"}" > /dev/null 2>&1 || true

  for perm in suggest question plan_enter plan_exit; do
    curl "${curl_opts[@]}" -X POST "${server_url}/permission" \
      -H "Content-Type: application/json" \
      -d "{\"sessionID\": \"${sid}\", \"permission\": \"${perm}\", \"pattern\": \"*\", \"action\": \"deny\"}" > /dev/null 2>&1 || true
  done

  auto_approve_loop "$server_url" "$sandbox" &
  APPROVER_PID=$!

  local t_start
  t_start=$(date +%s%N)

  echo "▶ Dispatching prompt to agent..."
  curl "${curl_opts[@]}" -X POST "${server_url}/session/${sid}/message" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg p "$prompt" '{parts: [{type: "text", text: $p}]}')" \
    > /dev/null 2>&1 &
  local msg_pid=$!

  echo "▶ Agent dispatched. Waiting for autonomous completion..."

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

  local session_info
  session_info=$(curl "${curl_opts[@]}" "${server_url}/session/${sid}" 2>/dev/null || echo "{}")
  local input_tokens output_tokens reasoning_tokens cache_read
  input_tokens=$(echo "$session_info" | jq -r '.tokens.input // 0')
  output_tokens=$(echo "$session_info" | jq -r '.tokens.output // 0')
  reasoning_tokens=$(echo "$session_info" | jq -r '.tokens.reasoning // 0')
  cache_read=$(echo "$session_info" | jq -r '.tokens.cache.read // 0')

  local turn_count
  turn_count=$(curl "${curl_opts[@]}" "${server_url}/session/${sid}/message" 2>/dev/null | jq '[.[] | select(.info.role == "assistant")] | length' 2>/dev/null || echo 0)

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
  python3 -c "
import json, os

eval_dir = '${EVAL_BASE_DIR}'
tasks = [1, 2, 3]
task_names = {
    1: 'Task 1: App Gen & Self-Debug (Job Queue)',
    2: 'Task 2: Refactor & Comments (Pricing Matrix)',
    3: 'Task 3: Bug Diagnosis & Fix (Rate Limiter)'
}

print('')
print('═════════════════════════════════════════════════════════════════════════════════════════')
print('   FORK A/B BENCHMARK: PRISTINE KILO (4cdca9b) vs FOX UNOPTIMIZED (COMPRESS=false)       ')
print('═════════════════════════════════════════════════════════════════════════════════════════')
print(f'| {\"Task\":<40} | {\"Kilo Pass\":<9} | {\"FoxUnopt Pass\":<14} | {\"Kilo In\":<8} | {\"FoxUnopt In\":<12} | {\"Turns (K/F)\":<11} |')
print('|' + '-'*42 + '|' + '-'*11 + '|' + '-'*16 + '|' + '-'*10 + '|' + '-'*14 + '|' + '-'*13 + '|')

k_tot_in, f_tot_in = 0, 0
k_tot_cache, f_tot_cache = 0, 0
k_tot_turns, f_tot_turns = 0, 0

for t in tasks:
    kp = os.path.join(eval_dir, 'pristine-kilo', f'task-{t}-result.json')
    fp = os.path.join(eval_dir, 'fox-unoptimized', f'task-{t}-result.json')
    
    k = json.load(open(kp)) if os.path.exists(kp) else None
    f = json.load(open(fp)) if os.path.exists(fp) else None
    
    k_pass = ('✔ PASS' if k.get('passed') else '✗ FAIL') if k else 'N/A'
    f_pass = ('✔ PASS' if f.get('passed') else '✗ FAIL') if f else 'N/A'
    
    kin = k.get('inputTokens', 0) if k else 0
    fin = f.get('inputTokens', 0) if f else 0
    k_tot_in += kin
    f_tot_in += fin
    
    k_tot_cache += k.get('cacheRead', 0) if k else 0
    f_tot_cache += f.get('cacheRead', 0) if f else 0
    
    kturns = k.get('turns', 0) if k else 0
    fturns = f.get('turns', 0) if f else 0
    k_tot_turns += kturns
    f_tot_turns += fturns
    
    turns_str = f'{kturns} / {fturns}'
    print(f'| {task_names[t]:<40} | {k_pass:<9} | {f_pass:<14} | {kin:<8} | {fin:<12} | {turns_str:<11} |')

print('|' + '='*42 + '|' + '='*11 + '|' + '='*16 + '|' + '='*10 + '|' + '='*14 + '|' + '='*13 + '|')
print(f'| {\"TOTAL SUMMARY\":<40} | {\"-\":<9} | {\"-\":<14} | {k_tot_in:<8} | {f_tot_in:<12} | {k_tot_turns}/{f_tot_turns:<9} |')
print('')
print(f'Total Cache Reads: Pristine Kilo = {k_tot_cache:,} | Fox Unoptimized = {f_tot_cache:,}')
print('═════════════════════════════════════════════════════════════════════════════════════════')
"
}

# ─── Main Dispatch ───────────────────────────────────────────────────────

cmd="${1:---task}"
target_task="${2:-2}"

case "$cmd" in
  --task)
    ensure_pristine_kilo
    run_task pristine-kilo "$target_task"
    ensure_fox_unoptimized
    run_task fox-unoptimized "$target_task"
    generate_report
    ;;
  --all)
    ensure_pristine_kilo
    for t in 2 3 1; do
      run_task pristine-kilo "$t"
    done
    ensure_fox_unoptimized
    for t in 2 3 1; do
      run_task fox-unoptimized "$t"
    done
    generate_report
    ;;
  --report)
    generate_report
    ;;
  *)
    echo "Usage: $0 [--task <N>|--all|--report]"
    exit 1
    ;;
esac
