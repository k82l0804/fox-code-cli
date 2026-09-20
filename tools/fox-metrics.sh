#!/usr/bin/env bash
# fox-metrics.sh — Extract per-step performance metrics from Fox sessions
#
# Usage:
#   ./tools/fox-metrics.sh                   # Show latest session metrics
#   ./tools/fox-metrics.sh <session-id>      # Show specific session
#   ./tools/fox-metrics.sh --all             # Show all sessions summary
#   ./tools/fox-metrics.sh --compare S1 S2   # Compare two sessions
#
# Uses `fox db` to query the SQLite session database directly.
# No server required — works on historical data.
#
export PATH="$HOME/.local/bin:$PATH"
set -euo pipefail

FOX_BIN="${FOX_BIN:-fox}"

query_json() {
  "$FOX_BIN" db --format json "$1" 2>/dev/null
}

# Get the latest session ID
latest_session() {
  query_json "
    SELECT id FROM session
    ORDER BY time_created DESC
    LIMIT 1
  " | jq -r '.[0].id // empty'
}

# Print per-step metrics for a session
session_metrics() {
  local sid="$1"

  # Session summary
  local summary
  summary=$(query_json "
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
      s.time_updated
    FROM session s
    WHERE s.id = '${sid}'
  ")

  if [ -z "$summary" ] || [ "$summary" = "[]" ]; then
    echo "Session not found: ${sid}"
    return 1
  fi

  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "$summary" | jq -r '.[0] |
    "  Session:     \(.id)",
    "  Title:       \(.title // "untitled")",
    "  Total Time:  \((.time_updated - .time_created) // 0)ms",
    "  Tokens In:   \(.tokens_input // 0)",
    "  Tokens Out:  \(.tokens_output // 0)",
    "  Reasoning:   \(.tokens_reasoning // 0)",
    "  Cache Read:  \(.tokens_cache_read // 0)",
    "  Cache Write: \(.tokens_cache_write // 0)",
    "  Cost:        $\(.cost // 0)"
  '

  # Per-message breakdown
  local messages
  messages=$(query_json "
    SELECT
      m.id,
      json_extract(m.data, '$.role') as role,
      json_extract(m.data, '$.agent') as agent,
      json_extract(m.data, '$.modelID') as model_id,
      json_extract(m.data, '$.providerID') as provider_id,
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
    WHERE m.session_id = '${sid}'
    ORDER BY m.time_created ASC
  ")

  echo ""
  echo "  Per-Step Breakdown (assistant messages only):"
  echo "  ─────────────────────────────────────────────────────────────"
  printf "  %-4s %-8s %-9s %-9s %-9s %-8s %-8s %s\n" \
    "Step" "Latency" "Tok In" "Tok Out" "Reason" "Cache" "Cost" "Finish"
  echo "  ─────────────────────────────────────────────────────────────"

  local step=0
  echo "$messages" | jq -c '.[] | select(.role == "assistant")' 2>/dev/null | while IFS= read -r msg; do
    step=$((step + 1))
    local lat tin tout treas crd cst fin
    lat=$(echo "$msg" | jq -r '.latency_ms // "-"')
    tin=$(echo "$msg" | jq -r '.tokens_input // 0')
    tout=$(echo "$msg" | jq -r '.tokens_output // 0')
    treas=$(echo "$msg" | jq -r '.tokens_reasoning // 0')
    crd=$(echo "$msg" | jq -r '.cache_read // 0')
    cst=$(echo "$msg" | jq -r '.cost // 0')
    fin=$(echo "$msg" | jq -r '.finish_reason // "-"')
    printf "  %-4d %-8s %-9s %-9s %-9s %-8s %-8s %s\n" \
      "$step" "${lat}ms" "$tin" "$tout" "$treas" "$crd" "\$${cst}" "$fin"
  done

  # Tool usage per step
  echo ""
  echo "  Tool Calls Per Step:"
  echo "  ─────────────────────────────────────────────────────────────"

  local parts
  parts=$(query_json "
    SELECT
      p.message_id,
      json_extract(p.data, '$.type') as type,
      COALESCE(json_extract(p.data, '$.tool'), json_extract(p.data, '$.name')) as name,
      json_extract(p.data, '$.state.status') as status,
      json_extract(p.data, '$.state.time.start') as time_start,
      json_extract(p.data, '$.state.time.end') as time_end,
      CASE
        WHEN json_extract(p.data, '$.state.time.end') IS NOT NULL
             AND json_extract(p.data, '$.state.time.start') IS NOT NULL
        THEN json_extract(p.data, '$.state.time.end') - json_extract(p.data, '$.state.time.start')
        ELSE NULL
      END as tool_ms
    FROM part p
    JOIN message m ON p.message_id = m.id
    WHERE p.session_id = '${sid}'
      AND json_extract(p.data, '$.type') = 'tool'
    ORDER BY p.time_created ASC
  ")

  if [ -n "$parts" ] && [ "$parts" != "[]" ]; then
    printf "  %-30s %-10s %s\n" "Tool" "Duration" "Status"
    echo "  ─────────────────────────────────────────────────────────────"
    echo "$parts" | jq -c '.[]' 2>/dev/null | while IFS= read -r part; do
      local name duration status
      name=$(echo "$part" | jq -r '.name // "unknown"')
      duration=$(echo "$part" | jq -r '.tool_ms // "-"')
      status=$(echo "$part" | jq -r '.status // "-"')
      printf "  %-30s %-10s %s\n" "$name" "${duration}ms" "$status"
    done
  else
    echo "  (no tool calls)"
  fi

  echo ""
}

# Show summary of all sessions
all_sessions() {
  echo ""
  echo "Fox CLI — All Sessions Summary"
  echo "═══════════════════════════════════════════════════════════════"
  printf "  %-8s %-30s %-8s %-9s %-9s %s\n" "ID" "Title" "Time" "Tok In" "Tok Out" "Cost"
  echo "  ─────────────────────────────────────────────────────────────"

  query_json "
    SELECT
      substr(s.id, 1, 8) as short_id,
      s.title,
      (s.time_updated - s.time_created) as total_ms,
      s.tokens_input,
      s.tokens_output,
      s.cost
    FROM session s
    ORDER BY s.time_created DESC
    LIMIT 20
  " | jq -c '.[]' 2>/dev/null | while IFS= read -r row; do
    local sid title total tin tout cst
    sid=$(echo "$row" | jq -r '.short_id')
    title=$(echo "$row" | jq -r '.title // "untitled"')
    total=$(echo "$row" | jq -r '.total_ms // 0')
    tin=$(echo "$row" | jq -r '.tokens_input // 0')
    tout=$(echo "$row" | jq -r '.tokens_output // 0')
    cst=$(echo "$row" | jq -r '.cost // 0')
    printf "  %-8s %-30s %-8s %-9s %-9s %s\n" \
      "$sid" "${title:0:30}" "${total}ms" "$tin" "$tout" "\$${cst}"
  done
  echo ""
}

# Compare two sessions
compare_sessions() {
  local s1="$1" s2="$2"
  echo ""
  echo "Fox CLI — Session Comparison"
  echo "═══════════════════════════════════════════════════════════════"

  local data
  data=$(query_json "
    SELECT
      s.id,
      s.title,
      (s.time_updated - s.time_created) as total_ms,
      s.tokens_input,
      s.tokens_output,
      s.tokens_reasoning,
      s.tokens_cache_read,
      s.cost,
      (SELECT COUNT(*) FROM message m WHERE m.session_id = s.id AND json_extract(m.data, '$.role') = 'assistant') as steps
    FROM session s
    WHERE s.id IN ('${s1}', '${s2}')
    ORDER BY s.time_created ASC
  ")

  printf "  %-20s %-20s %-20s %s\n" "Metric" "Session 1" "Session 2" "Delta"
  echo "  ─────────────────────────────────────────────────────────────"

  echo "$data" | jq -r '
    if length == 2 then
      "  Total Time:        \(.[0].total_ms)ms\t\(.[1].total_ms)ms\t\(.[1].total_ms - .[0].total_ms)ms",
      "  Steps:             \(.[0].steps)\t\(.[1].steps)\t\(.[1].steps - .[0].steps)",
      "  Tokens In:         \(.[0].tokens_input)\t\(.[1].tokens_input)\t\(.[1].tokens_input - .[0].tokens_input)",
      "  Tokens Out:        \(.[0].tokens_output)\t\(.[1].tokens_output)\t\(.[1].tokens_output - .[0].tokens_output)",
      "  Cache Read:        \(.[0].tokens_cache_read)\t\(.[1].tokens_cache_read)\t\(.[1].tokens_cache_read - .[0].tokens_cache_read)",
      "  Cost:              $\(.[0].cost)\t$\(.[1].cost)\t$\(.[1].cost - .[0].cost)"
    else
      "  ERROR: Need exactly 2 matching sessions"
    end
  ' 2>/dev/null | column -t -s$'\t'
  echo ""
}

# Main
case "${1:-}" in
  --help|-h)
    echo "Usage: $0 [SESSION_ID | --all | --compare S1 S2]"
    echo ""
    echo "  (no args)           Show metrics for the latest session"
    echo "  SESSION_ID          Show metrics for a specific session"
    echo "  --all               Show summary of all sessions"
    echo "  --compare S1 S2     Compare two sessions side-by-side"
    ;;
  --all)
    all_sessions
    ;;
  --compare)
    compare_sessions "${2:?Missing session 1}" "${3:?Missing session 2}"
    ;;
  "")
    sid=$(latest_session)
    if [ -z "$sid" ]; then
      echo "No sessions found in database."
      exit 1
    fi
    session_metrics "$sid"
    ;;
  *)
    session_metrics "$1"
    ;;
esac
