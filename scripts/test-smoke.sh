#!/usr/bin/env bash
# Quick smoke test: typecheck + highest-value app-level tests.
# Use this after small refactors to get fast feedback.
# Usage: bash scripts/test-smoke.sh
set -euo pipefail
cd "$(dirname "$0")/.."

section() { printf '\n\033[1;34m━━━ %s ━━━\033[0m\n' "$1"; }

section "Typecheck"
bun run typecheck

section "Smoke: patch + edit + config"
bun test test/patch.test.ts test/edit-replacers.test.ts test/config-merge.test.ts --timeout 30000

printf '\n\033[1;32m✓ Smoke tests passed\033[0m\n'
