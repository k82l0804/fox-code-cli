#!/usr/bin/env bash
# competitor-eval.sh — Automated Competitor Agent Benchmark Runner
# Evaluates external coding agents (Aider, Goose, etc.) against Fox real-world SWE tasks.
#
# Tasks:
#   1. App Generation & Self-Debug: Task Queue & Worker Engine (queue.ts + tests + demo)
#   2. Code Refactor & Regression: E-Commerce Pricing Matrix (clean code + inline comments + tests)
#   3. Bug Diagnosis & Repair: Sliding Window Rate Limiter (diagnose failing tests + surgical fix)
#
# Usage:
#   ./tools/competitor-eval.sh --agent aider --task 3
#   ./tools/competitor-eval.sh --agent aider --all
#   ./tools/competitor-eval.sh --report
#
export PATH="$HOME/.local/bin:$PATH"
export OPENAI_BASE_URL="${OPENAI_BASE_URL:-http://localhost:8000/v1}"
export OPENAI_API_KEY="${OPENAI_API_KEY:-local-dev}"
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE_ROOT="$(cd "$ROOT_DIR/.." && pwd)"
STRESS_DIR="${SCRIPT_DIR}/stress/realworld"
EVAL_BASE_DIR="/tmp/fox-eval"

AIDER_BIN="${WORKSPACE_ROOT}/ext-repo/agent-cli/aider/.venv/bin/aider"
GOOSE_BIN="${GOOSE_BIN:-$HOME/.local/bin/goose}"
MODEL_NAME="${MODEL_NAME:-openai/gpt-4o}"
TASK_TIMEOUT="${TASK_TIMEOUT:-180}"

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
  local agent="$1"
  local task_id="$2"
  local task_name
  task_name=$(get_task_dir "$task_id")
  local sandbox="${EVAL_BASE_DIR}/${agent}/task-${task_id}"

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
  (
    cd "$sandbox"
    GIT_TERMINAL_PROMPT=0 git init -q
    git config user.email "eval@competitor.local"
    git config user.name "Competitor Evaluator"
    git add .
    git commit -q -m "Initial commit"
  )
  echo "$sandbox"
}

# ─── Agent Execution Driver ──────────────────────────────────────────────

