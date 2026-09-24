import { describe, expect, test } from "bun:test"
import { computeConfidence, Severity, type ConfidenceInput } from "@/foxcode/lsp-confidence"
import type { Diagnostic } from "vscode-languageserver-types"

describe("lsp-confidence", () => {
  const makeDiag = (
    severity: number | undefined,
    message = "diagnostic message",
    source = "eslint",
  ): Diagnostic => ({
    severity: severity as any,
    message,
    source,
    range: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 10 },
    },
  })

  test("1. clean edit: 0 errors before, 0 errors after produces score 1.0, label high", () => {
    const result = computeConfidence({
      before: [],
      after: [],
      filePath: "src/foo.ts",
    })
    expect(result.score).toBe(1.0)
    expect(result.label).toBe("high")
    expect(result.newErrors).toBe(0)
    expect(result.fixedErrors).toBe(0)
    expect(result.netDelta).toBe(0)
    expect(result.summary).toBe("Edit confidence: high (100%) — no new diagnostics")
  })

  test("2. single new error: 0 before, 1 error after produces score 0.75, label medium", () => {
    const result = computeConfidence({
      before: [],
      after: [makeDiag(Severity.Error, "Generic syntax error", "unknown-linter")],
      filePath: "src/foo.ts",
    })
    expect(result.score).toBe(0.75)
    expect(result.label).toBe("medium")
    expect(result.newErrors).toBe(1)
    expect(result.fixedErrors).toBe(0)
    expect(result.summary).toContain("+1 error")
  })

  test("3. multiple new errors: 0 before, 4 errors after produces score 0.0, label critical", () => {
    const result = computeConfidence({
      before: [],
      after: [
        makeDiag(Severity.Error, "err 1"),
        makeDiag(Severity.Error, "err 2"),
        makeDiag(Severity.Error, "err 3"),
        makeDiag(Severity.Error, "err 4"),
      ],
      filePath: "src/foo.ts",
    })
    expect(result.score).toBe(0.0)
    expect(result.label).toBe("critical")
    expect(result.newErrors).toBe(4)
    expect(result.summary).toContain("+4 errors")
  })

  test("4. error fixed: 2 errors before, 1 after produces fixedErrors: 1 and high confidence", () => {
    const result = computeConfidence({
      before: [makeDiag(Severity.Error, "err 1"), makeDiag(Severity.Error, "err 2")],
      after: [makeDiag(Severity.Error, "err 1")],
      filePath: "src/foo.ts",
    })
    expect(result.score).toBe(1.0)
    expect(result.label).toBe("high")
    expect(result.newErrors).toBe(0)
    expect(result.fixedErrors).toBe(1)
    expect(result.summary).toContain("-1 error fixed")
  })

  test("5. all errors fixed: 3 errors before, 0 after produces score 1.0, fixedErrors: 3", () => {
    const result = computeConfidence({
      before: [
        makeDiag(Severity.Error, "err 1"),
        makeDiag(Severity.Error, "err 2"),
        makeDiag(Severity.Error, "err 3"),
      ],
      after: [],
      filePath: "src/foo.ts",
    })
    expect(result.score).toBe(1.0)
    expect(result.fixedErrors).toBe(3)
    expect(result.summary).toContain("-3 errors fixed")
  })

  test("6. pre-existing errors unchanged: 5 before, 5 after produces score 1.0, netDelta 0", () => {
    const diags = [
      makeDiag(Severity.Error, "err 1"),
      makeDiag(Severity.Error, "err 2"),
      makeDiag(Severity.Error, "err 3"),
      makeDiag(Severity.Error, "err 4"),
      makeDiag(Severity.Error, "err 5"),
    ]
    const result = computeConfidence({
      before: diags,
      after: diags,
      filePath: "src/foo.ts",
    })
    expect(result.score).toBe(1.0)
    expect(result.netDelta).toBe(0)
    expect(result.newErrors).toBe(0)
    expect(result.fixedErrors).toBe(0)
  })

  test("7. warning impact: 0 before, 3 warnings after produces score 0.85, label medium", () => {
    const result = computeConfidence({
      before: [],
      after: [
        makeDiag(Severity.Warning, "warn 1"),
        makeDiag(Severity.Warning, "warn 2"),
        makeDiag(Severity.Warning, "warn 3"),
      ],
      filePath: "src/foo.ts",
    })
    expect(result.score).toBeCloseTo(0.85, 2)
    expect(result.label).toBe("medium")
    expect(result.summary).toContain("+3 warnings")
  })

  test("8. high-trust source: new TypeScript error adds extra penalty", () => {
    const result = computeConfidence({
      before: [],
      after: [makeDiag(Severity.Error, "TS2322", "ts")],
      filePath: "src/foo.ts",
    })
    // 0.25 (error) + 0.10 (high-trust penalty) = 0.35 penalty -> 0.65 score
    expect(result.score).toBeCloseTo(0.65, 2)
    expect(result.label).toBe("medium")
  })

  test("9. hints ignored: 0 before, 10 hints after produces score 1.0", () => {
    const hints = Array.from({ length: 10 }, (_, i) => makeDiag(Severity.Hint, `hint ${i}`))
    const result = computeConfidence({
      before: [],
      after: hints,
      filePath: "src/foo.ts",
    })
    expect(result.score).toBe(1.0)
    expect(result.label).toBe("high")
  })

  test("10. summary formatting reflects correct label, percentage, and parts", () => {
    const result = computeConfidence({
      before: [makeDiag(Severity.Error, "old err")],
      after: [makeDiag(Severity.Warning, "new warn")],
      filePath: "src/foo.ts",
    })
    // 1 fixed error (-1), 1 new warning (+0.05 penalty) -> score 0.95 (high)
    expect(result.score).toBeCloseTo(0.95, 2)
    expect(result.label).toBe("high")
    expect(result.summary).toBe("Edit confidence: high (95%) — -1 error fixed, +1 warning")
  })

  test("11. edge: empty diagnostics produces score 1.0", () => {
    const result = computeConfidence({
      before: [],
      after: [],
      filePath: "src/foo.ts",
    })
    expect(result.score).toBe(1.0)
  })

  test("12. edge: severity undefined treated as Hint without penalty", () => {
    const result = computeConfidence({
      before: [],
      after: [makeDiag(undefined, "unknown severity")],
      filePath: "src/foo.ts",
    })
    expect(result.score).toBe(1.0)
  })
})
