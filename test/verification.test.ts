import { describe, expect, test } from "bun:test"
import {
  detectTestCommands,
  detectBestCommand,
  formatVerificationFeedback,
  truncateOutput,
  MUTATION_TOOLS,
  MAX_VERIFICATION_OUTPUT_BYTES,
  type VerificationResult,
} from "@opencode-ai/core/verification"

describe("Verification", () => {
  describe("MUTATION_TOOLS", () => {
    test("includes edit, apply_patch, and write", () => {
      expect(MUTATION_TOOLS.has("edit")).toBe(true)
      expect(MUTATION_TOOLS.has("apply_patch")).toBe(true)
      expect(MUTATION_TOOLS.has("write")).toBe(true)
    })

    test("does NOT include read-only tools", () => {
      expect(MUTATION_TOOLS.has("read")).toBe(false)
      expect(MUTATION_TOOLS.has("grep")).toBe(false)
      expect(MUTATION_TOOLS.has("glob")).toBe(false)
      expect(MUTATION_TOOLS.has("bash")).toBe(false)
    })
  })

  describe("detectTestCommands", () => {
    test("returns empty array for null/undefined scripts", () => {
      expect(detectTestCommands(null)).toEqual([])
      expect(detectTestCommands(undefined)).toEqual([])
    })

    test("returns empty array for empty scripts", () => {
      expect(detectTestCommands({})).toEqual([])
    })

    test("detects test script", () => {
      const commands = detectTestCommands({ test: "jest" })
      expect(commands).toHaveLength(1)
      expect(commands[0]!.command).toBe("npm run test")
      expect(commands[0]!.source).toContain("package.json")
    })

    test("detects multiple test scripts in priority order", () => {
      const commands = detectTestCommands({
        lint: "eslint .",
        test: "jest",
        typecheck: "tsc --noEmit",
      })
      expect(commands).toHaveLength(3)
      // Priority order: test (1) < typecheck (3) < lint (7)
      expect(commands[0]!.command).toBe("npm run test")
      expect(commands[1]!.command).toBe("npm run typecheck")
      expect(commands[2]!.command).toBe("npm run lint")
    })

    test("skips empty/whitespace-only scripts", () => {
      const commands = detectTestCommands({ test: "", typecheck: "   " })
      expect(commands).toEqual([])
    })

    test("ignores non-test scripts", () => {
      const commands = detectTestCommands({
        dev: "vite",
        build: "vite build",
        start: "node dist/index.js",
      })
      expect(commands).toEqual([])
    })
  })

  describe("detectBestCommand", () => {
    test("returns user override when provided", () => {
      const cmd = detectBestCommand({ test: "jest" }, "custom-test-runner")
      expect(cmd).toBeDefined()
      expect(cmd!.command).toBe("custom-test-runner")
      expect(cmd!.source).toContain("fox.jsonc")
      expect(cmd!.priority).toBe(0)
    })

    test("falls back to auto-detection when no override", () => {
      const cmd = detectBestCommand({ test: "jest", typecheck: "tsc --noEmit" })
      expect(cmd).toBeDefined()
      expect(cmd!.command).toBe("npm run test")
    })

    test("returns undefined when no commands detected and no override", () => {
      const cmd = detectBestCommand({ dev: "vite" })
      expect(cmd).toBeUndefined()
    })

    test("ignores empty/null override", () => {
      const cmd = detectBestCommand({ test: "jest" }, "")
      expect(cmd).toBeDefined()
      expect(cmd!.command).toBe("npm run test")

      const cmd2 = detectBestCommand({ test: "jest" }, null)
      expect(cmd2).toBeDefined()
      expect(cmd2!.command).toBe("npm run test")
    })
  })

  describe("formatVerificationFeedback", () => {
    test("formats passing result", () => {
      const result: VerificationResult = {
        passed: true,
        exitCode: 0,
        command: "npm run test",
        compressedOutput: "",
        truncated: false,
        elapsedMs: 2500,
      }
      const output = formatVerificationFeedback(result)
      expect(output).toContain("PASSED")
      expect(output).toContain("npm run test")
      expect(output).toContain("Exit code: 0")
      expect(output).toContain("2.5s")
      expect(output).toContain("All checks passed")
    })

    test("formats failing result with compressed output", () => {
      const result: VerificationResult = {
        passed: false,
        exitCode: 1,
        command: "npm run test",
        compressedOutput: "FAIL src/app.test.ts\n  ✗ should render correctly\n    Expected: true\n    Received: false",
        truncated: false,
        elapsedMs: 5200,
      }
      const output = formatVerificationFeedback(result)
      expect(output).toContain("FAILED")
      expect(output).toContain("Exit code: 1")
      expect(output).toContain("5.2s")
      expect(output).toContain("FAIL src/app.test.ts")
      expect(output).toContain("Compressed failure output")
    })

    test("includes truncation notice", () => {
      const result: VerificationResult = {
        passed: false,
        exitCode: 1,
        command: "npm run test",
        compressedOutput: "truncated output...",
        truncated: true,
        elapsedMs: 1000,
      }
      const output = formatVerificationFeedback(result)
      expect(output).toContain("[output truncated]")
    })
  })

  describe("truncateOutput", () => {
    test("returns unchanged output within limit", () => {
      const input = "short output"
      const { output, truncated } = truncateOutput(input)
      expect(output).toBe(input)
      expect(truncated).toBe(false)
    })

    test("truncates large output keeping the tail", () => {
      const longOutput = "x".repeat(MAX_VERIFICATION_OUTPUT_BYTES + 1000)
      const { output, truncated } = truncateOutput(longOutput)
      expect(truncated).toBe(true)
      expect(Buffer.byteLength(output, "utf8")).toBeLessThanOrEqual(MAX_VERIFICATION_OUTPUT_BYTES + 100) // Allow header overhead
      expect(output).toContain("truncated")
    })

    test("respects custom maxBytes", () => {
      const input = "a".repeat(200)
      const { output, truncated } = truncateOutput(input, 50)
      expect(truncated).toBe(true)
      // The tail should be approximately 50 bytes
      expect(output).toContain("truncated")
    })

    test("handles empty string", () => {
      const { output, truncated } = truncateOutput("")
      expect(output).toBe("")
      expect(truncated).toBe(false)
    })
  })
})
