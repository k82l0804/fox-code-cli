import { describe, expect, test } from "bun:test"
import { syntaxCheck } from "@/tool/syntax-gate"

describe("Syntax Gate", () => {
  test("returns 0 errors for valid TypeScript", async () => {
    const code = "export const x: number = 42;\nfunction foo() { return x + 1; }\n"
    const result = await syntaxCheck(code, "test.ts")
    expect(result.supported).toBe(true)
    expect(result.count).toBe(0)
  })

  test("detects syntax errors in invalid TypeScript", async () => {
    const code = "export const x: number = ;\n"
    const result = await syntaxCheck(code, "test.ts")
    expect(result.supported).toBe(true)
    expect(result.count).toBeGreaterThan(0)
    expect(result.summary).toContain("Syntax error")
  })

  test("fails open for unsupported extensions", async () => {
    const code = "This is some unstructured plain text."
    const result = await syntaxCheck(code, "notes.txt")
    expect(result.supported).toBe(false)
    expect(result.count).toBe(0)
  })

  test("compares error count accurately between pre and post code", async () => {
    const existingBroken = "const a = ;\nconst b = 2;\n"
    const stillBroken = "const a = ;\nconst b = 3;\n"
    const newlyBroken = "const a = ;\nconst b = ;\n"

    const pre = await syntaxCheck(existingBroken, "app.ts")
    const postSame = await syntaxCheck(stillBroken, "app.ts")
    const postWorse = await syntaxCheck(newlyBroken, "app.ts")

    expect(postSame.count).toBe(pre.count)
    expect(postWorse.count).toBeGreaterThan(pre.count)
  })
})
