/**
 * Tier 4 — External Benchmarks Registry (88 fixtures)
 */
export { TIER4_GAIA_FIXTURES } from "./gaia-style"
export { TIER4_WEBARENA_FIXTURES } from "./webarena-style"
export { TIER4_OSWORLD_FIXTURES } from "./osworld-style"
export { TIER4_SWE_VERIFIED_FIXTURES } from "./swe-bench-verified"
export { TIER4_STRUCTURAL_EXPANSION_FIXTURES } from "./structural-expansion"

import { TIER4_GAIA_FIXTURES } from "./gaia-style"
import { TIER4_WEBARENA_FIXTURES } from "./webarena-style"
import { TIER4_OSWORLD_FIXTURES } from "./osworld-style"
import { TIER4_SWE_VERIFIED_FIXTURES } from "./swe-bench-verified"
import { TIER4_STRUCTURAL_EXPANSION_FIXTURES } from "./structural-expansion"
import type { ChallengeFixture } from "../types"

export function getTier4Fixtures(): readonly ChallengeFixture[] {
  return [
    ...TIER4_GAIA_FIXTURES,
    ...TIER4_WEBARENA_FIXTURES,
    ...TIER4_OSWORLD_FIXTURES,
    ...TIER4_SWE_VERIFIED_FIXTURES,
    ...TIER4_STRUCTURAL_EXPANSION_FIXTURES,
  ]
}
