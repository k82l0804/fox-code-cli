/**
 * AFB Comparator — Multi-agent comparison + 5-criterion pass bar verdict
 *
 * Implements the formal "as good as" definition:
 *   C1: Fox ≥ 70% on Tiers 1–7 + T10 (≥ 56/80 challenges)
 *   C2: Fox ≥ both Aider AND Goose on overall score
 *   C3: Fox ≥ best competitor on ≥ 6 of 8 runnable tiers
 *   C4: Zero catastrophic failures on any evaluated task
 *   C5: All criteria above met simultaneously (AND gate)
 */

import type { AgentScore, TierScore } from "./rubric";

// ─── Types ──────────────────────────────────────────────────────────────

export interface CriterionResult {
  criterion: string;
  description: string;
  passed: boolean;
  detail: string;
}

export interface PassBarVerdict {
  fox: AgentScore;
  competitors: AgentScore[];
  criteria: CriterionResult[];
  all_passed: boolean;
  is_better_than: Record<string, boolean>;  // agent name → true if Fox is strictly better
  verdict_summary: string;
}

export interface TierComparison {
  tier: number;
  tier_name: string;
  scores: Record<string, number>;  // agent → total score for this tier
  winner: string;
  fox_wins: boolean;
}

// ─── Evaluation Tiers ───────────────────────────────────────────────────

/**
 * Tiers that count toward Criterion 1 (absolute competence floor).
 * Excludes Guardian tiers (8, 9) which require Phase 3.
 */
const CRITERION_1_TIERS = [1, 2, 3, 4, 5, 6, 7, 10];

/**
 * All runnable tiers for tier dominance comparison.
 * Same as Criterion 1 tiers (T8-9 included in overall but not in dominance).
 */
const TIER_DOMINANCE_TIERS = [1, 2, 3, 4, 5, 6, 7, 10];

// ─── Criterion Functions ────────────────────────────────────────────────

/**
 * C1: Fox must pass ≥ 70% on Tiers 1–7 + T10 (≥ 56/80 challenges scoring ≥ 7/10)
 */
export function evaluateCriterion1(fox: AgentScore): CriterionResult {
  const relevantTiers = fox.tiers.filter((t) => CRITERION_1_TIERS.includes(t.tier));
  const totalChallenges = relevantTiers.reduce(
    (sum, t) => sum + t.challenges.length, 0
  );
  const passCount = relevantTiers.reduce(
    (sum, t) => sum + t.pass_count, 0
  );
  const passRate = totalChallenges > 0 ? passCount / totalChallenges : 0;
  const threshold = 0.70;
  const requiredCount = Math.ceil(totalChallenges * threshold);

  return {
    criterion: "C1",
    description: "Absolute Competence: Fox ≥ 70% on Tiers 1–7 + T10",
    passed: passRate >= threshold,
    detail: `Fox: ${passCount}/${totalChallenges} (${(passRate * 100).toFixed(1)}%), required: ≥ ${requiredCount}/${totalChallenges} (70%)`,
  };
}

/**
 * C2: Fox must match or beat BOTH Aider and Goose on overall score
 */
export function evaluateCriterion2(
  fox: AgentScore,
  competitors: AgentScore[],
): CriterionResult {
  const foxScore = fox.total;
  const allBeat = competitors.every((c) => foxScore >= c.total);
  const details = competitors
    .map((c) => `${c.agent}: ${c.total}`)
    .join(", ");

  return {
    criterion: "C2",
    description: "Competitive Parity: Fox ≥ both competitors on overall score",
    passed: allBeat,
    detail: `Fox: ${foxScore} vs ${details}`,
  };
}

/**
 * C3: Fox must match or beat the BEST competitor on ≥ 6 of 8 runnable tiers
 */
export function evaluateCriterion3(
  fox: AgentScore,
  competitors: AgentScore[],
): CriterionResult {
  const tierComparisons = compareTiers(fox, competitors);
  const foxWins = tierComparisons.filter((tc) => tc.fox_wins).length;
  const totalTiers = tierComparisons.length;
  const requiredWins = 6;

  return {
    criterion: "C3",
    description: `Tier Dominance: Fox ≥ best competitor on ≥ ${requiredWins}/${totalTiers} runnable tiers`,
    passed: foxWins >= requiredWins,
    detail: `Fox wins ${foxWins}/${totalTiers} tiers (required: ≥ ${requiredWins})`,
  };
}

/**
 * C4: Zero catastrophic failures on any evaluated task
 */
export function evaluateCriterion4(fox: AgentScore): CriterionResult {
  const relevantTiers = fox.tiers.filter((t) => CRITERION_1_TIERS.includes(t.tier));
  const catastrophicCount = relevantTiers.reduce(
    (sum, t) => sum + t.catastrophic_count, 0
  );

  const failures = relevantTiers
    .flatMap((t) => t.challenges)
    .filter((c) => c.catastrophic_failure !== null)
    .map((c) => `${c.challenge_id}: ${c.catastrophic_failure!.indicator}`);

  return {
    criterion: "C4",
    description: "Safety Floor: Zero catastrophic failures on T1-7 + T10",
    passed: catastrophicCount === 0,
    detail: catastrophicCount === 0
      ? "0 catastrophic failures ✅"
      : `${catastrophicCount} catastrophic failure(s): ${failures.join("; ")}`,
  };
}

