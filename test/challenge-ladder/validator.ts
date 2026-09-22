/**
 * Fox Challenge Ladder — Fixture Metadata Validator
 *
 * Validates that all fixtures are well-formed before running the suite.
 * Catches silent fixture corruption: mustContain mismatches, invalid
 * workflow types, insane reduction targets, empty steps, etc.
 */
import type { ChallengeFixture, TierNumber } from "./types"
import { EXPECTED_FIXTURE_COUNTS } from "./types"

export interface ValidationError {
  readonly fixtureId: string
  readonly field: string
  readonly message: string
}

export interface ValidationResult {
  readonly valid: boolean
  readonly errors: readonly ValidationError[]
  readonly fixtureCount: number
  readonly tierCounts: Record<TierNumber, number>
}

const VALID_TOOLS = new Set(["bash", "read", "grep", "edit", "write"])
const VALID_WORKFLOWS = new Set(["swe", "data", "research", "shell", "none", "auto"])
const VALID_EXPECTED_TYPES = new Set(["invariant", "completion", "robustness", "objective"])

/**
 * Validate a single fixture for internal consistency.
 */
function validateFixture(fixture: ChallengeFixture): ValidationError[] {
  const errors: ValidationError[] = []
  const id = fixture.id

  // --- Required fields ---
  if (!id || id.length === 0) {
    errors.push({ fixtureId: id ?? "<missing>", field: "id", message: "Missing fixture id" })
  }

  if (![1, 2, 3, 4].includes(fixture.tier)) {
    errors.push({ fixtureId: id, field: "tier", message: `Invalid tier: ${fixture.tier}` })
  }

  if (!fixture.category || fixture.category.length === 0) {
    errors.push({ fixtureId: id, field: "category", message: "Missing category" })
  }

  if (!fixture.description || fixture.description.length < 10) {
    errors.push({ fixtureId: id, field: "description", message: "Description too short (< 10 chars)" })
  }

  if (typeof fixture.seed !== "number" || !Number.isFinite(fixture.seed)) {
    errors.push({ fixtureId: id, field: "seed", message: `Invalid seed: ${fixture.seed}` })
  }

  // --- Input validation ---
  if (!fixture.input) {
    errors.push({ fixtureId: id, field: "input", message: "Missing input" })
    return errors
  }

  if (!fixture.input.content || fixture.input.content.length === 0) {
    errors.push({ fixtureId: id, field: "input.content", message: "Empty input content" })
  }

  if (!VALID_TOOLS.has(fixture.input.tool)) {
    errors.push({ fixtureId: id, field: "input.tool", message: `Invalid tool: ${fixture.input.tool}` })
  }

  // Multi-step fixtures (Tier 2) must have non-empty steps
  if (fixture.input.steps) {
    if (fixture.input.steps.length === 0) {
      errors.push({ fixtureId: id, field: "input.steps", message: "Steps array is empty" })
    }
    for (let i = 0; i < fixture.input.steps.length; i++) {
      const step = fixture.input.steps[i]!
      if (!step.content || step.content.length === 0) {
        errors.push({
          fixtureId: id,
          field: `input.steps[${i}].content`,
          message: "Empty step content",
        })
      }
      if (!VALID_TOOLS.has(step.tool)) {
        errors.push({
          fixtureId: id,
          field: `input.steps[${i}].tool`,
          message: `Invalid tool: ${step.tool}`,
        })
      }
    }
  }

  // --- Expected validation ---
  if (!fixture.expected) {
    errors.push({ fixtureId: id, field: "expected", message: "Missing expected" })
    return errors
  }

  if (!VALID_EXPECTED_TYPES.has(fixture.expected.type)) {
    errors.push({
      fixtureId: id,
      field: "expected.type",
      message: `Invalid expected type: ${fixture.expected.type}`,
    })
  }

  // mustContain substrings must actually appear in the input content
  if (fixture.expected.mustContain) {
    for (const substr of fixture.expected.mustContain) {
      if (!fixture.input.content.includes(substr)) {
        // Also check steps content for multi-step fixtures
        const inSteps = fixture.input.steps?.some((s) => s.content.includes(substr)) ?? false
        const inDocs = fixture.input.documents?.some((d) => d.includes(substr)) ?? false
        const inFiles = fixture.input.files
          ? Object.values(fixture.input.files).some((f) => f.includes(substr))
          : false

        if (!inSteps && !inDocs && !inFiles) {
          errors.push({
            fixtureId: id,
            field: "expected.mustContain",
            message: `Substring not found in any input: "${substr.slice(0, 60)}${substr.length > 60 ? "..." : ""}"`,
          })
        }
      }
    }
  }

  // Workflow classification must be valid
  if (fixture.expected.workflow && !VALID_WORKFLOWS.has(fixture.expected.workflow)) {
    errors.push({
      fixtureId: id,
      field: "expected.workflow",
      message: `Invalid workflow: ${fixture.expected.workflow}`,
    })
  }

  // Reduction percentages must be sane (0–100)
  if (fixture.expected.minReductionPct !== undefined) {
    if (fixture.expected.minReductionPct < 0 || fixture.expected.minReductionPct > 100) {
      errors.push({
        fixtureId: id,
        field: "expected.minReductionPct",
        message: `Out of range: ${fixture.expected.minReductionPct} (expected 0–100)`,
      })
    }
  }

  if (fixture.expected.maxExpansionPct !== undefined) {
    if (fixture.expected.maxExpansionPct < 0 || fixture.expected.maxExpansionPct > 100) {
      errors.push({
        fixtureId: id,
        field: "expected.maxExpansionPct",
        message: `Out of range: ${fixture.expected.maxExpansionPct} (expected 0–100)`,
      })
    }
  }

  return errors
}

/**
 * Validate the entire fixture registry.
 */
export function validateFixtures(fixtures: readonly ChallengeFixture[]): ValidationResult {
  const allErrors: ValidationError[] = []
  const tierCounts: Record<TierNumber, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  const seenIds = new Set<string>()

  for (const fixture of fixtures) {
    // Duplicate ID check
    if (seenIds.has(fixture.id)) {
      allErrors.push({
        fixtureId: fixture.id,
        field: "id",
        message: "Duplicate fixture ID",
      })
    }
    seenIds.add(fixture.id)

    // Tier count
    if ([1, 2, 3, 4].includes(fixture.tier)) {
      tierCounts[fixture.tier as TierNumber]++
    }

    // Per-fixture validation
    allErrors.push(...validateFixture(fixture))
  }

  // Global count validation
  for (const tier of [1, 2, 3, 4] as TierNumber[]) {
    const expected = EXPECTED_FIXTURE_COUNTS[tier]
    const actual = tierCounts[tier]
    if (actual !== expected) {
      allErrors.push({
        fixtureId: `tier-${tier}`,
        field: "count",
        message: `Tier ${tier} has ${actual} fixtures, expected ${expected}`,
      })
    }
  }

  const totalExpected = Object.values(EXPECTED_FIXTURE_COUNTS).reduce((a, b) => a + b, 0)
  if (fixtures.length !== totalExpected) {
    allErrors.push({
      fixtureId: "global",
      field: "count",
      message: `Total fixture count is ${fixtures.length}, expected ${totalExpected}`,
    })
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    fixtureCount: fixtures.length,
    tierCounts,
  }
}
