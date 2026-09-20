#!/usr/bin/env bash
# fox-stress.sh — Fox AI Agent Capability Stress Testing Suite ("Naughty Tests")
#
# Challenges:
#   1. The "Refactor This Garbage" Game (Code Quality & Heuristics)
#   2. The Chaos API Fuzzer (Tool Use & Error Handling)
#   3. The "Infinite Calendar Grid" (Edge-Case Logic & Timezones)
#   4. The Architectural Trade-Off Challenge (High-Level System Design)
#
# Usage:
#   ./tools/fox-stress.sh --test 1       # Run Challenge 1 (Garbage Refactor)
#   ./tools/fox-stress.sh --test 2       # Run Challenge 2 (Chaos API Fuzzer)
#   ./tools/fox-stress.sh --test 3       # Run Challenge 3 (Infinite Calendar)
#   ./tools/fox-stress.sh --test 4       # Run Challenge 4 (Architectural Trade-Off)
#   ./tools/fox-stress.sh --all          # Run all challenges sequentially
#   ./tools/fox-stress.sh --list         # List available challenges
#
export PATH="$HOME/.local/bin:$PATH"
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STRESS_DIR="${SCRIPT_DIR}/stress"

FOX_BIN="${FOX_BIN:-fox}"
FOX_SERVER="${FOX_SERVER:-http://localhost:4096}"
FOX_DIR="${FOX_DIR:-$ROOT_DIR}"

CURL_OPTS=(-sf -H "x-kilo-directory: ${FOX_DIR}")
if [ -n "${FOX_SERVER_PASSWORD:-}" ]; then
  CURL_OPTS+=(-H "Authorization: Bearer ${FOX_SERVER_PASSWORD}")
fi

trap 'kill $(jobs -p) 2>/dev/null || true' EXIT INT TERM

check_server() {
  if ! curl "${CURL_OPTS[@]}" "${FOX_SERVER}/session" > /dev/null 2>&1; then
    echo "ERROR: Fox server not reachable at ${FOX_SERVER}"
    echo "Please ensure 'fox serve' is running."
    exit 1
  fi
}

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
    curl "${CURL_OPTS[@]}" -X POST "${FOX_SERVER}/permission/allow-everything" \
      -H "Content-Type: application/json" \
      -d "{\"enable\": true, \"sessionID\": \"${sid}\"}" > /dev/null 2>&1 || true
    for perm in suggest question plan_enter plan_exit; do
      curl "${CURL_OPTS[@]}" -X POST "${FOX_SERVER}/permission" \
        -H "Content-Type: application/json" \
        -d "{\"sessionID\": \"${sid}\", \"permission\": \"${perm}\", \"pattern\": \"*\", \"action\": \"deny\"}" > /dev/null 2>&1 || true
    done
  fi
  echo "$sid"
}

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

send_prompt() {
  local session_id="$1"
  local prompt="$2"
  curl "${CURL_OPTS[@]}" -X POST "${FOX_SERVER}/session/${session_id}/message" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg p "$prompt" '{parts: [{type: "text", text: $p}]}')" \
    > /dev/null 2>&1
}

