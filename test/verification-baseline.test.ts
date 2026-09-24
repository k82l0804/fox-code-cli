import { describe, expect, test } from "bun:test"
import {
  captureBaseline,
  analyzeRegressions,
  formatRegressionFeedback,
  hashFailureOutput,
  type BaselineSnapshot,
} from "@opencode-ai/core/verification-baseline"
import type { PipelineResult, VerificationResult } from "@opencode-ai/core/verification"

describe("verification-baseline", () => {
  const makeResult = (
    command: string,
    passed: boolean,
    exitCode = passed ? 0 : 1,
    compressedOutput = passed ? "All passed" : "Error in suite",
  ): VerificationResult => ({
    command,
    passed,
    exitCode,
    compressedOutput,
    truncated: false,
    elapsedMs: 100,
  })

  const makePipelineResult = (results: VerificationResult[]): PipelineResult => ({
    results,
    allPassed: results.every((r) => r.passed),
    firstFailure: results.find((r) => !r.passed),
    totalElapsedMs: results.reduce((acc, r) => acc + r.elapsedMs, 0),
  })

  test("1. baseline capture produces correct BaselineSnapshot", () => {
    const pipelineResult = makePipelineResult([
      makeResult("bun run typecheck", true),
      makeResult("bun test", false, 1, "FAIL: test 1"),
      makeResult("bun run lint", true),
    ])

    const baseline = captureBaseline(pipelineResult)
    expect(baseline.allPassed).toBe(false)
    expect(baseline.results.length).toBe(3)
    expect(baseline.results[0].command).toBe("bun run typecheck")
    expect(baseline.results[0].passed).toBe(true)
    expect(baseline.results[0].failureHash).toBeUndefined()

    expect(baseline.results[1].command).toBe("bun test")
    expect(baseline.results[1].passed).toBe(false)
    expect(baseline.results[1].failureHash).toBeDefined()
    expect(baseline.results[1].failureHash?.length).toBe(16)
  })

  test("2. all-passing baseline produces allPassed: true", () => {
    const pipelineResult = makePipelineResult([
      makeResult("bun run typecheck", true),
      makeResult("bun test", true),
    ])

    const baseline = captureBaseline(pipelineResult)
    expect(baseline.allPassed).toBe(true)
    expect(baseline.results.every((r) => r.passed)).toBe(true)
  })

  test("3. new regression detection: baseline passing, current failing", () => {
    const baseline = captureBaseline(
      makePipelineResult([makeResult("bun run typecheck", true)]),
    )
    const current = makePipelineResult([
      makeResult("bun run typecheck", false, 2, "TS2322: Type error"),
    ])

    const analysis = analyzeRegressions(baseline, current)
    expect(analysis.hasNewRegressions).toBe(true)
    expect(analysis.newRegressions.length).toBe(1)
    expect(analysis.newRegressions[0].command).toBe("bun run typecheck")
    expect(analysis.newRegressions[0].baselineExitCode).toBe(0)
    expect(analysis.newRegressions[0].currentExitCode).toBe(2)
    expect(analysis.preExisting.length).toBe(0)
    expect(analysis.newFixes.length).toBe(0)
  })

  test("4. pre-existing classification: same output produces sameFailure: true", () => {
    const baseline = captureBaseline(
      makePipelineResult([makeResult("bun test", false, 1, "FAIL: auth test broken")]),
    )
    const current = makePipelineResult([
      makeResult("bun test", false, 1, "FAIL: auth test broken"),
    ])

    const analysis = analyzeRegressions(baseline, current)
    expect(analysis.hasNewRegressions).toBe(false)
    expect(analysis.newRegressions.length).toBe(0)
    expect(analysis.preExisting.length).toBe(1)
    expect(analysis.preExisting[0].command).toBe("bun test")
    expect(analysis.preExisting[0].sameFailure).toBe(true)
  })

  test("5. pre-existing with different output produces sameFailure: false", () => {
    const baseline = captureBaseline(
      makePipelineResult([makeResult("bun test", false, 1, "FAIL: error A")]),
    )
    const current = makePipelineResult([
      makeResult("bun test", false, 1, "FAIL: error B completely different"),
    ])

    const analysis = analyzeRegressions(baseline, current)
    expect(analysis.hasNewRegressions).toBe(false)
    expect(analysis.preExisting.length).toBe(1)
    expect(analysis.preExisting[0].sameFailure).toBe(false)
  })

  test("6. fix detection: baseline failing, current passing", () => {
    const baseline = captureBaseline(
      makePipelineResult([makeResult("bun run lint", false, 1, "Lint errors found")]),
    )
    const current = makePipelineResult([
      makeResult("bun run lint", true, 0, "No lint errors"),
    ])

    const analysis = analyzeRegressions(baseline, current)
    expect(analysis.hasNewRegressions).toBe(false)
    expect(analysis.newFixes.length).toBe(1)
    expect(analysis.newFixes[0]).toBe("bun run lint")
  })

  test("7. mixed scenario: 1 new regression + 1 pre-existing + 1 fix", () => {
    const baseline = captureBaseline(
      makePipelineResult([
        makeResult("cmd:typecheck", true),
        makeResult("cmd:test", false, 1, "Test failed"),
        makeResult("cmd:lint", false, 1, "Lint failed"),
      ]),
    )
    const current = makePipelineResult([
      makeResult("cmd:typecheck", false, 1, "Type error"),
      makeResult("cmd:test", false, 1, "Test failed"),
      makeResult("cmd:lint", true, 0, "Lint passed"),
    ])

    const analysis = analyzeRegressions(baseline, current)
    expect(analysis.hasNewRegressions).toBe(true)
    expect(analysis.newRegressions.length).toBe(1)
    expect(analysis.preExisting.length).toBe(1)
    expect(analysis.newFixes.length).toBe(1)
    expect(analysis.summary).toBe("1 new regression, 1 pre-existing failure, 1 fix")
  })

  test("8. failure hash stability", () => {
    const hash1 = hashFailureOutput("same error message")
    const hash2 = hashFailureOutput("same error message")
    const hash3 = hashFailureOutput("different error message")

    expect(hash1).toBe(hash2)
    expect(hash1).not.toBe(hash3)
  })

  test("9. feedback formatting produces expected emoji and sections", () => {
    const baseline = captureBaseline(
      makePipelineResult([
        makeResult("npm run typecheck", true),
        makeResult("npm run test", false, 1, "test failed"),
        makeResult("npm run lint", false, 1, "lint failed"),
      ]),
    )
    const current = makePipelineResult([
      makeResult("npm run typecheck", false, 1, "syntax error"),
      makeResult("npm run test", false, 1, "test failed"),
      makeResult("npm run lint", true, 0, "clean"),
    ])

    const analysis = analyzeRegressions(baseline, current)
    const feedback = formatRegressionFeedback(analysis)

    expect(feedback).toContain("─── Regression Analysis ───")
    expect(feedback).toContain("🆕 NEW REGRESSIONS (agent-introduced):")
    expect(feedback).toContain("[❌ NEW] npm run typecheck (was ✅ passing, now exit 1)")
    expect(feedback).toContain("📋 PRE-EXISTING (not caused by this edit):")
    expect(feedback).toContain("[⚠️ PRE] npm run test (was ❌ failing, still ❌ failing, same output)")
    expect(feedback).toContain("✅ FIXED BY THIS EDIT:")
    expect(feedback).toContain("[🔧 FIX] npm run lint (was ❌ failing, now ✅ passing)")
    expect(feedback).toContain("Summary: 1 new regression, 1 pre-existing failure, 1 fix")
    expect(feedback).toContain("─── End Regression Analysis ───")
  })

  test("10. feedback formatting returns empty string when clean and no changes", () => {
    const baseline = captureBaseline(
      makePipelineResult([makeResult("bun test", true)]),
    )
    const current = makePipelineResult([
      makeResult("bun test", true),
    ])

    const analysis = analyzeRegressions(baseline, current)
    const feedback = formatRegressionFeedback(analysis)
    expect(feedback).toBe("")
  })
})
