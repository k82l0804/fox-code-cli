#!/usr/bin/env bash
# fox-speed-test.sh — Timed A/B test for Fox vs Kilo
# Measures wall-clock time AND API-reported timing per prompt.
#
# Usage:
#   bash tools/fox-speed-test.sh kilo   # Run with no compression (baseline)
#   bash tools/fox-speed-test.sh fox    # Run with FOX_EXPERIMENTAL_COMPRESS=true
#
set -euo pipefail

LABEL="${1:?Usage: $0 <kilo|fox>}"
FOX_SERVER="${FOX_SERVER:-http://localhost:4096}"
FOX_DIR="${FOX_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
OUT_DIR="/tmp/fox-speed/${LABEL}"

mkdir -p "$OUT_DIR"

CURL_OPTS=(-sf -H "x-kilo-directory: ${FOX_DIR}")

PROMPTS=(
  "What files are in the current directory? Just list them."
  "Read package.json and tell me the project name and version."
  "How many TypeScript files are in the src/ directory?"
)

echo "═══════════════════════════════════════════════════════════"
echo "  🏎️  Speed Test — ${LABEL} mode"
echo "═══════════════════════════════════════════════════════════"

for i in "${!PROMPTS[@]}"; do
  prompt="${PROMPTS[$i]}"
  echo ""
  echo "  [$((i+1))/${#PROMPTS[@]}] ${prompt:0:55}..."

  # Create session
  sid=$(curl "${CURL_OPTS[@]}" -X POST "${FOX_SERVER}/session" \
    -H "Content-Type: application/json" -d '{}' | jq -r '.id // empty')

  if [ -z "$sid" ]; then
    echo "    FAILED to create session" >&2
    echo '{"error":"no session"}' > "${OUT_DIR}/speed-${i}.json"
    continue
  fi

  # Auto-approve
  curl "${CURL_OPTS[@]}" -X POST "${FOX_SERVER}/permission/allow-everything" \
    -H "Content-Type: application/json" \
    -d "{\"enable\": true, \"sessionID\": \"${sid}\"}" > /dev/null 2>&1 || true

  # Time the prompt — wall clock
  wall_start=$(date +%s%N)

  # Send message
  curl "${CURL_OPTS[@]}" -X POST "${FOX_SERVER}/session/${sid}/message" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg p "$prompt" '{parts: [{type: "text", text: $p}]}')" \
    > /dev/null 2>&1

  # Poll for completion
  elapsed=0
  while [ $elapsed -lt 90 ]; do
    msgs=$(curl "${CURL_OPTS[@]}" "${FOX_SERVER}/session/${sid}/message" 2>/dev/null || echo "[]")
    last_role=$(echo "$msgs" | jq -r 'if type == "array" then .[-1].info.role // "none" else "none" end' 2>/dev/null)
    last_completed=$(echo "$msgs" | jq -r 'if type == "array" then .[-1].info.time.completed // "null" else "null" end' 2>/dev/null)
    if [ "$last_role" = "assistant" ] && [ "$last_completed" != "null" ]; then
      break
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  wall_end=$(date +%s%N)
  wall_ms=$(( (wall_end - wall_start) / 1000000 ))

  # Extract API-reported timing + token data
  msgs=$(curl "${CURL_OPTS[@]}" "${FOX_SERVER}/session/${sid}/message" 2>/dev/null || echo "[]")

  echo "$msgs" | jq --arg prompt "$prompt" --arg sid "$sid" --argjson wall_ms "$wall_ms" '{
    prompt: $prompt,
    session: $sid,
    wall_ms: $wall_ms,
    total_input: ([.[] | select(.info.role == "assistant") | .info.tokens.input // 0] | add),
    total_output: ([.[] | select(.info.role == "assistant") | .info.tokens.output // 0] | add),
    steps: ([.[] | select(.info.role == "assistant")] | length),
    api_time: ([.[] | select(.info.role == "assistant") | .info.time] | .[0] // null),
    step_parts: [.[] | select(.info.role == "assistant") | .parts[]? | select(.type == "step-finish") | {
      elapsed: .time.elapsed,
      ttft: .time.ttft
    }]
  }' > "${OUT_DIR}/speed-${i}.json" 2>/dev/null

  # Display
  input_tok=$(jq -r '.total_input // 0' "${OUT_DIR}/speed-${i}.json")
  echo "    Wall: ${wall_ms}ms | Input tokens: ${input_tok} | Steps: $(jq -r '.steps' "${OUT_DIR}/speed-${i}.json")"
done

echo ""
echo "  → Results saved to ${OUT_DIR}/"
echo ""

# Summary
echo "  ┌────────────────────────────────────────────────────────┐"
echo "  │  Summary                                               │"
echo "  ├────────────────────────────────────────────────────────┤"
total_wall=0
total_input=0
for i in "${!PROMPTS[@]}"; do
  w=$(jq -r '.wall_ms // 0' "${OUT_DIR}/speed-${i}.json" 2>/dev/null)
  t=$(jq -r '.total_input // 0' "${OUT_DIR}/speed-${i}.json" 2>/dev/null)
  total_wall=$((total_wall + w))
  total_input=$((total_input + t))
  printf "  │  P%d: %6dms  %6d tokens  %s\n" $((i+1)) "$w" "$t" "${PROMPTS[$i]:0:30}"
done
echo "  │────────────────────────────────────────────────────────│"
printf "  │  Total: %6dms  %6d tokens\n" "$total_wall" "$total_input"
echo "  └────────────────────────────────────────────────────────┘"
