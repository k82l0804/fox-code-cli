import { describe, expect, test } from "bun:test"
import { FoxConfig } from "../src/foxcode/config/config"

// ─── mergeConfig ────────────────────────────────────────────────────────────

describe("mergeConfig", () => {
  test("deep merges two config objects", () => {
    const existing = { model: "claude-4", theme: "dark" } as any
    const patch = { theme: "light", newKey: "value" } as any
    const result = FoxConfig.mergeConfig(existing, patch)
    expect(result).toEqual({ model: "claude-4", theme: "light", newKey: "value" })
  })

  test("strips null delete sentinels after merge", () => {
    const existing = { model: "claude-4", theme: "dark" } as any
    const patch = { theme: null } as any
    const result = FoxConfig.mergeConfig(existing, patch)
    expect(result).not.toHaveProperty("theme")
    expect((result as any).model).toBe("claude-4")
  })

  test("promotes permission scalars to objects when patch has object", () => {
    const existing = { permission: { bash: "ask" } } as any
    const patch = { permission: { bash: { "npm *": "allow" } } } as any
    const result = FoxConfig.mergeConfig(existing, patch)
    const perm = (result as any).permission.bash
    expect(perm).toHaveProperty("*")
    expect(perm["*"]).toBe("ask")
    expect(perm["npm *"]).toBe("allow")
  })

  test("merges nested objects deeply", () => {
    const existing = { indexing: { enabled: true, provider: "local" } } as any
    const patch = { indexing: { provider: "remote" } } as any
    const result = FoxConfig.mergeConfig(existing, patch)
    expect((result as any).indexing.enabled).toBe(true)
    expect((result as any).indexing.provider).toBe("remote")
  })

  test("handles empty patch", () => {
    const existing = { model: "claude-4" } as any
    const result = FoxConfig.mergeConfig(existing, {} as any)
    expect((result as any).model).toBe("claude-4")
  })

  test("handles empty existing", () => {
    const patch = { model: "claude-4" } as any
    const result = FoxConfig.mergeConfig({} as any, patch)
    expect((result as any).model).toBe("claude-4")
  })

  test("does not mutate the patch object", () => {
    const patch = { mcp: { server1: { url: "http://localhost" } } } as any
    const patchCopy = JSON.parse(JSON.stringify(patch))
    FoxConfig.mergeConfig({} as any, patch)
    expect(patch).toEqual(patchCopy)
  })
})

// ─── mergeProject ───────────────────────────────────────────────────────────

describe("mergeProject", () => {
  test("merges without stripping nulls", () => {
    const existing = { model: "claude-4", theme: "dark" } as any
    const patch = { theme: null } as any
    const result = FoxConfig.mergeProject(existing, patch)
    // mergeProject does NOT strip nulls (clean=false)
    expect((result as any).theme).toBeNull()
  })
})

// ─── stripNulls ─────────────────────────────────────────────────────────────

describe("stripNulls", () => {
  test("removes top-level null values", () => {
    const result = FoxConfig.stripNulls({ a: 1, b: null, c: "hello" })
    expect(result).toEqual({ a: 1, c: "hello" })
  })

  test("removes nested null values recursively", () => {
    const result = FoxConfig.stripNulls({ outer: { inner: null, keep: true } })
    expect(result).toEqual({ outer: { keep: true } })
  })

  test("removes empty objects left after stripping", () => {
    const result = FoxConfig.stripNulls({ wrapper: { only: null } })
    expect(result).toEqual({})
  })

  test("handles already-clean objects", () => {
    const input = { a: 1, b: "two", c: { d: true } }
    expect(FoxConfig.stripNulls(input)).toEqual(input)
  })

  test("handles empty object", () => {
    expect(FoxConfig.stripNulls({})).toEqual({})
  })
})

// ─── unsetPaths ─────────────────────────────────────────────────────────────

describe("unsetPaths", () => {
  test("collects top-level null paths", () => {
    const result = FoxConfig.unsetPaths({ a: null, b: 1 })
    expect(result).toEqual([["a"]])
  })

  test("collects nested null paths", () => {
    const result = FoxConfig.unsetPaths({ outer: { inner: null } })
    expect(result).toEqual([["outer", "inner"]])
  })

  test("collects multiple null paths", () => {
    const result = FoxConfig.unsetPaths({ a: null, b: { c: null } })
    expect(result).toHaveLength(2)
    expect(result).toContainEqual(["a"])
    expect(result).toContainEqual(["b", "c"])
  })

  test("returns empty array for no nulls", () => {
    expect(FoxConfig.unsetPaths({ a: 1, b: "two" })).toEqual([])
  })

  test("returns empty array for non-record input", () => {
    expect(FoxConfig.unsetPaths("not an object")).toEqual([])
    expect(FoxConfig.unsetPaths(42)).toEqual([])
    expect(FoxConfig.unsetPaths(null)).toEqual([])
  })
})

