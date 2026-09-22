/**
 * Tier 1 — Baseline Registry (80 fixtures)
 */
export { TIER1_SWE_BENCH_FIXTURES } from "./swe-bench-extended"
export { TIER1_GITOPS_FIXTURES } from "./gitops-expanded"
export { TIER1_TEST_OUTPUT_FIXTURES } from "./test-output-expanded"
export { TIER1_DIFF_FIXTURES } from "./diff-expanded"
export { TIER1_SHELL_OUTPUT_FIXTURES } from "./shell-output-expanded"
export { TIER1_DOCUMENT_FIXTURES } from "./document-expanded"

import { TIER1_SWE_BENCH_FIXTURES } from "./swe-bench-extended"
import { TIER1_GITOPS_FIXTURES } from "./gitops-expanded"
import { TIER1_TEST_OUTPUT_FIXTURES } from "./test-output-expanded"
import { TIER1_DIFF_FIXTURES } from "./diff-expanded"
import { TIER1_SHELL_OUTPUT_FIXTURES } from "./shell-output-expanded"
import { TIER1_DOCUMENT_FIXTURES } from "./document-expanded"
import type { ChallengeFixture } from "../types"

export function getTier1Fixtures(): readonly ChallengeFixture[] {
  return [
    ...TIER1_SWE_BENCH_FIXTURES,
    ...TIER1_GITOPS_FIXTURES,
    ...TIER1_TEST_OUTPUT_FIXTURES,
    ...TIER1_DIFF_FIXTURES,
    ...TIER1_SHELL_OUTPUT_FIXTURES,
    ...TIER1_DOCUMENT_FIXTURES,
  ]
}
