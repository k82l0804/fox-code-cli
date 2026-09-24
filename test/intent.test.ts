import { describe, expect, test } from "bun:test"
import {
  classifyIntent,
  detectIntent,
  detectScope,
  tierForScopeAndIntent,
  type TaskIntent,
  type TaskScope,
} from "@/foxcode/intent"

describe("intent-detection", () => {
  test("1. fix intent detection: 'fix the failing test in auth.ts' -> fix / single", () => {
    const result = classifyIntent({
      message: "fix the failing test in auth.ts",
    })
    expect(result.intent).toBe("fix")
    expect(result.scope).toBe("single")
    expect(result.suggestedMinTier).toBe("B")
    expect(result.needsWriteTools).toBe(true)
  })

  test("2. feature intent detection: 'implement a new caching layer' -> feature / multi", () => {
    const result = classifyIntent({
      message: "implement a new caching layer",
    })
    expect(result.intent).toBe("feature")
    expect(result.scope).toBe("multi")
    expect(result.suggestedMinTier).toBe("B")
    expect(result.needsWriteTools).toBe(true)
  })

  test("3. research intent detection: 'explain how the provider system works' -> research / unknown", () => {
    const result = classifyIntent({
      message: "explain how the provider system works",
    })
    expect(result.intent).toBe("research")
    expect(result.scope).toBe("unknown")
    expect(result.suggestedMinTier).toBe("B")
    expect(result.needsWriteTools).toBe(false)
  })

  test("4. refactor intent detection: 'refactor the model routing across all packages' -> refactor / cross", () => {
    const result = classifyIntent({
      message: "refactor the model routing across all packages",
    })
    expect(result.intent).toBe("refactor")
    expect(result.scope).toBe("cross")
    expect(result.suggestedMinTier).toBe("A")
    expect(result.needsWriteTools).toBe(true)
  })

  test("5. trivial scope: 'fix the typo in README' -> fix / trivial, tier C", () => {
    const result = classifyIntent({
      message: "fix the typo in README",
    })
    expect(result.intent).toBe("fix")
    expect(result.scope).toBe("trivial")
    expect(result.suggestedMinTier).toBe("C")
    expect(result.needsWriteTools).toBe(true)
  })

  test("6. multi-file scope: 'update auth.ts, session.ts, and config.ts' -> scope multi", () => {
    const result = classifyIntent({
      message: "update auth.ts, session.ts, and config.ts",
    })
    expect(result.scope).toBe("multi")
  })

  test("7. cross-module scope: 'refactor the permission system architecture' -> scope cross, tier A", () => {
    const result = classifyIntent({
      message: "refactor the permission system architecture",
    })
    expect(result.scope).toBe("cross")
    expect(result.suggestedMinTier).toBe("A")
  })

  test("8. active file narrows scope: 'fix the bug' + activeFile='src/foo.ts' -> single", () => {
    const result = classifyIntent({
      message: "fix the bug",
      activeFile: "src/foo.ts",
    })
    expect(result.intent).toBe("fix")
    expect(result.scope).toBe("single")
  })

  test("9. confidence scaling: more signals produce higher confidence", () => {
    const low = classifyIntent({ message: "fix" })
    const high = classifyIntent({ message: "fix the broken bug and crash error in auth.ts" })
    expect(high.confidence).toBeGreaterThan(low.confidence)
  })

  test("10. unknown fallback: empty message produces unknown / unknown, tier B", () => {
    const result = classifyIntent({ message: "" })
    expect(result.intent).toBe("unknown")
    expect(result.scope).toBe("unknown")
    expect(result.suggestedMinTier).toBe("B")
    expect(result.confidence).toBe(0.3)
  })

  test("11. write-tool need: research and docs are false; fix and feature are true", () => {
    expect(classifyIntent({ message: "explain this function" }).needsWriteTools).toBe(false)
    expect(classifyIntent({ message: "document this API in jsdoc" }).needsWriteTools).toBe(false)
    expect(classifyIntent({ message: "fix this error" }).needsWriteTools).toBe(true)
    expect(classifyIntent({ message: "add a new button" }).needsWriteTools).toBe(true)
  })

  test("12. tier mapping correctness covers all combinations", () => {
    const scopes: TaskScope[] = ["trivial", "single", "multi", "cross", "unknown"]
    const intents: TaskIntent[] = ["fix", "feature", "refactor", "research", "config", "test", "docs", "unknown"]

    for (const scope of scopes) {
      for (const intent of intents) {
        const tier = tierForScopeAndIntent(scope, intent)
        if (scope === "trivial") {
          expect(tier).toBe("C")
        } else if (scope === "cross") {
          expect(tier).toBe("A")
        } else if (scope === "single" && intent === "research") {
          expect(tier).toBe("C")
        } else {
          expect(tier).toBe("B")
        }
      }
    }
  })
})
