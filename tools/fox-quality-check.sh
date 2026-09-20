#!/usr/bin/env bash
# fox-quality-check.sh — Capture and compare model responses for quality analysis
#
# Usage:
#   FOX_EXPERIMENTAL_COMPRESS=true bun run ./src/index.ts serve &
#   bash tools/fox-quality-check.sh --capture fox
#   kill %1
#   bun run ./src/index.ts serve &  # no compression
#   bash tools/fox-quality-check.sh --capture kilo
#   bash tools/fox-quality-check.sh --compare
#
set -euo pipefail

FOX_SERVER="${FOX_SERVER:-http://localhost:4096}"
FOX_DIR="${FOX_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
QUALITY_DIR="${QUALITY_DIR:-/tmp/fox-quality}"

mkdir -p "$QUALITY_DIR"

CURL_OPTS=(-sf -H "x-kilo-directory: ${FOX_DIR}")

# Prompts with expected ground-truth checks
PROMPTS=(
  "What files are in the current directory? Just list them."
  "Read package.json and tell me the project name and version."
  "How many TypeScript files are in the src/ directory?"
)

# Expected substrings in correct answers
EXPECTED=(
  "package.json"        # Should mention package.json in listing
  "@fox/cli"            # Should find the project name
  "766"                 # Exact count of TypeScript files in src/
)

