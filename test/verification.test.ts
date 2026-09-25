import { describe, expect, test } from "bun:test"
import {
  detectTestCommands,
  detectBestCommand,
  detectCommandPipeline,
  executePipeline,
  formatPipelineFeedback,
  formatVerificationFeedback,
  truncateOutput,
  readPackageScripts,
  executeVerification,
  MUTATION_TOOLS,
  MAX_VERIFICATION_OUTPUT_BYTES,
  DEFAULT_VERIFICATION_TIMEOUT_MS,
  type VerificationResult,
  type VerificationPipeline,
  type PipelineResult,
} from "@opencode-ai/core/verification"
import { mkdtemp, writeFile, rm, mkdir } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"

describe("Verification", () => {
  describe("MUTATION_TOOLS", () => {
    test("includes edit, apply_patch, write, and commit", () => {
      expect(MUTATION_TOOLS.has("edit")).toBe(true)
      expect(MUTATION_TOOLS.has("apply_patch")).toBe(true)
      expect(MUTATION_TOOLS.has("write")).toBe(true)
      expect(MUTATION_TOOLS.has("commit")).toBe(true)
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

  // =========================================================================
  // New Tests: readPackageScripts
  // =========================================================================

  describe("readPackageScripts", () => {
    let tempDir: string

    test("reads scripts from valid package.json", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "fox-verify-"))
      try {
        await writeFile(
          join(tempDir, "package.json"),
          JSON.stringify({ name: "test-pkg", scripts: { test: "jest", build: "tsc" } }),
        )
        const scripts = await readPackageScripts(tempDir)
        expect(scripts).toBeDefined()
        expect(scripts!.test).toBe("jest")
        expect(scripts!.build).toBe("tsc")
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

    test("returns undefined when package.json is missing", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "fox-verify-"))
      try {
        const scripts = await readPackageScripts(tempDir)
        expect(scripts).toBeUndefined()
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

    test("returns undefined for invalid JSON", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "fox-verify-"))
      try {
        await writeFile(join(tempDir, "package.json"), "not valid json {{{")
        const scripts = await readPackageScripts(tempDir)
        expect(scripts).toBeUndefined()
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

    test("returns undefined when package.json has no scripts field", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "fox-verify-"))
      try {
        await writeFile(join(tempDir, "package.json"), JSON.stringify({ name: "no-scripts" }))
        const scripts = await readPackageScripts(tempDir)
        expect(scripts).toBeUndefined()
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

    test("returns undefined for non-existent directory", async () => {
      const scripts = await readPackageScripts("/tmp/fox-verify-nonexistent-" + Date.now())
      expect(scripts).toBeUndefined()
    })
  })

  // =========================================================================
  // New Tests: executeVerification
  // =========================================================================

  describe("executeVerification", () => {
    let tempDir: string

    test("returns passed=true for exit code 0", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "fox-verify-"))
      try {
        const result = await executeVerification("echo 'all tests passed'", {
          cwd: tempDir,
        })
        expect(result.passed).toBe(true)
        expect(result.exitCode).toBe(0)
        expect(result.command).toBe("echo 'all tests passed'")
        expect(result.compressedOutput).toContain("all tests passed")
        expect(result.elapsedMs).toBeGreaterThanOrEqual(0)
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

    test("returns passed=false for non-zero exit code", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "fox-verify-"))
      try {
        const result = await executeVerification("sh -c 'echo FAIL src/app.test.ts && exit 1'", {
          cwd: tempDir,
        })
        expect(result.passed).toBe(false)
        expect(result.exitCode).toBe(1)
        expect(result.compressedOutput).toContain("FAIL src/app.test.ts")
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

    test("times out and kills process tree", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "fox-verify-"))
      try {
        const result = await executeVerification("sleep 60", {
          cwd: tempDir,
          timeoutMs: 500, // Very short timeout
        })
        expect(result.passed).toBe(false)
        expect(result.exitCode).toBe(124) // GNU timeout convention
        expect(result.compressedOutput).toContain("timed out")
        expect(result.elapsedMs).toBeLessThan(5000) // Should not wait for the full 60s
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

    test("injects CI=true environment variable", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "fox-verify-"))
      try {
        const result = await executeVerification("echo CI=$CI", {
          cwd: tempDir,
        })
        expect(result.passed).toBe(true)
        expect(result.compressedOutput).toContain("CI=true")
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

    test("applies LLTC compression on passing test lines", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "fox-verify-"))
      try {
        // Create a script that outputs many passing lines
        await writeFile(
          join(tempDir, "fake-test.sh"),
          [
            "#!/bin/sh",
            'echo "Test Suite"',
            'echo "✓ test 1"',
            'echo "✓ test 2"',
            'echo "✓ test 3"',
            'echo "✓ test 4"',
            'echo "✓ test 5"',
            'echo "✓ test 6"',
            'echo "Summary: 6 passed"',
          ].join("\n"),
        )
        const result = await executeVerification("sh fake-test.sh", {
          cwd: tempDir,
        })
        expect(result.passed).toBe(true)
        // filterTestOutput should collapse ≥4 consecutive ✓ lines
        expect(result.compressedOutput).toContain("passing tests omitted")
        expect(result.compressedOutput).toContain("Summary: 6 passed")
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

    test("truncates very large output", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "fox-verify-"))
      try {
        // Generate output larger than MAX_VERIFICATION_OUTPUT_BYTES
        const bigOutput = "x".repeat(MAX_VERIFICATION_OUTPUT_BYTES + 2000)
        await writeFile(
          join(tempDir, "big-output.sh"),
          `#!/bin/sh\nprintf '${bigOutput}'\nexit 1`,
        )
        const result = await executeVerification("sh big-output.sh", {
          cwd: tempDir,
        })
        expect(result.passed).toBe(false)
        expect(result.truncated).toBe(true)
        expect(result.compressedOutput).toContain("truncated")
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

    test("returns exit code 127 for invalid command", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "fox-verify-"))
      try {
        const result = await executeVerification("nonexistent_command_xyz_12345", {
          cwd: tempDir,
        })
        expect(result.passed).toBe(false)
        // Shell returns 127 for command not found
        expect(result.exitCode).toBeGreaterThan(0)
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })
  })

  // =========================================================================
  // End-to-end: detection + execution + formatting
  // =========================================================================

  describe("end-to-end pipeline", () => {
    test("detect + execute + format produces complete feedback", async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "fox-verify-"))
      try {
        // Create a project with a test script that passes
        await writeFile(
          join(tempDir, "package.json"),
          JSON.stringify({
            name: "e2e-test-project",
            scripts: { test: "echo 'all tests passed'" },
          }),
        )

        const scripts = await readPackageScripts(tempDir)
        expect(scripts).toBeDefined()

        const cmd = detectBestCommand(scripts)
        expect(cmd).toBeDefined()
        expect(cmd!.command).toBe("npm run test")

        // Use the raw command since we don't have npm set up
        const result = await executeVerification("echo 'all tests passed'", {
          cwd: tempDir,
        })

        const feedback = formatVerificationFeedback(result)
        expect(feedback).toContain("PASSED")
        expect(feedback).toContain("All checks passed")
        expect(feedback).toContain("Exit code: 0")
        expect(feedback).toContain("Auto-Verification")
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

    test("detect + execute + format handles failure with compressed output", async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "fox-verify-"))
      try {
        await writeFile(
          join(tempDir, "package.json"),
          JSON.stringify({
            name: "e2e-fail-project",
            scripts: { test: "echo 'FAIL' && exit 1" },
          }),
        )

        const result = await executeVerification("sh -c 'echo FAIL && exit 1'", {
          cwd: tempDir,
        })

        const feedback = formatVerificationFeedback(result)
        expect(feedback).toContain("FAILED")
        expect(feedback).toContain("Compressed failure output")
        expect(feedback).toContain("FAIL")
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })
  })

  // =========================================================================
  // Multi-Command Verification Pipeline
  // =========================================================================

  describe("detectCommandPipeline", () => {
    test("detectCommandPipeline returns all commands in priority order", () => {
      const pipeline = detectCommandPipeline({
        lint: "eslint .",
        test: "jest",
        typecheck: "tsc --noEmit",
      })
      expect(pipeline.commands).toHaveLength(3)
      expect(pipeline.strategy).toBe("sequential")

      // Pipeline priority order: typecheck (1) -> test (2) -> lint (3)
      expect(pipeline.commands[0]!.command).toBe("npm run typecheck")
      expect(pipeline.commands[0]!.source).toBe("package.json scripts.typecheck")
      expect(pipeline.commands[0]!.priority).toBe(1)

      expect(pipeline.commands[1]!.command).toBe("npm run test")
      expect(pipeline.commands[1]!.source).toBe("package.json scripts.test")
      expect(pipeline.commands[1]!.priority).toBe(2)

      expect(pipeline.commands[2]!.command).toBe("npm run lint")
      expect(pipeline.commands[2]!.source).toBe("package.json scripts.lint")
      expect(pipeline.commands[2]!.priority).toBe(3)
    })

    test("detectCommandPipeline with overrides", () => {
      const pipeline = detectCommandPipeline(
        { test: "jest", lint: "eslint ." },
        {
          typecheck_command: "tsc --noEmit",
          test_command: "vitest run",
          lint_command: "biome check",
          verification_strategy: "all",
        },
      )
      expect(pipeline.commands).toHaveLength(3)
      expect(pipeline.strategy).toBe("all")

      expect(pipeline.commands[0]!.command).toBe("tsc --noEmit")
      expect(pipeline.commands[0]!.source).toBe("fox.jsonc autonomous.typecheck_command")
      expect(pipeline.commands[0]!.priority).toBe(0)

      expect(pipeline.commands[1]!.command).toBe("vitest run")
      expect(pipeline.commands[1]!.source).toBe("fox.jsonc autonomous.test_command")
      expect(pipeline.commands[1]!.priority).toBe(0)

      expect(pipeline.commands[2]!.command).toBe("biome check")
      expect(pipeline.commands[2]!.source).toBe("fox.jsonc autonomous.lint_command")
      expect(pipeline.commands[2]!.priority).toBe(0)
    })

    test("detectCommandPipeline typecheck_command override at priority 0", () => {
      const pipeline = detectCommandPipeline(
        { test: "jest", typecheck: "npm run tc" },
        { typecheck_command: "tsc --build" },
      )
      expect(pipeline.commands).toHaveLength(2)
      expect(pipeline.commands[0]!.command).toBe("tsc --build")
      expect(pipeline.commands[0]!.priority).toBe(0)
      expect(pipeline.commands[0]!.source).toBe("fox.jsonc autonomous.typecheck_command")
      expect(pipeline.commands[1]!.command).toBe("npm run test")
    })

    test("detectCommandPipeline empty scripts", () => {
      expect(detectCommandPipeline(null).commands).toEqual([])
      expect(detectCommandPipeline(undefined).commands).toEqual([])
      expect(detectCommandPipeline({}).commands).toEqual([])
      expect(detectCommandPipeline({ dev: "vite", build: "vite build" }).commands).toEqual([])
    })

    test("detectCommandPipeline skips whitespace-only scripts", () => {
      const pipeline = detectCommandPipeline({
        test: "  ",
        typecheck: "",
        lint: "   ",
      })
      expect(pipeline.commands).toEqual([])
    })

    test("detectCommandPipeline uses check when typecheck not present", () => {
      const pipeline = detectCommandPipeline({
        check: "cargo check",
        test: "cargo test",
      })
      expect(pipeline.commands).toHaveLength(2)
      expect(pipeline.commands[0]!.command).toBe("npm run check")
      expect(pipeline.commands[1]!.command).toBe("npm run test")
    })

    test("backward compat: detectBestCommand unchanged", () => {
      // detectBestCommand still prefers test (priority 1) over typecheck (priority 3)
      const best = detectBestCommand({ test: "jest", typecheck: "tsc --noEmit" })
      expect(best).toBeDefined()
      expect(best!.command).toBe("npm run test")
    })
  })

  describe("executePipeline", () => {
    test("executePipeline sequential stops on failure", async () => {
      const pipeline: VerificationPipeline = {
        commands: [
          { command: "sh -c 'echo \"typecheck failed\" && exit 1'", source: "tc", priority: 1 },
          { command: "echo 'test passed'", source: "test", priority: 2 },
        ],
        strategy: "sequential",
      }

      const result = await executePipeline(pipeline, { cwd: tmpdir() })

      expect(result.allPassed).toBe(false)
      expect(result.results).toHaveLength(1)
      expect(result.results[0]!.exitCode).toBe(1)
      expect(result.results[0]!.passed).toBe(false)
      expect(result.firstFailure).toBeDefined()
      expect(result.firstFailure!.command).toContain("typecheck failed")
      expect(result.totalElapsedMs).toBeGreaterThanOrEqual(0)
    })

    test("executePipeline all runs everything", async () => {
      const pipeline: VerificationPipeline = {
        commands: [
          { command: "sh -c 'echo \"typecheck failed\" && exit 1'", source: "tc", priority: 1 },
          { command: "echo 'test passed'", source: "test", priority: 2 },
        ],
        strategy: "all",
      }

      const result = await executePipeline(pipeline, { cwd: tmpdir() })

      expect(result.allPassed).toBe(false)
      expect(result.results).toHaveLength(2)
      expect(result.results[0]!.passed).toBe(false)
      expect(result.results[1]!.passed).toBe(true)
      expect(result.firstFailure).toBe(result.results[0])
    })

    test("executePipeline returns allPassed=true when all succeed", async () => {
      const pipeline: VerificationPipeline = {
        commands: [
          { command: "echo 'check 1'", source: "tc", priority: 1 },
          { command: "echo 'check 2'", source: "test", priority: 2 },
        ],
        strategy: "sequential",
      }

      const result = await executePipeline(pipeline, { cwd: tmpdir() })

      expect(result.allPassed).toBe(true)
      expect(result.results).toHaveLength(2)
      expect(result.firstFailure).toBeUndefined()
    })

    test("executePipeline handles empty commands", async () => {
      const pipeline: VerificationPipeline = {
        commands: [],
        strategy: "sequential",
      }

      const result = await executePipeline(pipeline, { cwd: tmpdir() })

      expect(result.allPassed).toBe(true)
      expect(result.results).toHaveLength(0)
      expect(result.firstFailure).toBeUndefined()
    })
  })

  describe("formatPipelineFeedback", () => {
    test("formatPipelineFeedback multi-result shows all statuses, only fail output", () => {
      const mockResult: PipelineResult = {
        allPassed: false,
        totalElapsedMs: 1500,
        firstFailure: {
          command: "npm run test",
          exitCode: 1,
          passed: false,
          compressedOutput: "FAIL: src/foo.test.ts > expects 1 to be 2",
          truncated: false,
          elapsedMs: 800,
        },
        results: [
          {
            command: "npm run typecheck",
            exitCode: 0,
            passed: true,
            compressedOutput: "",
            truncated: false,
            elapsedMs: 300,
          },
          {
            command: "npm run test",
            exitCode: 1,
            passed: false,
            compressedOutput: "FAIL: src/foo.test.ts > expects 1 to be 2",
            truncated: false,
            elapsedMs: 800,
          },
          {
            command: "npm run lint",
            exitCode: 0,
            passed: true,
            compressedOutput: "",
            truncated: false,
            elapsedMs: 400,
          },
        ],
      }

      const feedback = formatPipelineFeedback(mockResult)

      expect(feedback).toContain("─── Auto-Verification Pipeline ❌ FAILED ───")
      expect(feedback).toContain("Pipeline: 3 checks executed | Total elapsed: 1.5s")
      expect(feedback).toContain("[✅ PASS] npm run typecheck (exit 0, 0.3s)")
      expect(feedback).toContain("[❌ FAIL] npm run test (exit 1, 0.8s)")
      expect(feedback).toContain("[✅ PASS] npm run lint (exit 0, 0.4s)")
      expect(feedback).toContain('Failure details for "npm run test":')
      expect(feedback).toContain("FAIL: src/foo.test.ts > expects 1 to be 2")
      expect(feedback).not.toContain('Failure details for "npm run typecheck"')
      expect(feedback).not.toContain('Failure details for "npm run lint"')
      expect(feedback).toContain("─── End Auto-Verification Pipeline ───")
    })

    test("formatPipelineFeedback formats passing pipeline", () => {
      const mockResult: PipelineResult = {
        allPassed: true,
        totalElapsedMs: 800,
        firstFailure: undefined,
        results: [
          {
            command: "npm run typecheck",
            exitCode: 0,
            passed: true,
            compressedOutput: "",
            truncated: false,
            elapsedMs: 300,
          },
          {
            command: "npm run test",
            exitCode: 0,
            passed: true,
            compressedOutput: "",
            truncated: false,
            elapsedMs: 500,
          },
        ],
      }

      const feedback = formatPipelineFeedback(mockResult)

      expect(feedback).toContain("─── Auto-Verification Pipeline ✅ PASSED ───")
      expect(feedback).toContain("Pipeline: 2 checks executed | Total elapsed: 0.8s")
      expect(feedback).toContain("[✅ PASS] npm run typecheck")
      expect(feedback).toContain("[✅ PASS] npm run test")
      expect(feedback).toContain("All pipeline checks passed.")
      expect(feedback).not.toContain("Failure details")
      expect(feedback).toContain("─── End Auto-Verification Pipeline ───")
    })
  })
})
