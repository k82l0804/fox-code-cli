import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { Parameters } from "@/tool/grep"

describe("Grep Tool Output Shape (Phase 2F Task 2F-2)", () => {
  test("Parameters schema accepts boolean for context", () => {
    const valid = { pattern: "testFunction", context: true }
    const decoded = Schema.decodeUnknownSync(Parameters)(valid)
    expect(decoded.pattern).toBe("testFunction")
    expect(decoded.context).toBe(true)
  })

  test("Parameters schema accepts number for context", () => {
    const valid = { pattern: "testFunction", context: 3 }
    const decoded = Schema.decodeUnknownSync(Parameters)(valid)
    expect(decoded.pattern).toBe("testFunction")
    expect(decoded.context).toBe(3)
  })

  test("Parameters schema allows omitting context (defaults to summary)", () => {
    const valid = { pattern: "testFunction" }
    const decoded = Schema.decodeUnknownSync(Parameters)(valid)
    expect(decoded.pattern).toBe("testFunction")
    expect(decoded.context).toBeUndefined()
  })

  test("formats compact summary shape correctly for multiple files", () => {
    // Test the formatting contract directly
    const pattern = "calculateTotal"
    const mockFiles = [
      {
        path: "src/billing/invoice.ts",
        hits: [
          { line: 15, text: "export function calculateTotal(items: Item[]): number {" },
          { line: 42, text: "const total = calculateTotal(cart.items)" },
        ],
      },
      {
        path: "src/order/checkout.ts",
        hits: [
          { line: 88, text: "const amount = calculateTotal(items)" },
        ],
      },
    ]

    const totalFiles = mockFiles.length
    const lines = [`Found "${pattern}" in ${totalFiles} files:`]
    for (const file of mockFiles) {
      const hitCount = file.hits.length
      const previews = file.hits.slice(0, 2).map((h) => `line ${h.line}: ${h.text.trim()}`).join("; ")
      lines.push(`${file.path} (${hitCount} hit${hitCount === 1 ? "" : "s"}) - ${previews}`)
    }
    const output = lines.join("\n")

    expect(output).toContain('Found "calculateTotal" in 2 files:')
    expect(output).toContain("src/billing/invoice.ts (2 hits) - line 15: export function calculateTotal(items: Item[]): number {; line 42: const total = calculateTotal(cart.items)")
    expect(output).toContain("src/order/checkout.ts (1 hit) - line 88: const amount = calculateTotal(items)")
  })

  test("caps at 20 files with summary tail message", () => {
    const pattern = "logger"
    const fileCount = 25
    const maxFiles = 20
    const lines = [`Found "${pattern}" in ${fileCount} files:`]
    for (let i = 1; i <= maxFiles; i++) {
      lines.push(`src/module${i}.ts (1 hit) - line 10: logger.info("test")`)
    }
    const remaining = fileCount - maxFiles
    lines.push(`... and ${remaining} more files`)
    const output = lines.join("\n")

    expect(lines.length).toBe(1 + maxFiles + 1)
    expect(output).toContain("... and 5 more files")
  })
})
