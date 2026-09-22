/**
 * Tier 3 — Adversarial Registry (66 fixtures)
 */
export { TIER3_MALFORMED_DIFF_FIXTURES } from "./malformed-diffs"
export { TIER3_CORRUPTED_LOG_FIXTURES } from "./corrupted-logs"
export { TIER3_PARTIAL_STACKTRACE_FIXTURES } from "./partial-stacktraces"
export { TIER3_AMBIGUOUS_WORKFLOW_FIXTURES } from "./ambiguous-workflows"
export { TIER3_ADVERSARIAL_EXPANSION_FIXTURES } from "./adversarial-expansion"

import { TIER3_MALFORMED_DIFF_FIXTURES } from "./malformed-diffs"
import { TIER3_CORRUPTED_LOG_FIXTURES } from "./corrupted-logs"
import { TIER3_PARTIAL_STACKTRACE_FIXTURES } from "./partial-stacktraces"
import { TIER3_AMBIGUOUS_WORKFLOW_FIXTURES } from "./ambiguous-workflows"
import { TIER3_ADVERSARIAL_EXPANSION_FIXTURES } from "./adversarial-expansion"
import type { ChallengeFixture } from "../types"

export function getTier3Fixtures(): readonly ChallengeFixture[] {
  return [
    ...TIER3_MALFORMED_DIFF_FIXTURES,
    ...TIER3_CORRUPTED_LOG_FIXTURES,
    ...TIER3_PARTIAL_STACKTRACE_FIXTURES,
    ...TIER3_AMBIGUOUS_WORKFLOW_FIXTURES,
    ...TIER3_ADVERSARIAL_EXPANSION_FIXTURES,
  ]
}
