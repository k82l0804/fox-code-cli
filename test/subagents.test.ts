import { describe, expect, test } from "bun:test"
import { Permission } from "@/permission"
import { readOnlyBash, hardenScribe } from "@/foxcode/agent"
import PROMPT_SCOUT_LOCAL from "@/foxcode/agent/prompt-scout.txt"
import PROMPT_RUNNER from "@/foxcode/agent/prompt-runner.txt"
import PROMPT_SCRIBE from "@/foxcode/agent/prompt-scribe.txt"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

describe("Specialized Subagents (scout, runner, scribe)", () => {
  const defaults = Permission.fromConfig({})
  const user = Permission.fromConfig({})

  // Helper to query ruleset for a permission and pattern
  function findRule(ruleset: ReturnType<typeof Permission.merge>, permissionName: string, pattern = "*") {
    return ruleset.findLast(
      (r) => (r.permission === permissionName || r.permission === "*") && (r.pattern === pattern || r.pattern === "*"),
    )
  }

  // Helper to check disabled tools
  function isToolDisabled(tool: string, ruleset: ReturnType<typeof Permission.merge>): boolean {
    const disabled = Permission.disabled([tool], ruleset)
    return disabled.has(tool)
  }

  // -------------------------------------------------------------------------
  // Category 1: Scout Subagent Permissions
  // -------------------------------------------------------------------------
  describe("Scout Subagent Permissions", () => {
    const scoutPermission = Permission.merge(
      defaults,
      Permission.fromConfig({
        "*": "deny",
        read: "allow",
        grep: "allow",
        glob: "allow",
      }),
      user,
    )

    test("allows read, grep, and glob", () => {
      expect(findRule(scoutPermission, "read")?.action).toBe("allow")
      expect(findRule(scoutPermission, "grep")?.action).toBe("allow")
      expect(findRule(scoutPermission, "glob")?.action).toBe("allow")
    })

    test("denies mutating tools (edit, write, apply_patch, task, bash)", () => {
      expect(isToolDisabled("edit", scoutPermission)).toBe(true)
      expect(isToolDisabled("write", scoutPermission)).toBe(true)
      expect(isToolDisabled("apply_patch", scoutPermission)).toBe(true)
      expect(isToolDisabled("task", scoutPermission)).toBe(true)
      expect(isToolDisabled("bash", scoutPermission)).toBe(true)
    })

    test("denies bash via wildcard fallback", () => {
      const bashRule = findRule(scoutPermission, "bash")
      expect(bashRule?.action).toBe("deny")
    })
  })

  // -------------------------------------------------------------------------
  // Category 2: Runner Subagent Permissions & readOnlyBash
  // -------------------------------------------------------------------------
  describe("Runner Subagent Permissions", () => {
    const runnerPermission = Permission.merge(
      defaults,
      Permission.fromConfig({
        "*": "deny",
        bash: readOnlyBash,
        read: "allow",
        grep: "allow",
        glob: "allow",
      }),
      user,
    )

    test("allows read, grep, and glob", () => {
      expect(findRule(runnerPermission, "read")?.action).toBe("allow")
      expect(findRule(runnerPermission, "grep")?.action).toBe("allow")
      expect(findRule(runnerPermission, "glob")?.action).toBe("allow")
    })

    test("denies file edits and task delegation", () => {
      expect(isToolDisabled("edit", runnerPermission)).toBe(true)
      expect(isToolDisabled("write", runnerPermission)).toBe(true)
      expect(isToolDisabled("apply_patch", runnerPermission)).toBe(true)
      expect(isToolDisabled("task", runnerPermission)).toBe(true)
    })

    test("allows safe read-only git commands in readOnlyBash", () => {
      expect(readOnlyBash["git log *"]).toBe("allow")
      expect(readOnlyBash["git status *"]).toBe("allow")
      expect(readOnlyBash["git diff *"]).toBe("allow")
      expect(readOnlyBash["git show *"]).toBe("allow")
      expect(readOnlyBash["git branch --list *"]).toBe("allow")
    })

    test("denies mutating git commands in readOnlyBash", () => {
      expect(readOnlyBash["git *"]).toBe("deny")
      expect(readOnlyBash["*"]).toBe("deny")
    })

    test("denies shell chaining and redirection in readOnlyBash", () => {
      expect(readOnlyBash["*|*"]).toBe("deny")
      expect(readOnlyBash["*;*"]).toBe("deny")
      expect(readOnlyBash["*&*"]).toBe("deny")
      expect(readOnlyBash["*>*"]).toBe("deny")
      expect(readOnlyBash["*$(*"]).toBe("deny")
      expect(readOnlyBash["*`*"]).toBe("deny")
      expect(readOnlyBash["*\n*"]).toBe("deny")
    })

    test("denies unsafe command flags in readOnlyBash", () => {
      expect(readOnlyBash["sort -o *"]).toBe("deny")
      expect(readOnlyBash["sort *--output*"]).toBe("deny")
      expect(readOnlyBash["rg *--pre *"]).toBe("deny")
      expect(readOnlyBash["man *-P*"]).toBe("deny")
    })
  })

  // -------------------------------------------------------------------------
  // Category 3: Scribe Subagent Permissions & Hardening
  // -------------------------------------------------------------------------
  describe("Scribe Subagent Permissions", () => {
    const baseScribePermission = Permission.merge(
      defaults,
      Permission.fromConfig({
        "*": "deny",
        rewrite_file: "allow",
        write: "allow",
        read: "allow",
      }),
      user,
    )

    test("allows rewrite_file, write, and read", () => {
      expect(findRule(baseScribePermission, "rewrite_file")?.action).toBe("allow")
      expect(findRule(baseScribePermission, "write")?.action).toBe("allow")
      expect(findRule(baseScribePermission, "read")?.action).toBe("allow")
    })

    test("denies edit, apply_patch, bash, and task by default", () => {
      expect(isToolDisabled("edit", baseScribePermission)).toBe(true)
      expect(isToolDisabled("apply_patch", baseScribePermission)).toBe(true)
      expect(isToolDisabled("bash", baseScribePermission)).toBe(true)
      expect(isToolDisabled("task", baseScribePermission)).toBe(true)
    })

    test("hardenScribe prevents user config from widening edit/bash/task permissions", () => {
      // Suppose user config attempted to allow edit and bash
      const userWiden = Permission.fromConfig({
        edit: "allow",
        bash: "allow",
        task: "allow",
      })
      const widenedPermission = Permission.merge(baseScribePermission, userWiden)
      const scribeAgent = {
        name: "scribe",
        permission: widenedPermission,
        native: true,
      }

      // Apply hardening
      hardenScribe("scribe", scribeAgent, userWiden)

      // After hardening, edit, apply_patch, bash, task are denied
      expect(isToolDisabled("edit", scribeAgent.permission)).toBe(true)
      expect(isToolDisabled("apply_patch", scribeAgent.permission)).toBe(true)
      expect(isToolDisabled("bash", scribeAgent.permission)).toBe(true)
      expect(isToolDisabled("task", scribeAgent.permission)).toBe(true)
    })

    test("hardenScribe ignores non-scribe or non-native agents", () => {
      const codeAgent = {
        name: "code",
        permission: Permission.fromConfig({ edit: "allow" }),
        native: true,
      }
      hardenScribe("code", codeAgent)
      expect(findRule(codeAgent.permission, "edit")?.action).toBe("allow")

      const customScribe = {
        name: "scribe",
        permission: Permission.fromConfig({ edit: "allow" }),
        native: false,
      }
      hardenScribe("scribe", customScribe)
      expect(findRule(customScribe.permission, "edit")?.action).toBe("allow")
    })
  })

  // -------------------------------------------------------------------------
  // Category 4: Subagent Prompts Verification
  // -------------------------------------------------------------------------
  describe("Subagent Prompts", () => {
    test("scout prompt defines read-only research role", () => {
      expect(PROMPT_SCOUT_LOCAL).toContain("You are `scout`")
      expect(PROMPT_SCOUT_LOCAL).toContain("read-only codebase research")
      expect(PROMPT_SCOUT_LOCAL).toContain("Do not modify any files")
      expect(PROMPT_SCOUT_LOCAL).toContain("Do not run shell commands")
    })

    test("runner prompt defines command execution role", () => {
      expect(PROMPT_RUNNER).toContain("You are `runner`")
      expect(PROMPT_RUNNER).toContain("command execution agent for tests, builds, and linters")
      expect(PROMPT_RUNNER).toContain("Do not edit, write, or create files")
      expect(PROMPT_RUNNER).toContain("Only run commands that read or test")
    })

    test("scribe prompt defines whole-file writing role", () => {
      expect(PROMPT_SCRIBE).toContain("You are `scribe`")
      expect(PROMPT_SCRIBE).toContain("rewrite_file")
      expect(PROMPT_SCRIBE).toContain("no diffs, no patches, just complete file contents")
      expect(PROMPT_SCRIBE).toContain("Do not run shell commands")
    })
  })

  // -------------------------------------------------------------------------
  // Category 5: Agent Definitions Architecture & Collision Avoidance
  // -------------------------------------------------------------------------
  describe("Agent Definitions Architecture", () => {
    test("agent.ts contains definitions for scout, runner, scribe with mode: subagent", () => {
      const agentFile = readFileSync(resolve("src/agent/agent.ts"), "utf-8")
      expect(agentFile).toContain("scout: {")
      expect(agentFile).toContain("runner: {")
      expect(agentFile).toContain("scribe: {")

      // Verify workflow assignments
      expect(agentFile).toMatch(/scout:\s*\{[\s\S]*?workflow:\s*"research"/)
      expect(agentFile).toMatch(/runner:\s*\{[\s\S]*?workflow:\s*"research"/)
      expect(agentFile).toMatch(/scribe:\s*\{[\s\S]*?workflow:\s*"swe"/)
    })

    test("experimental scout is renamed to reference to avoid collision", () => {
      const agentFile = readFileSync(resolve("src/agent/agent.ts"), "utf-8")
      // flags.experimentalScout should define reference, not scout
      expect(agentFile).toContain("reference: {")
      expect(agentFile).toContain('name: "reference"')
      // No duplicate scout definition
      const scoutMatches = agentFile.match(/\bscout:\s*\{/g)
      expect(scoutMatches?.length).toBe(1)
    })

    test("reference subagents inherit permissions from reference agent instead of new scout", () => {
      const agentFile = readFileSync(resolve("src/agent/agent.ts"), "utf-8")
      expect(agentFile).toContain("agents.reference?.permission ?? agents.scout.permission")
    })
  })
})