// ─── isConfigDir ────────────────────────────────────────────────────────────

describe("isConfigDir", () => {
  test("recognizes .fox suffix", () => {
    expect(FoxConfig.isConfigDir("/project/.fox")).toBe(true)
  })

  test("recognizes .kilo suffix", () => {
    expect(FoxConfig.isConfigDir("/project/.kilo")).toBe(true)
  })

  test("recognizes .kilocode suffix", () => {
    expect(FoxConfig.isConfigDir("/project/.kilocode")).toBe(true)
  })

  test("recognizes custom flagDir", () => {
    expect(FoxConfig.isConfigDir("/custom/dir", "/custom/dir")).toBe(true)
  })

  test("rejects non-config directories", () => {
    expect(FoxConfig.isConfigDir("/project/src")).toBe(false)
    expect(FoxConfig.isConfigDir("/project/.git")).toBe(false)
    expect(FoxConfig.isConfigDir("/project/.opencode")).toBe(false)
  })
})

// ─── formatIssues ───────────────────────────────────────────────────────────

describe("formatIssues", () => {
  test("formats issues with paths", () => {
    const result = FoxConfig.formatIssues([
      { message: "must be a string", path: ["model"] },
    ])
    expect(result).toBe("model: must be a string")
  })

  test("formats issues without paths", () => {
    const result = FoxConfig.formatIssues([
      { message: "invalid config", path: [] },
    ])
    expect(result).toBe("invalid config")
  })

  test("formats multiple issues", () => {
    const result = FoxConfig.formatIssues([
      { message: "required", path: ["model"] },
      { message: "invalid", path: ["theme", "name"] },
    ])
    expect(result).toContain("model: required")
    expect(result).toContain("theme.name: invalid")
  })
})

// ─── retireExperimentalFlags ────────────────────────────────────────────────

describe("retireExperimentalFlags", () => {
  test("removes retired semantic_indexing flag", () => {
    const info = { experimental: { semantic_indexing: true, other: "keep" } }
    const result = FoxConfig.retireExperimentalFlags(info, "test.json")
    expect((result as any).experimental).not.toHaveProperty("semantic_indexing")
    expect((result as any).experimental.other).toBe("keep")
  })

  test("removes retired codebase_search flag", () => {
    const info = { experimental: { codebase_search: true } }
    const result = FoxConfig.retireExperimentalFlags(info, "test.json")
    expect((result as any).experimental).not.toHaveProperty("codebase_search")
  })

  test("removes retired shared_agent_board flag", () => {
    const info = { experimental: { shared_agent_board: true } }
    const result = FoxConfig.retireExperimentalFlags(info, "test.json")
    expect((result as any).experimental).not.toHaveProperty("shared_agent_board")
  })

  test("returns unchanged when no retired flags", () => {
    const info = { experimental: { future_flag: true } }
    const result = FoxConfig.retireExperimentalFlags(info, "test.json")
    expect(result).toBe(info) // Same reference — no copy needed
  })

  test("returns unchanged when no experimental section", () => {
    const info = { model: "claude-4" }
    const result = FoxConfig.retireExperimentalFlags(info, "test.json")
    expect(result).toBe(info)
  })
})

// ─── mergeAgentMarkdown ─────────────────────────────────────────────────────

describe("mergeAgentMarkdown", () => {
  test("adds new agents from incoming", () => {
    const result = FoxConfig.mergeAgentMarkdown(
      {},
      { coder: { instructions: "code stuff" } as any },
      {},
    )
    expect(result).toHaveProperty("coder")
  })

  test("merges into existing agents", () => {
    const result = FoxConfig.mergeAgentMarkdown(
      { coder: { instructions: "old" } as any },
      { coder: { instructions: "new" } as any },
      {},
    )
    expect(result.coder.instructions).toBe("new")
  })

  test("preserves routing from configured agents", () => {
    const result = FoxConfig.mergeAgentMarkdown(
      { coder: { mode: "all" } as any },
      { coder: { instructions: "from markdown", mode: "primary" } as any },
      { coder: { mode: "secondary" } as any },
    )
    // configured mode should take precedence
    expect(result.coder.mode).toBe("secondary")
  })
})

// ─── Config constants ───────────────────────────────────────────────────────

describe("config constants", () => {
  test("ALL_CONFIG_FILES has correct precedence order", () => {
    const files = FoxConfig.ALL_CONFIG_FILES
    expect(files[0]).toBe("fox.jsonc")
    expect(files[1]).toBe("fox.json")
    expect(files).toEqual(["fox.jsonc", "fox.json"])
  })

  test("FOX_DIR_SUFFIXES starts with .fox", () => {
    expect(FoxConfig.FOX_DIR_SUFFIXES[0]).toBe(".fox")
    expect(FoxConfig.KILO_DIR_SUFFIXES[0]).toBe(".fox")
  })
})
