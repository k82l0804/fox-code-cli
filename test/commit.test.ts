import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { executeCommit } from "@/tool/commit"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

function runGit(args: string[], cwd: string) {
  const result = Bun.spawnSync(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    windowsHide: true,
  })
  if (result.exitCode !== 0) {
    throw new Error(`Git command failed (${args.join(" ")}): ${result.stderr.toString()}`)
  }
  return result.stdout.toString().trim()
}

describe("Commit Tool - executeCommit", () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "fox-commit-test-"))
    runGit(["init"], testDir)
    runGit(["config", "user.name", "Test User"], testDir)
    runGit(["config", "user.email", "test@example.com"], testDir)

    // Initial commit to establish HEAD
    await writeFile(join(testDir, "initial.txt"), "initial content\n")
    runGit(["add", "initial.txt"], testDir)
    runGit(["commit", "-m", "chore: initial commit"], testDir)
  })

  afterEach(async () => {
    if (testDir) {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  test("commits with provided message", async () => {
    await writeFile(join(testDir, "initial.txt"), "initial content\nupdated\n")
    const result = await executeCommit(testDir, { message: "feat: update initial" })

    expect(result.hash).toBeDefined()
    expect(result.hash).toHaveLength(40)
    expect(result.message).toBe("feat: update initial")
    expect(result.filesChanged).toBe(1)
    expect(result.insertions).toBe(1)
    expect(result.deletions).toBe(0)

    const headLog = runGit(["log", "-1", "--format=%B"], testDir)
    expect(headLog).toBe("feat: update initial")
  })

  test("commits with generated message", async () => {
    await writeFile(join(testDir, "initial.txt"), "modified line\n")
    const result = await executeCommit(
      testDir,
      {},
      {
        generateMessage: async () => "feat(test): auto-generated commit message",
      },
    )

    expect(result.hash).toBeDefined()
    expect(result.message).toBe("feat(test): auto-generated commit message")
    expect(result.filesChanged).toBe(1)

    const headLog = runGit(["log", "-1", "--format=%B"], testDir)
    expect(headLog).toBe("feat(test): auto-generated commit message")
  })

  test("stages specific files", async () => {
    await writeFile(join(testDir, "fileA.txt"), "content A\n")
    await writeFile(join(testDir, "fileB.txt"), "content B\n")

    const result = await executeCommit(testDir, {
      message: "feat: add fileA only",
      files: ["fileA.txt"],
    })

    expect(result.filesChanged).toBe(1)
    expect(result.message).toBe("feat: add fileA only")

    // fileA should be committed, fileB should remain untracked
    const status = runGit(["status", "--porcelain"], testDir)
    expect(status).toContain("?? fileB.txt")
    expect(status).not.toContain("fileA.txt")
  })

  test("errors on no changes", async () => {
    expect(executeCommit(testDir, { message: "feat: nothing" })).rejects.toThrow(
      "nothing to commit",
    )
  })

  test("amend mode", async () => {
    await writeFile(join(testDir, "initial.txt"), "change 1\n")
    const firstCommit = await executeCommit(testDir, { message: "feat: first commit" })

    await writeFile(join(testDir, "initial.txt"), "change 2\n")
    const amended = await executeCommit(testDir, {
      message: "feat: amended commit",
      amend: true,
    })

    expect(amended.message).toBe("feat: amended commit")
    // Total commits in repo should still be 2 (initial + amended)
    const commitCount = runGit(["rev-list", "--count", "HEAD"], testDir)
    expect(parseInt(commitCount, 10)).toBe(2)

    const headLog = runGit(["log", "-1", "--format=%B"], testDir)
    expect(headLog).toBe("feat: amended commit")
  })

  test("returns structured output", async () => {
    await writeFile(join(testDir, "initial.txt"), "line 1\nline 2\n")
    const result = await executeCommit(testDir, { message: "test: structured output" })

    expect(typeof result.hash).toBe("string")
    expect(result.hash.length).toBe(40)
    expect(result.message).toBe("test: structured output")
    expect(result.filesChanged).toBe(1)
    expect(result.insertions).toBeGreaterThanOrEqual(1)
    expect(typeof result.deletions).toBe("number")
  })

  test("applies message prefix from config", async () => {
    await writeFile(join(testDir, "initial.txt"), "prefix test\n")
    const result = await executeCommit(
      testDir,
      { message: "add prefix test" },
      { config: { prefix: "fox: " } },
    )

    expect(result.message).toBe("fox: add prefix test")
    const headLog = runGit(["log", "-1", "--format=%B"], testDir)
    expect(headLog).toBe("fox: add prefix test")
  })

  test("respects auto_stage: false config", async () => {
    await writeFile(join(testDir, "initial.txt"), "modified without stage\n")
    // With auto_stage false and no files staged, it should reject because nothing is staged
    expect(
      executeCommit(testDir, { message: "feat: unstaged" }, { config: { auto_stage: false } }),
    ).rejects.toThrow("nothing to commit")
  })

  test("throws error when not inside a git repo", async () => {
    const nonGitDir = await mkdtemp(join(tmpdir(), "fox-nongit-test-"))
    try {
      expect(executeCommit(nonGitDir, { message: "feat: fail" })).rejects.toThrow(
        "Not a git repository",
      )
    } finally {
      await rm(nonGitDir, { recursive: true, force: true })
    }
  })
})
