/**
 * Tier 1 — Shell Output Expanded (5 fixtures)
 *
 * 5 existing shell-output fixtures converted to ChallengeFixture format.
 */
import type { ChallengeFixture } from "../types"
import { SHELL_OUTPUT_FIXTURES } from "../../corpora/shell-output/fixtures"

export const TIER1_SHELL_OUTPUT_FIXTURES: readonly ChallengeFixture[] = SHELL_OUTPUT_FIXTURES.map(
  (f, idx) => ({
    id: `shell-t1-${String(idx + 1).padStart(2, "0")}`,
    tier: 1 as const,
    category: "shell-output" as const,
    description: f.name,
    seed: 6000 + idx,
    input: {
      content: f.content,
      tool: f.tool,
      command: f.command,
    },
    expected: {
      type: "invariant" as const,
      mustContain: f.mustContain ? [...f.mustContain] : undefined,
      workflow: "swe" as const,
      minReductionPct: f.minExpectedReductionPct,
    },
  }),
)