run_competitor_task() {
  local agent="$1"
  local task_id="$2"

  echo ""
  echo "═════════════════════════════════════════════════════════════════"
  echo " Running Task ${task_id} | Agent: ${agent^^} | Model: ${MODEL_NAME}"
  echo "═════════════════════════════════════════════════════════════════"

  local sandbox
  sandbox=$(scaffold_sandbox "$agent" "$task_id")
  echo "▶ Sandbox: ${sandbox}"

  local task_dir
  task_dir=$(get_task_dir "$task_id")
  local prompt_file="${STRESS_DIR}/${task_dir}/prompt.txt"
  local prompt
  prompt=$(cat "$prompt_file")

  local eval_log="${EVAL_BASE_DIR}/${agent}/task-${task_id}.log"
  mkdir -p "$(dirname "$eval_log")"

  local t_start
  t_start=$(date +%s%N)

  echo "▶ Dispatching prompt to ${agent^^} (Timeout: ${TASK_TIMEOUT}s)..."

  local exit_code=0
  case "$agent" in
    aider)
      if [ ! -x "$AIDER_BIN" ]; then
        echo "ERROR: Aider binary not found at $AIDER_BIN" >&2
        return 1
      fi

      local a_model="openai/${MODEL_NAME#openai/}"
      (
        cd "$sandbox"
        export OPENAI_API_BASE="$OPENAI_BASE_URL"
        export OPENAI_API_KEY="$OPENAI_API_KEY"
        timeout "${TASK_TIMEOUT}s" "$AIDER_BIN" \
          --model "$a_model" \
          --message "$prompt" \
          --yes-always \
          --no-git-commit-verify \
          --no-analytics \
          --no-check-update \
          --no-show-release-notes \
          --no-browser \
          --no-pretty \
          --exit < /dev/null > "$eval_log" 2>&1
      ) || exit_code=$?
      ;;
    goose)
      if [ ! -x "$GOOSE_BIN" ]; then
        echo "ERROR: Goose binary not found at $GOOSE_BIN" >&2
        return 1
      fi

      local g_model="${MODEL_NAME#openai/}"
      (
        cd "$sandbox"
        export GOOSE_PROVIDER=openai
        export OPENAI_BASE_URL="$OPENAI_BASE_URL"
        export OPENAI_API_KEY="$OPENAI_API_KEY"
        timeout "${TASK_TIMEOUT}s" "$GOOSE_BIN" run \
          --no-session \
          --stats \
          --provider openai \
          --model "$g_model" \
          --text "$prompt" < /dev/null > "$eval_log" 2>&1
      ) || exit_code=$?
      ;;
    fox)
      local fox_port=4096
      local fox_url="http://127.0.0.1:${fox_port}"
      if ! curl -m 2 -sf "${fox_url}/session" >/dev/null 2>&1; then
        echo "▶ Starting background Fox server on port ${fox_port}..."
        (
          cd "$ROOT_DIR"
          export OPENAI_BASE_URL="$OPENAI_BASE_URL"
          export OPENAI_API_KEY="$OPENAI_API_KEY"
          FOX_EXPERIMENTAL_COMPRESS=true \
          nohup bun run ./src/index.ts serve --port "$fox_port" < /dev/null > "/tmp/fox-server-${fox_port}.log" 2>&1 &
        )
        sleep 3
      fi

      local curl_opts=(-sf -H "x-kilo-directory: ${sandbox}")
      local s_resp
      s_resp=$(curl "${curl_opts[@]}" -X POST "${fox_url}/session" -H "Content-Type: application/json" -d '{}' 2>/dev/null)
      local sid
      sid=$(echo "$s_resp" | jq -r '.id // empty')

      if [ -z "$sid" ]; then
        echo "ERROR: Failed to create session on Fox server" >&2
        return 1
      fi

      curl "${curl_opts[@]}" -X POST "${fox_url}/permission/allow-everything" \
        -H "Content-Type: application/json" \
        -d "{\"enable\": true, \"sessionID\": \"${sid}\"}" >/dev/null 2>&1 || true

      for perm in suggest question plan_enter plan_exit; do
        curl "${curl_opts[@]}" -X POST "${fox_url}/permission" \
          -H "Content-Type: application/json" \
          -d "{\"sessionID\": \"${sid}\", \"permission\": \"${perm}\", \"pattern\": \"*\", \"action\": \"deny\"}" >/dev/null 2>&1 || true
      done

      # Background auto-approver
      local app_pid=""
      (
        while true; do
          local pending
          pending=$(curl -m 2 -sf -H "x-kilo-directory: ${sandbox}" "${fox_url}/permission" 2>/dev/null || echo "[]")
          local req_ids
          req_ids=$(echo "$pending" | jq -r 'if type == "array" then .[].id // empty else empty end' 2>/dev/null || true)
          for rid in $req_ids; do
            if [ -n "$rid" ]; then
              curl -m 2 -sf -H "x-kilo-directory: ${sandbox}" -X POST "${fox_url}/permission/${rid}/reply" \
                -H "Content-Type: application/json" -d '{"reply":"always"}' >/dev/null 2>&1 || true
            fi
          done
          sleep 0.5
        done
      ) &
      app_pid=$!

      local g_model="${MODEL_NAME#openai/}"
      g_model="${g_model#local/}"
      if [ "$g_model" = "gemma-4" ]; then
        g_model="gemma"
      fi
      local provider_id="openai"
      if curl -sf "${fox_url}/provider" | jq -e '.connected | index("local")' >/dev/null 2>&1; then
        provider_id="local"
      fi

      curl -s -H "x-kilo-directory: ${sandbox}" -X POST "${fox_url}/session/${sid}/message" \
        -H "Content-Type: application/json" \
        -d "$(jq -n --arg p "$prompt" --arg m "$g_model" --arg prov "$provider_id" '{model: {providerID: $prov, modelID: $m}, parts: [{type: "text", text: $p}]}')" \
        > "$eval_log" 2>&1 &
      local msg_pid=$!

      local elapsed=0
      local completed=false
      while [ $elapsed -lt $TASK_TIMEOUT ]; do
        if ! kill -0 "$msg_pid" 2>/dev/null; then
          wait "$msg_pid"
          local curl_exit=$?
          if [ $curl_exit -ne 0 ] || grep -q "UnknownError\|APIError" "$eval_log" 2>/dev/null; then
            completed=true
            break
          fi
          completed=true
          break
        fi

        local msgs
        msgs=$(curl "${curl_opts[@]}" "${fox_url}/session/${sid}/message" 2>/dev/null || echo "[]")
        local last_role last_completed
        last_role=$(echo "$msgs" | jq -r 'if type == "array" and length > 0 then .[-1].info.role // "none" else "none" end' 2>/dev/null)
        last_completed=$(echo "$msgs" | jq -r 'if type == "array" and length > 0 then .[-1].info.time.completed // "null" else "null" end' 2>/dev/null)

        if [ "$last_role" = "assistant" ] && [ "$last_completed" != "null" ]; then
          completed=true
          break
        fi
        sleep 2
        elapsed=$((elapsed + 2))
      done

      kill "$app_pid" 2>/dev/null || true
      wait "$msg_pid" 2>/dev/null || true

      if [ "$completed" = false ]; then
        exit_code=124
      fi
      ;;
    *)
      echo "ERROR: Unsupported agent: $agent" >&2
      return 1
      ;;
  esac

  local t_end
  t_end=$(date +%s%N)
  local duration_ms=$(( (t_end - t_start) / 1000000 ))
  local duration_s=$(( duration_ms / 1000 ))

  if [ $exit_code -eq 124 ]; then
    echo "⚠ Warning: ${agent^^} timed out after ${TASK_TIMEOUT}s"
  elif [ $exit_code -ne 0 ]; then
    echo "⚠ Process exited with code ${exit_code}. See ${eval_log}"
  else
    echo "✔ ${agent^^} finished execution in ${duration_s}s"
  fi

  # ─── Functional Validation ─────────────────────────────────────────────
  local test_passed=false
  local test_log="${EVAL_BASE_DIR}/${agent}/task-${task_id}-test.log"

  case "$task_id" in
    1)
      if (cd "$sandbox" && timeout 30s bun test test/queue.test.ts > "$test_log" 2>&1); then
        test_passed=true
      fi
      ;;
    2)
      if (cd "$sandbox" && timeout 30s bun test_regression.ts > "$test_log" 2>&1); then
        test_passed=true
      fi
      ;;
    3)
      if (cd "$sandbox" && timeout 30s bun test_rate_limiter.ts > "$test_log" 2>&1); then
        test_passed=true
      fi
      ;;
  esac

  local test_status
  if [ "$test_passed" = true ]; then
    test_status="PASS [100%]"
    echo "▶ Verification: 🟢 PASS (All test assertions verified)"
  else
    test_status="FAIL"
    echo "▶ Verification: 🔴 FAIL"
    if [ -f "$test_log" ]; then
      echo "--- Test Output Snippet ---"
      tail -n 12 "$test_log"
      echo "---------------------------"
    fi
  fi

  # ─── Git Diff Inspection ───────────────────────────────────────────────
  local diff_stat
  diff_stat=$(cd "$sandbox" && git diff --stat HEAD~1 HEAD 2>/dev/null || git diff --stat 2>/dev/null || echo "no changes")
  echo "▶ Git Diff Stat:"
  echo "$diff_stat"

  # ─── Telemetry Extraction ──────────────────────────────────────────────
  local tokens_sent=0
  local tokens_recv=0
  if [ -f "$eval_log" ]; then
    # Parse aider token usage summaries if present
    local tok_line
    tok_line=$(grep -i "tokens" "$eval_log" | tail -n 5 || true)
  fi

  # Save JSON Results
  local res_file="${EVAL_BASE_DIR}/${agent}/task-${task_id}-result.json"
  jq -n \
    --arg agent "$agent" \
    --argjson task "$task_id" \
    --argjson passed "$test_passed" \
    --argjson duration_ms "$duration_ms" \
    --arg diff_stat "$diff_stat" \
    '{
      agent: $agent,
      task: $task,
      passed: $passed,
      duration_ms: $duration_ms,
      diff_stat: $diff_stat
    }' > "$res_file"

  echo "▶ Saved result: ${res_file}"
}

# ─── CLI Dispatcher ──────────────────────────────────────────────────────

AGENT="aider"
TASK=""
ALL=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent) AGENT="$2"; shift 2 ;;
    --task)  TASK="$2"; shift 2 ;;
    --all)   ALL=true; shift ;;
    --timeout) TASK_TIMEOUT="$2"; shift 2 ;;
    --model) MODEL_NAME="$2"; shift 2 ;;
    --help)
      echo "Usage: $0 [--agent aider|goose] [--task 1|2|3] [--all] [--timeout 180] [--model <name>]"
      exit 0
      ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [ "$ALL" = true ]; then
  for t in 3 2 1; do
    run_competitor_task "$AGENT" "$t"
  done
elif [ -n "$TASK" ]; then
  run_competitor_task "$AGENT" "$TASK"
else
  echo "Running default Task 3 (Sliding Window Rate Limiter Debug & Repair)..."
  run_competitor_task "$AGENT" 3
fi