capture_responses() {
  local label="$1"
  local outdir="${QUALITY_DIR}/${label}"
  mkdir -p "$outdir"

  echo "Capturing ${label} responses (${#PROMPTS[@]} prompts)..."

  for i in "${!PROMPTS[@]}"; do
    local prompt="${PROMPTS[$i]}"
    echo "  [$((i+1))/${#PROMPTS[@]}] ${prompt:0:60}..."

    # Create session
    local sid
    sid=$(curl "${CURL_OPTS[@]}" -X POST "${FOX_SERVER}/session" \
      -H "Content-Type: application/json" -d '{}' | jq -r '.id // empty')

    if [ -z "$sid" ]; then
      echo "    FAILED to create session" >&2
      echo "ERROR: no session" > "${outdir}/response-${i}.txt"
      continue
    fi

    # Auto-approve permissions
    curl "${CURL_OPTS[@]}" -X POST "${FOX_SERVER}/permission/allow-everything" \
      -H "Content-Type: application/json" \
      -d "{\"enable\": true, \"sessionID\": \"${sid}\"}" > /dev/null 2>&1 || true

    # Send prompt
    curl "${CURL_OPTS[@]}" -X POST "${FOX_SERVER}/session/${sid}/message" \
      -H "Content-Type: application/json" \
      -d "$(jq -n --arg p "$prompt" '{parts: [{type: "text", text: $p}]}')" \
      > /dev/null 2>&1

    # Wait for completion
    local elapsed=0
    while [ $elapsed -lt 60 ]; do
      local msgs
      msgs=$(curl "${CURL_OPTS[@]}" "${FOX_SERVER}/session/${sid}/message" 2>/dev/null || echo "[]")
      local last_role last_completed
      last_role=$(echo "$msgs" | jq -r 'if type == "array" then .[-1].info.role // "none" else "none" end' 2>/dev/null)
      last_completed=$(echo "$msgs" | jq -r 'if type == "array" then .[-1].info.time.completed // "null" else "null" end' 2>/dev/null)
      if [ "$last_role" = "assistant" ] && [ "$last_completed" != "null" ]; then
        break
      fi
      sleep 2
      elapsed=$((elapsed + 2))
    done

    # Extract the final assistant response text
    local msgs
    msgs=$(curl "${CURL_OPTS[@]}" "${FOX_SERVER}/session/${sid}/message" 2>/dev/null || echo "[]")
    echo "$msgs" | jq -r '
      [.[] | select(.info.role == "assistant") | .parts[]? |
        select(.type == "text") | .text] | join("\n")
    ' > "${outdir}/response-${i}.txt" 2>/dev/null

    # Also save token metrics
    echo "$msgs" | jq '{
      prompt: "'"${prompt//\"/\\\"}"'",
      session: "'"$sid"'",
      total_input: ([.[] | select(.info.role == "assistant") | .info.tokens.input // 0] | add),
      total_output: ([.[] | select(.info.role == "assistant") | .info.tokens.output // 0] | add),
      steps: ([.[] | select(.info.role == "assistant")] | length)
    }' > "${outdir}/metrics-${i}.json" 2>/dev/null

    local resp_len
    resp_len=$(wc -c < "${outdir}/response-${i}.txt")
    echo "    ✓ Response: ${resp_len} bytes, session ${sid}"
  done

  echo "  → Saved to ${outdir}/"
}

compare_responses() {
  echo "═══════════════════════════════════════════════════════════════"
  echo "  🦊 Fox vs Kilo — Quality Comparison"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""

  local pass=0
  local fail=0
  local total=${#PROMPTS[@]}

  for i in "${!PROMPTS[@]}"; do
    local prompt="${PROMPTS[$i]}"
    local expected="${EXPECTED[$i]}"
    local kilo_resp="${QUALITY_DIR}/kilo/response-${i}.txt"
    local fox_resp="${QUALITY_DIR}/fox/response-${i}.txt"

    echo "  [$((i+1))] ${prompt:0:60}"

    if [ ! -f "$kilo_resp" ] || [ ! -f "$fox_resp" ]; then
      echo "      ⚠️  Missing response file"
      fail=$((fail + 1))
      continue
    fi

    local kilo_len fox_len
    kilo_len=$(wc -c < "$kilo_resp")
    fox_len=$(wc -c < "$fox_resp")

    echo "      Kilo: ${kilo_len}b  Fox: ${fox_len}b"

    # Check expected substring if provided
    if [ -n "$expected" ]; then
      local kilo_has fox_has
      kilo_has=$(grep -ci "$expected" "$kilo_resp" 2>/dev/null || echo "0")
      fox_has=$(grep -ci "$expected" "$fox_resp" 2>/dev/null || echo "0")

      if [ "$fox_has" -gt 0 ]; then
        echo "      ✅ Fox contains expected: '${expected}'"
        pass=$((pass + 1))
      else
        echo "      ❌ Fox MISSING expected: '${expected}'"
        fail=$((fail + 1))
      fi

      if [ "$kilo_has" -gt 0 ]; then
        echo "      ✅ Kilo contains expected: '${expected}'"
      else
        echo "      ⚠️  Kilo also missing: '${expected}'"
      fi
    else
      # No expected check — just verify non-empty
      if [ "$fox_len" -gt 0 ]; then
        echo "      ✅ Fox produced response"
        pass=$((pass + 1))
      else
        echo "      ❌ Fox produced empty response"
        fail=$((fail + 1))
      fi
    fi

    # Show side-by-side snippet
    echo "      ┌── Kilo response (first 100 chars):"
    echo "      │ $(head -c 100 "$kilo_resp")"
    echo "      ├── Fox response (first 100 chars):"
    echo "      │ $(head -c 100 "$fox_resp")"
    echo "      └──"
    echo ""
  done

  # Token comparison
  echo "  ┌──────────────────────────────────────────────────────┐"
  echo "  │  Token Comparison                                    │"
  echo "  ├──────────────────────────────────────────────────────┤"

  local kilo_total=0 fox_total=0
  for i in "${!PROMPTS[@]}"; do
    local kt ft
    kt=$(jq '.total_input // 0' "${QUALITY_DIR}/kilo/metrics-${i}.json" 2>/dev/null || echo 0)
    ft=$(jq '.total_input // 0' "${QUALITY_DIR}/fox/metrics-${i}.json" 2>/dev/null || echo 0)
    kilo_total=$((kilo_total + kt))
    fox_total=$((fox_total + ft))
  done

  local saved=$((kilo_total - fox_total))
  echo "  │  Kilo total input: $(printf '%6d' $kilo_total) tokens              │"
  echo "  │  Fox total input:  $(printf '%6d' $fox_total) tokens              │"
  echo "  │  Saved:            $(printf '%+6d' $saved) tokens              │"
  echo "  └──────────────────────────────────────────────────────┘"
  echo ""

  echo "  Quality score: ${pass}/${total} prompts passed"
  if [ $fail -eq 0 ]; then
    echo "  🦊 VERDICT: Fox produces same-quality responses with fewer tokens!"
  else
    echo "  ⚠️  VERDICT: ${fail} quality regressions detected — investigate!"
  fi
}

case "${1:-}" in
  --capture)
    if [ -z "${2:-}" ]; then
      echo "Usage: $0 --capture <fox|kilo>"
      exit 1
    fi
    capture_responses "$2"
    ;;
  --compare)
    compare_responses
    ;;
  *)
    echo "Usage: $0 --capture <fox|kilo>  |  --compare"
    echo ""
    echo "Run --capture kilo (without compression), then --capture fox (with compression),"
    echo "then --compare to see side-by-side quality + token analysis."
    exit 1
    ;;
esac
