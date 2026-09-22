/**
 * Tier 2 — Long-Horizon Registry (100 fixtures)
 */
export { TIER2_GITOPS_FIXTURES } from "./gitops-workflows"
export { TIER2_SWE_MULTIFILE_FIXTURES } from "./swe-multifile"
export { TIER2_SHELL_PIPELINE_FIXTURES } from "./shell-pipelines"
export { TIER2_MULTI_DOC_FIXTURES } from "./multi-doc-research"
export { TIER2_GITOPS_EXPANSION_FIXTURES } from "./gitops-expansion"
export { TIER2_SWE_EXPANSION_FIXTURES } from "./swe-expansion"
export { TIER2_CICD_EXPANSION_FIXTURES } from "./cicd-expansion"

import { TIER2_GITOPS_FIXTURES } from "./gitops-workflows"
import { TIER2_SWE_MULTIFILE_FIXTURES } from "./swe-multifile"
import { TIER2_SHELL_PIPELINE_FIXTURES } from "./shell-pipelines"
import { TIER2_MULTI_DOC_FIXTURES } from "./multi-doc-research"
import { TIER2_GITOPS_EXPANSION_FIXTURES } from "./gitops-expansion"
import { TIER2_SWE_EXPANSION_FIXTURES } from "./swe-expansion"
import { TIER2_CICD_EXPANSION_FIXTURES } from "./cicd-expansion"
import type { ChallengeFixture } from "../types"

export function getTier2Fixtures(): readonly ChallengeFixture[] {
  return [
    ...TIER2_GITOPS_FIXTURES,
    ...TIER2_SWE_MULTIFILE_FIXTURES,
    ...TIER2_SHELL_PIPELINE_FIXTURES,
    ...TIER2_MULTI_DOC_FIXTURES,
    ...TIER2_GITOPS_EXPANSION_FIXTURES,
    ...TIER2_SWE_EXPANSION_FIXTURES,
    ...TIER2_CICD_EXPANSION_FIXTURES,
  ]
}
