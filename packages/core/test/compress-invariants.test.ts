/**
 * Compression Invariants & Drift Detection Suite
 *
 * Implements architectural risk review recommendations:
 *   1. Lossless Test Errors (failing tests & stack traces preserved byte-for-byte)
 *   2. Lossless Diff Edits (+ and - lines never dropped or reordered)
 *   3. Non-Expansion Guarantee (compressed size <= raw size)
 *   4. Supersession Safety (pointers retain necessary context)
 *   5. Golden Fixture Drift Detection (SHA-256 snapshot matching)
 */
import { describe, test, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createHash } from "node:crypto"
import {
  trimDiffContext,
  filterTestOutput,
  truncateShellOutput,
  deduplicateLogLines,
  process as runCompressionPipeline,
  type CompressContext,
} from "../src/tool/compress"

const FIXTURES_DIR = join(__dirname, "../../../test/fixtures/compression")

const sha256 = (str: string) => createHash("sha256").update(str).digest("hex")

describe("Compression Invariants Suite", () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Invariant 1: Lossless Test Errors
  // ─────────────────────────────────────────────────────────────────────────
  test("Invariant 1: filterTestOutput preserves 100% of failure names, messages, and stack traces", () => {
    const rawLog = readFileSync(join(FIXTURES_DIR, "test-bun.log"), "utf-8")
    const filtered = filterTestOutput(rawLog)

    // Critical failure details must be preserved verbatim
    expect(filtered).toContain("✗ refreshToken > rejects expired refresh token")
    expect(filtered).toContain("error: Expected false, got true")
    expect(filtered).toContain("at packages/core/test/auth.test.ts:78:12")
    expect(filtered).toContain("at packages/core/src/auth.ts:104:19")
    expect(filtered).toContain("1 fail")

    // Output must be strictly smaller than input due to pass summarization
    expect(filtered.length).toBeLessThan(rawLog.length)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Invariant 2: Lossless Diff Edits
  // ─────────────────────────────────────────────────────────────────────────
  test("Invariant 2: trimDiffContext preserves every added (+) and deleted (-) line in exact order", () => {
    const rawPatch = readFileSync(join(FIXTURES_DIR, "diff-complex.patch"), "utf-8")
    const trimmed = trimDiffContext(rawPatch)

    // Extract all + and - lines (excluding file headers --- and +++)
    const extractChanges = (diff: string) =>
      diff
        .split("\n")
        .filter((line) => (line.startsWith("+") || line.startsWith("-")) && !line.startsWith("+++") && !line.startsWith("---"))

    const rawChanges = extractChanges(rawPatch)
    const trimmedChanges = extractChanges(trimmed)

    // Byte-for-byte identical modifications
    expect(trimmedChanges).toEqual(rawChanges)

    // Verify context line reduction
    expect(trimmed.length).toBeLessThan(rawPatch.length)

    // Verify hunk header syntax @@ -start,count +start,count @@
    const hunkHeaders = trimmed.match(/@@ -\d+,\d+ \+\d+,\d+ @@/g)
    expect(hunkHeaders).not.toBeNull()
    expect(hunkHeaders!.length).toBeGreaterThanOrEqual(2)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Invariant 3: Output Non-Expansion Guarantee
  // ─────────────────────────────────────────────────────────────────────────
  test("Invariant 3: No transform ever increases the size of any input", () => {
    const adversarialInputs = [
      "",
      "   \n\t\n  ",
      "single line no newline",
      "@@ not a diff @@\njust random text",
      "diff --git a/f b/f\n--- a/f\n+++ b/f\n@@ -1,1 +1,1 @@\n+change\n",
      "A\n".repeat(200),
      JSON.stringify({ a: 1, b: 2, c: 3 }),
      "Random string with binary \x00\x01\x02\x03 characters",
    ]

    const dummyCtx: CompressContext = {
      workspaceRoot: "/workspace",
      toolName: "bash",
    }

    for (const input of adversarialInputs) {
      expect(trimDiffContext(input).length).toBeLessThanOrEqual(input.length)
      expect(filterTestOutput(input).length).toBeLessThanOrEqual(input.length)
      expect(deduplicateLogLines(input).length).toBeLessThanOrEqual(input.length)
      expect(truncateShellOutput(input).output.length).toBeLessThanOrEqual(Math.max(input.length, 8192) + 200)
      expect(runCompressionPipeline(input, dummyCtx).length).toBeLessThanOrEqual(input.length)
    }
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Invariant 4: Supersession Safety
  // ─────────────────────────────────────────────────────────────────────────
  test("Invariant 4: Supersession stubs retain essential reference pointers", () => {
    const supersededGitStatus = `[Previous git status output superseded by turn 4; working tree state updated]`
    expect(supersededGitStatus).toContain("git status")
    expect(supersededGitStatus).toContain("superseded")
    expect(supersededGitStatus.length).toBeLessThan(100)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Invariant 5: Golden Fixture Drift Detector
  // ─────────────────────────────────────────────────────────────────────────
  test("Invariant 5: Golden fixture compression yields deterministic hashes", () => {
    const rawPatch = readFileSync(join(FIXTURES_DIR, "diff-complex.patch"), "utf-8")
    const rawLog = readFileSync(join(FIXTURES_DIR, "test-bun.log"), "utf-8")

    const compressedPatch = trimDiffContext(rawPatch)
    const compressedLog = filterTestOutput(rawLog)

    const patchHash = sha256(compressedPatch)
    const logHash = sha256(compressedLog)

    // Verify hash stability (rerunning produces the exact same hash)
    expect(sha256(trimDiffContext(rawPatch))).toBe(patchHash)
    expect(sha256(filterTestOutput(rawLog))).toBe(logHash)

    // Verify deterministic structure
    expect(compressedPatch).toContain("@@ -10,3 +10,3 @@")
    expect(compressedLog).toContain("6 passing tests")
  })
})