wait_for_completion() {
  local session_id="$1"
  local timeout="${2:-180}"
  local elapsed=0
  while [ $elapsed -lt $timeout ]; do
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

get_last_assistant_text() {
  local session_id="$1"
  local msgs
  msgs=$(curl "${CURL_OPTS[@]}" "${FOX_SERVER}/session/${session_id}/message" 2>/dev/null || echo "[]")
  echo "$msgs" | jq -r '
    if type == "array" then
      [.[-1].parts[] | select(.type == "text") | .text] | join("\n")
    else
      ""
    end
  ' 2>/dev/null
}

# ─────────────────────────────────────────────────────────────
# Challenge 1: The "Refactor This Garbage" Game
# ─────────────────────────────────────────────────────────────
run_challenge_1() {
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo " Challenge 1: The 'Refactor This Garbage' Game"
  echo " Target: Code Quality, Anti-patterns, Determinism"
  echo "═══════════════════════════════════════════════════════════════"

  local prompt_file="${STRESS_DIR}/1-garbage-refactor/prompt.txt"
  local prompt
  prompt=$(cat "$prompt_file")

  local sid
  sid=$(create_session)
  echo "▶ Session: ${sid}"
  echo "▶ Dispatching refactor challenge to agent..."

  auto_approve_loop &
  local approver_pid=$!

  send_prompt "$sid" "$prompt"
  wait_for_completion "$sid" 180

  kill "$approver_pid" 2>/dev/null || true
  wait "$approver_pid" 2>/dev/null || true

  echo "▶ Running automated regression tests against refactored code..."
  if bash -c "bun ${STRESS_DIR}/1-garbage-refactor/test_regression.ts"; then
    echo "  [PASS] Challenge 1: Logic preserved and regression tests passed!"
  else
    echo "  [FAIL] Challenge 1: Regression tests failed on refactored code."
    return 1
  fi
}

# ─────────────────────────────────────────────────────────────
# Challenge 2: The Chaos API Fuzzer
# ─────────────────────────────────────────────────────────────
run_challenge_2() {
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo " Challenge 2: The Chaos API Fuzzer"
  echo " Target: Tool Resiliency, Retry Loops, No Hallucination"
  echo "═══════════════════════════════════════════════════════════════"

  # Reset and boot mock chaos API server on port 4099
  local mock_port=4099
  echo "▶ Starting Mock Chaos API on port ${mock_port}..."
  CHAOS_PORT="$mock_port" bun run "${STRESS_DIR}/2-chaos-api/mock_server.ts" &
  local mock_pid=$!
  sleep 1

  local prompt_file="${STRESS_DIR}/2-chaos-api/prompt.txt"
  local prompt
  prompt=$(cat "$prompt_file")

  local sid
  sid=$(create_session)
  echo "▶ Session: ${sid}"
  echo "▶ Dispatching Chaos API challenge..."

  auto_approve_loop &
  local approver_pid=$!

  send_prompt "$sid" "$prompt"
  wait_for_completion "$sid" 180

  kill "$approver_pid" 2>/dev/null || true
  wait "$approver_pid" 2>/dev/null || true

  # Check mock API state
  local final_state
  final_state=$(curl -s "http://127.0.0.1:${mock_port}/state" 2>/dev/null || echo '{"callCount":0}')
  local total_calls
  total_calls=$(echo "$final_state" | jq -r '.callCount // 0')

  kill "$mock_pid" 2>/dev/null || true
  wait "$mock_pid" 2>/dev/null || true

  echo "▶ Chaos API handled ${total_calls} calls (expected: >= 3)"
  if [ "$total_calls" -ge 3 ]; then
    echo "  [PASS] Challenge 2: Agent persisted through 429 and corrupt JSON until success!"
  else
    echo "  [FAIL] Challenge 2: Agent stopped prematurely after only ${total_calls} calls."
    return 1
  fi
}

# ─────────────────────────────────────────────────────────────
# Challenge 3: The "Infinite Calendar Grid"
# ─────────────────────────────────────────────────────────────
run_challenge_3() {
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo " Challenge 3: The 'Infinite Calendar Grid'"
  echo " Target: DST Transitions, Leap Years, Complex Logic"
  echo "═══════════════════════════════════════════════════════════════"

  local prompt_file="${STRESS_DIR}/3-infinite-calendar/prompt.txt"
  local prompt
  prompt=$(cat "$prompt_file")

  local sid
  sid=$(create_session)
  echo "▶ Session: ${sid}"
  echo "▶ Dispatching Calendar recurrence challenge..."

  auto_approve_loop &
  local approver_pid=$!

  send_prompt "$sid" "$prompt"
  wait_for_completion "$sid" 180

  kill "$approver_pid" 2>/dev/null || true
  wait "$approver_pid" 2>/dev/null || true

  echo "▶ Running DST & Leap Year validation test suite..."
  if bash -c "node --experimental-strip-types ${STRESS_DIR}/3-infinite-calendar/test_calendar.ts 2>/dev/null || bun ${STRESS_DIR}/3-infinite-calendar/test_calendar.ts"; then
    echo "  [PASS] Challenge 3: Calendar recurrence accurately handles DST boundaries!"
  else
    echo "  [FAIL] Challenge 3: Calendar validation failed."
    return 1
  fi
}

# ─────────────────────────────────────────────────────────────
# Challenge 4: The Architectural Trade-Off Challenge
# ─────────────────────────────────────────────────────────────
run_challenge_4() {
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo " Challenge 4: The Architectural Trade-Off Challenge"
  echo " Target: CAP Theorem, Boundary Setting, Nuance"
  echo "═══════════════════════════════════════════════════════════════"

  local prompt_file="${STRESS_DIR}/4-tradeoff-architect/prompt.txt"
  local prompt
  prompt=$(cat "$prompt_file")

  local sid
  sid=$(create_session)
  echo "▶ Session: ${sid}"
  echo "▶ Dispatching Architectural challenge..."

  auto_approve_loop &
  local approver_pid=$!

  send_prompt "$sid" "$prompt"
  wait_for_completion "$sid" 180

  kill "$approver_pid" 2>/dev/null || true
  wait "$approver_pid" 2>/dev/null || true

  local answer
  answer=$(get_last_assistant_text "$sid")

  echo ""
  echo "════════════════ Agent Architectural Response ════════════════"
  echo "$answer"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  echo "Review the Rubric at: tools/stress/4-tradeoff-architect/rubric.md"
  echo "Checklist:"
  echo '  [ ] Identified impossible budget (50k req/s is 130B reqs/mo, >$200/mo)?'
  echo '  [ ] Invoked CAP theorem / speed of light (cannot do <50ms global linearizability)?'
  echo '  [ ] Suggested realistic compromise (e.g. partition by auction or bare metal)?'
  echo '  [ ] Avoided hallucinating that multi-region Spanner costs $190/mo?'
}

list_challenges() {
  echo "Fox AI Agent Capability Stress Suite:"
  echo "  1. --test 1 : The 'Refactor This Garbage' Game (Code Quality & Heuristics)"
  echo "  2. --test 2 : The Chaos API Fuzzer (Tool Use & Error Handling)"
  echo "  3. --test 3 : The 'Infinite Calendar Grid' (Edge-Case Logic & Timezones)"
  echo "  4. --test 4 : The Architectural Trade-Off Challenge (High-Level System Design)"
  echo "  --all       : Run all challenges sequentially"
}

# Main
case "${1:-}" in
  --list)
    list_challenges
    exit 0
    ;;
  --test)
    check_server
    case "${2:-}" in
      1) run_challenge_1 ;;
      2) run_challenge_2 ;;
      3) run_challenge_3 ;;
      4) run_challenge_4 ;;
      *) echo "Invalid test number: ${2:-}. Use 1, 2, 3, or 4." ; exit 1 ;;
    esac
    ;;
  --all)
    check_server
    run_challenge_1
    run_challenge_2
    run_challenge_3
    run_challenge_4
    ;;
  *)
    list_challenges
    echo ""
    echo "Usage: $0 --test <1|2|3|4> or $0 --all"
    exit 0
    ;;
esac