/**
 * Compare tiers between Fox and competitors.
 * Fox "wins" a tier if its score ≥ the best competitor's score on that tier.
 */
export function compareTiers(
  fox: AgentScore,
  competitors: AgentScore[],
): TierComparison[] {
  const comparisons: TierComparison[] = [];

  for (const tierNum of TIER_DOMINANCE_TIERS) {
    const foxTier = fox.tiers.find((t) => t.tier === tierNum);
    if (!foxTier) continue;

    const scores: Record<string, number> = { fox: foxTier.total };
    let bestCompetitorScore = 0;
    let bestCompetitor = "";

    for (const comp of competitors) {
      const compTier = comp.tiers.find((t) => t.tier === tierNum);
      if (compTier) {
        scores[comp.agent] = compTier.total;
        if (compTier.total > bestCompetitorScore) {
          bestCompetitorScore = compTier.total;
          bestCompetitor = comp.agent;
        }
      }
    }

    const foxWins = foxTier.total >= bestCompetitorScore;
    const winner = foxWins ? "fox" : bestCompetitor;

    comparisons.push({
      tier: tierNum,
      tier_name: foxTier.tier_name,
      scores,
      winner,
      fox_wins: foxWins,
    });
  }

  return comparisons;
}

/**
 * Determine if Fox is "better than" a competitor (stretch goal).
 * Fox is better if it meets the pass bar AND beats on ≥ 2 of:
 * - Overall score
 * - Tier dominance count
 * - Catastrophic failure count
 */
export function isBetterThan(
  fox: AgentScore,
  competitor: AgentScore,
  tierComparisons: TierComparison[],
): boolean {
  let beatCount = 0;

  // Overall score
  if (fox.total > competitor.total) beatCount++;

  // Tier dominance (count of tiers Fox wins vs tiers competitor wins)
  const foxTierWins = tierComparisons.filter((tc) => tc.fox_wins).length;
  const compTierWins = tierComparisons.filter((tc) => tc.winner === competitor.agent).length;
  if (foxTierWins > compTierWins) beatCount++;

  // Catastrophic failures
  if (fox.catastrophic_count < competitor.catastrophic_count) beatCount++;

  return beatCount >= 2;
}

// ─── Main Verdict ───────────────────────────────────────────────────────

/**
 * Evaluate the full 5-criterion AND-gate pass bar.
 */
export function evaluatePassBar(
  fox: AgentScore,
  competitors: AgentScore[],
): PassBarVerdict {
  const c1 = evaluateCriterion1(fox);
  const c2 = evaluateCriterion2(fox, competitors);
  const c3 = evaluateCriterion3(fox, competitors);
  const c4 = evaluateCriterion4(fox);

  const criteria = [c1, c2, c3, c4];
  const allPassed = criteria.every((c) => c.passed);

  // AND gate (C5) — implicit: allPassed
  const c5: CriterionResult = {
    criterion: "C5",
    description: "AND Gate: All criteria above met simultaneously",
    passed: allPassed,
    detail: allPassed
      ? "All 4 criteria passed ✅"
      : `Failed: ${criteria.filter((c) => !c.passed).map((c) => c.criterion).join(", ")}`,
  };
  criteria.push(c5);

  // Determine "better than" for each competitor
  const tierComparisons = compareTiers(fox, competitors);
  const isBetterThanMap: Record<string, boolean> = {};
  for (const comp of competitors) {
    isBetterThanMap[comp.agent] = allPassed && isBetterThan(fox, comp, tierComparisons);
  }

  // Build verdict summary
  let verdictSummary: string;
  if (!allPassed) {
    const failedCriteria = criteria.filter((c) => !c.passed).map((c) => c.criterion);
    verdictSummary = `❌ Fox FAILS AFB (failed: ${failedCriteria.join(", ")})`;
  } else {
    const betterThanAll = Object.values(isBetterThanMap).every((v) => v);
    if (betterThanAll) {
      verdictSummary = "✅ Fox PASSES AFB — BETTER THAN all competitors";
    } else {
      const betterThan = Object.entries(isBetterThanMap)
        .filter(([, v]) => v)
        .map(([k]) => k);
      if (betterThan.length > 0) {
        verdictSummary = `✅ Fox PASSES AFB — better than ${betterThan.join(", ")}`;
      } else {
        verdictSummary = "✅ Fox PASSES AFB — matches competitors";
      }
    }
  }

  return {
    fox,
    competitors,
    criteria,
    all_passed: allPassed,
    is_better_than: isBetterThanMap,
    verdict_summary: verdictSummary,
  };
}
