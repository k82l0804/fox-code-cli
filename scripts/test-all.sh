#!/usr/bin/env bash
# Run the full fox-code-cli test suite: typecheck + all packages + app-level tests.
# Usage: bash scripts/test-all.sh
set -euo pipefail
cd "$(dirname "$0")/.."

section() { printf '\n\033[1;34m━━━ %s ━━━\033[0m\n' "$1"; }

section "Typecheck"
bun run typecheck

section "packages/effect-drizzle-sqlite"
(cd packages/effect-drizzle-sqlite && bun test --timeout 30000)

section "packages/fox-memory"
(cd packages/fox-memory && bun test --timeout 30000)

section "packages/sandbox"
(cd packages/sandbox && bun test --timeout 30000)

section "packages/http-recorder"
(cd packages/http-recorder && bun test --timeout 30000)

section "packages/tui"
(cd packages/tui && bun test --timeout 30000)

section "packages/core"
(cd packages/core && bun test --timeout 30000)

section "App-level tests (test/)"
bun test ./test/*.test.ts ./test/*/*.test.ts --timeout 30000

printf '\n\033[1;32m✓ All tests passed\033[0m\n'
