/**
 * Fox Challenge Ladder — Master Registry (334 fixtures)
 *
 * Aggregates all 4 tiers:
 *   Tier 1: Baseline (80)
 *   Tier 2: Long-Horizon (100)
 *   Tier 3: Adversarial (66)
 *   Tier 4: External Benchmarks (88)
 */
export * from "./types"
export { validateFixtures } from "./validator"
export { runChallengeLadder, runFixture, aggregateCategory } from "./scoring"

import { getTier1Fixtures } from "./tier-1-baseline"
import { getTier2Fixtures } from "./tier-2-long-horizon"
import { getTier3Fixtures } from "./tier-3-adversarial"
import { getTier4Fixtures } from "./tier-4-external"
import type { ChallengeFixture } from "./types"

export function getAllChallengeFixtures(): readonly ChallengeFixture[] {
  return [
    ...getTier1Fixtures(),
    ...getTier2Fixtures(),
    ...getTier3Fixtures(),
    ...getTier4Fixtures(),
  ]
}

export { getTier1Fixtures } from "./tier-1-baseline"
export { getTier2Fixtures } from "./tier-2-long-horizon"
export { getTier3Fixtures } from "./tier-3-adversarial"
export { getTier4Fixtures } from "./tier-4-external"
