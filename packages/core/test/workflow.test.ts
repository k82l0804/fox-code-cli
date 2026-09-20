import { describe, it, expect } from "bun:test"
import {
  getWorkflowPolicy,
  WORKFLOW_POLICIES,
  rewriteGitCommand,
  truncateShellOutput,
  process as compressProcess,
  type CompressContext,
  type WorkflowType,
} from "../src/tool/compress"
import { Flag } from "../src/flag/flag"

describe("Type-Safe Workflow Profiles & Compression Policies", () => {
  const dummyCtx = (workflow?: WorkflowType): CompressContext => ({
    workspaceRoot: "/home/user/repo",
    toolName: "bash",
    workflow,
  })

  it("returns the exact policy contract for each workflow profile", () => {
    // 1. SWE: Full Fox compression stack
    const swe = getWorkflowPolicy("swe")
    expect(swe.gitRewrite).toBe(true)
    expect(swe.gitSupersede).toBe(true)
    expect(swe.diffTrim).toBe(true)
    expect(swe.lockfileCollapse).toBe(true)
    expect(swe.testFilter).toBe(true)
    expect(swe.tabular).toBe(true)
    expect(swe.shellTruncate).toBe(true)
    expect(swe.maxShellLines).toBe(200)
    expect(swe.maxShellBytes).toBe(8192)

    // 2. Data: Structured data on, Git/diff/test off, larger shell cap
    const data = getWorkflowPolicy("data")
    expect(data.gitRewrite).toBe(false)
    expect(data.gitSupersede).toBe(false)
    expect(data.diffTrim).toBe(false)
    expect(data.testFilter).toBe(false)
    expect(data.tabular).toBe(true)
    expect(data.logDedup).toBe(true)
    expect(data.shellTruncate).toBe(true)
    expect(data.maxShellLines).toBe(500)
    expect(data.maxShellBytes).toBe(32768)

    // 3. Research: Text passthrough, no git/diff mutators
    const research = getWorkflowPolicy("research")
    expect(research.gitRewrite).toBe(false)
    expect(research.gitSupersede).toBe(false)
    expect(research.diffTrim).toBe(false)
    expect(research.tabular).toBe(false)
    expect(research.shellTruncate).toBe(true)
    expect(research.maxShellLines).toBe(1000)

    // 4. Shell: Full ops fidelity, no truncation, no git rewrites
    const shell = getWorkflowPolicy("shell")
    expect(shell.gitRewrite).toBe(false)
    expect(shell.gitSupersede).toBe(false)
    expect(shell.diffTrim).toBe(false)
    expect(shell.shellTruncate).toBe(false)

    // 5. None: Safe mode, zero tool output alterations
    const none = getWorkflowPolicy("none")
    expect(none.gitRewrite).toBe(false)
    expect(none.gitSupersede).toBe(false)
    expect(none.diffTrim).toBe(false)
    expect(none.tabular).toBe(false)
    expect(none.logDedup).toBe(false)
    expect(none.pathNormalize).toBe(false)
    expect(none.shellTruncate).toBe(false)

    // 6. Auto: Maps to SWE policy
    const auto = getWorkflowPolicy("auto")
    expect(auto).toEqual(WORKFLOW_POLICIES.swe)
  })

  it("defaults to 'swe' when no workflow is specified", () => {
    const policy = getWorkflowPolicy(undefined)
    expect(policy).toEqual(WORKFLOW_POLICIES.swe)
  })

  it("rewriteGitCommand respects workflow policy", () => {
    // In SWE & Auto workflows: git commands are rewritten
    expect(rewriteGitCommand("git status", { workflow: "swe", enabled: true })).toBe("git status -sb")
    expect(rewriteGitCommand("git diff", { workflow: "swe", enabled: true })).toBe("git diff -U1")
    expect(rewriteGitCommand("git status", { workflow: "auto", enabled: true })).toBe("git status -sb")

    // In data, research, shell, none workflows: git commands are untouched
    expect(rewriteGitCommand("git status", { workflow: "data", enabled: true })).toBe("git status")
    expect(rewriteGitCommand("git diff", { workflow: "research", enabled: true })).toBe("git diff")
    expect(rewriteGitCommand("git status", { workflow: "shell", enabled: true })).toBe("git status")
    expect(rewriteGitCommand("git diff", { workflow: "none", enabled: true })).toBe("git diff")
  })

  it("truncateShellOutput respects workflow policy", () => {
    const lines = Array.from({ length: 300 }, (_, i) => `line ${i + 1}`).join("\n")

    // SWE truncates at 200 lines
    const sweResult = truncateShellOutput(lines, { workflow: "swe" })
    expect(sweResult.truncated).toBe(true)
    expect(sweResult.output).toContain("bytes truncated")

    // Shell workflow disables truncation
    const shellResult = truncateShellOutput(lines, { workflow: "shell" })
    expect(shellResult.truncated).toBe(false)
    expect(shellResult.output).toBe(lines)

    // None workflow disables truncation
    const noneResult = truncateShellOutput(lines, { workflow: "none" })
    expect(noneResult.truncated).toBe(false)
    expect(noneResult.output).toBe(lines)
  })

  it("process() respects workflow policy for structured data", () => {
    const prev = process.env.FOX_EXPERIMENTAL_COMPRESS
    process.env.FOX_EXPERIMENTAL_COMPRESS = "true"

    try {
      const items = Array.from({ length: 10 }, (_, i) => ({
        user_identification_number: 1000 + i,
        customer_full_legal_name: `Customer Name Number ${i}`,
        department_billing_code: `DEPT-CORP-${i}`,
      }))
      const jsonArray = JSON.stringify(items)

      // Data workflow compresses tabular JSON
      const dataCtx = dummyCtx("data")
      const dataResult = compressProcess(jsonArray, dataCtx)
      expect(dataResult.length).toBeLessThan(jsonArray.length)

      // Research workflow does not compress tabular JSON
      const researchCtx = dummyCtx("research")
      const researchResult = compressProcess(jsonArray, researchCtx)
      expect(researchResult).toBe(jsonArray)

      // None workflow does not compress tabular JSON
      const noneCtx = dummyCtx("none")
      const noneResult = compressProcess(jsonArray, noneCtx)
      expect(noneResult).toBe(jsonArray)
    } finally {
      if (prev !== undefined) process.env.FOX_EXPERIMENTAL_COMPRESS = prev
      else delete process.env.FOX_EXPERIMENTAL_COMPRESS
    }
  })
})
