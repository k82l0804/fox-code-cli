#!/usr/bin/env bash
# Quick smoke test: typecheck + highest-value app-level tests.
# Use this after small refactors to get fast feedback.
# Usage: bash scripts/test-smoke.sh
set -euo pipefail
cd "$(dirname "$0")/.."

section() { printf '\n\033[1;34m━━━ %s ━━━\033[0m\n' "$1"; }

section "Typecheck"
bun run typecheck

section "Smoke: patch + transaction + edit + config + compress + autonomous"
bun test test/patch.test.ts test/transaction.test.ts test/transaction-confidence.test.ts test/edit-replacers.test.ts test/config-merge.test.ts test/oscillation.test.ts test/verification.test.ts test/repair-budget.test.ts packages/core/test/compress.test.ts --timeout 30000

printf '\n\033[1;32m✓ Smoke tests passed\033[0m\n'
