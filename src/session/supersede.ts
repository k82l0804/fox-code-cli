/**
 * Tool Output Supersession — Strategy 4.4
 *
 * Non-destructive, render-time replacement of stale tool outputs in the
 * message history. When a file has been modified (via edit, write, or
 * apply_patch), earlier read outputs for the same file are superseded.
 *
 * The stored message parts are NOT modified — supersession is applied
 * only when rendering messages for the LLM via `toModelMessagesEffect`.
 */
import { Flag } from "@opencode-ai/core/flag/flag"
import { Log } from "@opencode-ai/core/util/log"
import { CompressionMetrics } from "@opencode-ai/core/tool/compression-metrics"
import type { SessionV1 } from "@opencode-ai/core/v1/session"

const log = Log.create({ service: "compression" })

/** Tools whose output is a read of a specific file path. */
const READ_TOOLS = new Set(["read"])

/**
 * Tools that mutate files. Their `input` field contains a `path` property
 * (for edit and write) or a patch text (for apply_patch) that specifies
 * which files were modified.
 */
const MUTATE_TOOLS = new Set(["edit", "write", "apply_patch"])

/** Shell tools that may execute git inspection and mutation commands. */
const SHELL_TOOLS = new Set(["bash", "shell"])

/** Search tools for regex file content searching. */
const GREP_TOOLS = new Set(["grep"])

/** Search tools for glob file path matching. */
const GLOB_TOOLS = new Set(["glob"])

/**
 * The compact marker shown to the model when a read output is superseded.
 * Includes the tool that caused the supersession so the model understands
 * why the earlier output is no longer shown.
 */
function supersedeMarker(filePath: string, mutatedBy: string): string {
  return `[File content superseded — ${filePath} was modified by ${mutatedBy}]`
}

function readSuperMarker(filePath: string): string {
  return `[File content superseded — subsequent read of ${filePath}]`
}

function gitStatusMarker(reason: string): string {
  return `[Git status superseded — ${reason}]`
}

function gitDiffMarker(reason: string): string {
  return `[Git diff superseded — ${reason}]`
}

function gitBranchMarker(reason: string): string {
  return `[Git branch superseded — ${reason}]`
}

function grepMarker(): string {
  return `[Grep results superseded — newer results available]`
}

function globMarker(): string {
  return `[Glob results superseded — newer results available]`
}

function listingMarker(reason: string): string {
  return `[Directory listing superseded — ${reason}]`
}

function verificationMarker(): string {
  return `[Auto-verification output superseded — newer verification results available]`
}

/**
 * Extract the file path from a tool's stored input, if available.
 * Returns undefined if the input doesn't have a recognizable path.
 */
function extractPath(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null) return undefined
  const record = input as Record<string, unknown>
  if (typeof record.path === "string") return record.path
  // For backward compat: some tools use `file_path` or `filePath`
  if (typeof record.file_path === "string") return record.file_path
  if (typeof record.filePath === "string") return record.filePath
  return undefined
}

/**
 * Extract search query and normalized search path from a grep tool's input.
 */
function extractGrepKey(input: unknown): { key: string; query: string; path?: string } | undefined {
  if (typeof input !== "object" || input === null) return undefined
  const record = input as Record<string, unknown>
  const query =
    typeof record.pattern === "string"
      ? record.pattern
      : typeof record.query === "string"
        ? record.query
        : undefined
  if (!query) return undefined
  const p = extractPath(input)
  const normalized = p ? normalizePath(p) : ""
  return {
    key: `${query}:${normalized}`,
    query,
    path: p,
  }
}

/**
 * Extract glob pattern and normalized search path from a glob tool's input.
 */
function extractGlobKey(input: unknown): { key: string; pattern: string; path?: string } | undefined {
  if (typeof input !== "object" || input === null) return undefined
  const record = input as Record<string, unknown>
  const pattern =
    typeof record.pattern === "string"
      ? record.pattern
      : typeof record.glob === "string"
        ? record.glob
        : undefined
  if (!pattern) return undefined
  const p = extractPath(input)
  const normalized = p ? normalizePath(p) : ""
  return {
    key: `${pattern}:${normalized}`,
    pattern,
    path: p,
  }
}

interface ListingCommandInfo {
  readonly kind: "ls" | "find"
  readonly targetDir: string
  readonly rawCommand: string
}

/**
 * Classify directory listing commands (`ls`, `find`) in shell/bash tool calls.
 */
function classifyListingCommand(cmd: string): ListingCommandInfo | undefined {
  const trimmed = cmd.trim()
  const subcommands = trimmed.split(/\s*(?:&&|;|\|\|)\s*/)
  for (const sub of subcommands) {
    const s = sub.trim()
    const lsMatch = s.match(/^ls(?:\s+(.*))?$/i)
    if (lsMatch) {
      const args = lsMatch[1]?.trim() ?? ""
      const tokens = args.split(/\s+/).filter(Boolean)
      const nonFlags = tokens.filter((t) => !t.startsWith("-"))
      let targetDir = nonFlags.length > 0 ? normalizePath(nonFlags[0]!) : ""
      if (targetDir === ".") targetDir = ""
      return { kind: "ls", targetDir, rawCommand: trimmed }
    }
    const findMatch = s.match(/^find(?:\s+(.*))?$/i)
    if (findMatch) {
      const args = findMatch[1]?.trim() ?? ""
      const tokens = args.split(/\s+/).filter(Boolean)
      let targetDir = ""
      if (tokens.length > 0 && !tokens[0]!.startsWith("-")) {
        targetDir = normalizePath(tokens[0]!)
        if (targetDir === ".") targetDir = ""
      }
      return { kind: "find", targetDir, rawCommand: trimmed }
    }
  }
  return undefined
}

/**
 * Detect whether tool output contains auto-verification markers.
 */
function isVerificationOutput(output: unknown): boolean {
  if (typeof output !== "string") return false
  return output.includes("─── Auto-Verification")
}

/**
 * Extract the shell command string from a tool's stored input.
 */
function extractCommand(input: unknown): string | undefined {
  if (typeof input === "string") return input
  if (typeof input !== "object" || input === null) return undefined
  const record = input as Record<string, unknown>
  if (typeof record.command === "string") return record.command
  if (typeof record.cmd === "string") return record.cmd
  return undefined
}

type GitCommandKind = "status" | "diff" | "branch" | "mutation" | "other"

interface GitCommandInfo {
  readonly kind: GitCommandKind
  readonly targetPath?: string
  readonly rawCommand: string
}

/**
 * Classify git commands executed in shell/bash tool calls.
 */
function classifyGitCommand(cmd: string): GitCommandInfo | undefined {
  const trimmed = cmd.trim()
  const subcommands = trimmed.split(/\s*(?:&&|;|\|\|)\s*/)
  let hasGit = false
  let statusSeen = false
  let diffSeen = false
  let diffTarget: string | undefined = undefined
  let branchSeen = false
  let mutationSeen = false

  for (const sub of subcommands) {
    const match = sub.trim().match(/^git\s+([a-z-]+)(?:\s+(.*))?$/i)
    if (!match) continue
    hasGit = true
    const action = match[1]!.toLowerCase()
    const args = match[2]?.trim() ?? ""

    if (action === "status") {
      statusSeen = true
    } else if (action === "diff") {
      diffSeen = true
      // Extract target file if not just flags
      const nonFlags = args
        .split(/\s+/)
        .filter((arg) => !arg.startsWith("-") && !arg.startsWith(":") && arg.length > 0)
      if (nonFlags.length > 0) diffTarget = nonFlags[0]
    } else if (action === "branch") {
      branchSeen = true
    } else if (
      action === "commit" ||
      action === "merge" ||
      action === "rebase" ||
      action === "reset" ||
      action === "checkout" ||
      action === "switch" ||
      action === "pull" ||
      action === "stash"
    ) {
      mutationSeen = true
    }
  }

  if (!hasGit) return undefined
  if (mutationSeen) return { kind: "mutation", rawCommand: trimmed }
  if (statusSeen) return { kind: "status", rawCommand: trimmed }
  if (diffSeen) return { kind: "diff", targetPath: diffTarget, rawCommand: trimmed }
  if (branchSeen) return { kind: "branch", rawCommand: trimmed }
  return { kind: "other", rawCommand: trimmed }
}

/**
 * Extract mutated file paths from an apply_patch tool's output.
 * The output has an `applied` array with `target` paths.
 */
function extractPatchPaths(output: unknown): string[] {
  if (typeof output !== "string") return []
  // apply_patch toModelOutput format: "Applied patch sequentially:\nA path\nM path\nD path"
  const paths: string[] = []
  for (const line of output.split("\n")) {
    const match = line.match(/^[AMD]\s+(.+)$/)
    if (match?.[1]) paths.push(match[1])
  }
  return paths
}

interface ToolCallEntry {
  readonly callID: string
  readonly index: number
  readonly toolName: string
  readonly input: unknown
  readonly output: unknown
}

/**
 * Build a set of tool call IDs whose output should be superseded.
 *
 * Scans the message history, tracking:
 * 1. File reads vs later file mutations (edit, write, apply_patch)
 * 2. Git status checks vs later status checks or git commits
 * 3. Git diffs vs later diffs, commits, or matching file edits
 * 4. Git branch listings vs later branch listings
 *
 * Stored message parts are NEVER modified — supersession is applied only
 * at render time when compiling messages for the LLM.
 */
import { getWorkflowPolicy, type WorkflowType } from "@opencode-ai/core/tool/compress"

export function buildSupersededSet(
  msgs: SessionV1.WithParts[],
  options?: { enabled?: boolean; workflow?: WorkflowType },
): Map<string, string> {
  const policy = getWorkflowPolicy(options?.workflow)
  const enabled = options?.enabled ?? (Flag.FOX_EXPERIMENTAL_COMPRESS_SUPERSEDE && policy.gitSupersede)
  if (!enabled) return new Map()

  const start = performance.now()

  // Linearize completed tool calls in chronological order
  const toolCalls: ToolCallEntry[] = []
  let globalIdx = 0

  for (const msg of msgs) {
    if (msg.info.role !== "assistant") continue
    for (const part of msg.parts) {
      if (part.type !== "tool") continue
      if (part.state.status !== "completed") continue
      toolCalls.push({
        callID: part.callID,
        index: globalIdx++,
        toolName: part.tool,
        input: part.state.input,
        output: part.state.output,
      })
    }
  }

  if (toolCalls.length === 0) return new Map()

  const superseded = new Map<string, string>()

  // 1. File reads tracking
  const readCalls = new Map<string, { callID: string; path: string; index: number }>()
  const latestReadByPath = new Map<string, string>()
  const readsByPath = new Map<string, Array<{ callID: string; path: string; index: number }>>()

  // 2. Git command tracking
  const gitStatusCalls: Array<{ callID: string; index: number }> = []
  const gitDiffCalls: Array<{ callID: string; index: number; targetPath?: string }> = []
  const gitBranchCalls: Array<{ callID: string; index: number }> = []
  const mutations: Array<{ index: number; toolName: string; paths: string[]; isGitCommit: boolean }> = []

  // 3. Grep tracking (Pattern 1)
  const grepCalls: Array<{ callID: string; key: string; index: number }> = []
  const latestGrepByKey = new Map<string, string>()

  // 4. Glob tracking (Pattern 2)
  const globCalls: Array<{ callID: string; key: string; index: number }> = []
  const latestGlobByKey = new Map<string, string>()

  // 5. Directory listing tracking (Pattern 3)
  const listingCalls: Array<{ callID: string; index: number; targetDir: string }> = []

  // 6. Auto-verification tracking (Pattern 4)
  const verificationCalls: Array<{ callID: string; index: number; output: string }> = []

  for (const call of toolCalls) {
    if (READ_TOOLS.has(call.toolName)) {
      const filePath = extractPath(call.input)
      if (filePath) {
        const entry = { callID: call.callID, path: filePath, index: call.index }
        readCalls.set(call.callID, entry)
        latestReadByPath.set(filePath, call.callID)
        let list = readsByPath.get(filePath)
        if (!list) {
          list = []
          readsByPath.set(filePath, list)
        }
        list.push(entry)
      }
    } else if (MUTATE_TOOLS.has(call.toolName)) {
      let paths: string[] = []
      if (call.toolName === "edit" || call.toolName === "write") {
        const p = extractPath(call.input)
        if (p) paths = [p]
      } else if (call.toolName === "apply_patch") {
        if (typeof call.output === "string") {
          paths = extractPatchPaths(call.output)
        } else if (typeof call.output === "object" && call.output !== null) {
          const obj = call.output as { applied?: Array<{ target?: string }> }
          if (Array.isArray(obj.applied)) {
            paths = obj.applied
              .filter((item) => typeof item.target === "string")
              .map((item) => item.target!)
          }
        }
      }
      mutations.push({ index: call.index, toolName: call.toolName, paths, isGitCommit: false })
    } else if (GREP_TOOLS.has(call.toolName)) {
      const info = extractGrepKey(call.input)
      if (info) {
        grepCalls.push({ callID: call.callID, key: info.key, index: call.index })
        latestGrepByKey.set(info.key, call.callID)
      }
    } else if (GLOB_TOOLS.has(call.toolName)) {
      const info = extractGlobKey(call.input)
      if (info) {
        globCalls.push({ callID: call.callID, key: info.key, index: call.index })
        latestGlobByKey.set(info.key, call.callID)
      }
    } else if (SHELL_TOOLS.has(call.toolName)) {
      const cmd = extractCommand(call.input)
      if (cmd) {
        const gitInfo = classifyGitCommand(cmd)
        if (gitInfo) {
          if (gitInfo.kind === "status") {
            gitStatusCalls.push({ callID: call.callID, index: call.index })
          } else if (gitInfo.kind === "diff") {
            gitDiffCalls.push({ callID: call.callID, index: call.index, targetPath: gitInfo.targetPath })
          } else if (gitInfo.kind === "branch") {
            gitBranchCalls.push({ callID: call.callID, index: call.index })
          } else if (gitInfo.kind === "mutation") {
            mutations.push({
              index: call.index,
              toolName: "git",
              paths: [],
              isGitCommit: true,
            })
          }
        }
        const listingInfo = classifyListingCommand(cmd)
        if (listingInfo) {
          listingCalls.push({ callID: call.callID, index: call.index, targetDir: listingInfo.targetDir })
        }
      }
    }

    if (isVerificationOutput(call.output)) {
      verificationCalls.push({ callID: call.callID, index: call.index, output: call.output as string })
    }
  }

  // --- Supersede stale file reads (mutated files) ---
  for (const mutation of mutations) {
    for (const mutatedPath of mutation.paths) {
      for (const [callID, readEntry] of readCalls) {
        if (readEntry.index >= mutation.index) continue
        if (superseded.has(callID)) continue
        if (pathsMatch(readEntry.path, mutatedPath)) {
          if (latestReadByPath.get(readEntry.path) === callID) continue
          superseded.set(callID, supersedeMarker(readEntry.path, mutation.toolName))
        }
      }
    }
  }

  // --- Supersede stale file reads on re-read without mutation (Pattern 5) ---
  for (const [, reads] of readsByPath) {
    for (let i = 0; i < reads.length - 1; i++) {
      const cur = reads[i]!
      const next = reads[i + 1]!
      if (superseded.has(cur.callID)) continue
      // Check if there was any mutation affecting this file between cur and next
      const hadMutation = mutations.some(
        (m) =>
          m.index > cur.index &&
          m.index < next.index &&
          (m.isGitCommit || m.paths.some((p) => pathsMatch(p, cur.path))),
      )
      if (!hadMutation) {
        superseded.set(cur.callID, readSuperMarker(cur.path))
      }
    }
  }

  // --- Supersede stale git status outputs ---
  // Any git status followed by a newer git status is superseded by the newer one
  for (let i = 0; i < gitStatusCalls.length - 1; i++) {
    const current = gitStatusCalls[i]!
    superseded.set(current.callID, gitStatusMarker("subsequent status check"))
  }
  // If the latest git status was followed by a git commit / mutation, it is also superseded
  if (gitStatusCalls.length > 0) {
    const lastStatus = gitStatusCalls[gitStatusCalls.length - 1]!
    const laterCommit = mutations.find((m) => m.index > lastStatus.index && m.isGitCommit)
    if (laterCommit && !superseded.has(lastStatus.callID)) {
      superseded.set(lastStatus.callID, gitStatusMarker("working tree modified by git commit"))
    }
  }

  // --- Supersede stale git diff outputs ---
  for (let i = 0; i < gitDiffCalls.length; i++) {
    const currentDiff = gitDiffCalls[i]!
    if (superseded.has(currentDiff.callID)) continue

    // 1. Check if a later git diff exists
    const laterDiff = gitDiffCalls.slice(i + 1).find((next) => {
      if (!currentDiff.targetPath && !next.targetPath) return true // both repo-wide
      if (currentDiff.targetPath && next.targetPath) {
        return pathsMatch(currentDiff.targetPath, next.targetPath)
      }
      return false
    })
    if (laterDiff) {
      superseded.set(currentDiff.callID, gitDiffMarker("subsequent diff"))
      continue
    }

    // 2. Check if a later commit occurred after this diff
    const laterCommit = mutations.find((m) => m.index > currentDiff.index && m.isGitCommit)
    if (laterCommit) {
      superseded.set(currentDiff.callID, gitDiffMarker("changes committed by git commit"))
      continue
    }

    // 3. If diff targeted a file, check if that file was mutated later
    if (currentDiff.targetPath) {
      const laterMutation = mutations.find(
        (m) => m.index > currentDiff.index && m.paths.some((p) => pathsMatch(p, currentDiff.targetPath!)),
      )
      if (laterMutation) {
        superseded.set(
          currentDiff.callID,
          gitDiffMarker(`${currentDiff.targetPath} modified by ${laterMutation.toolName}`),
        )
      }
    }
  }

  // --- Supersede stale git branch outputs ---
  for (let i = 0; i < gitBranchCalls.length - 1; i++) {
    const current = gitBranchCalls[i]!
    superseded.set(current.callID, gitBranchMarker("subsequent branch check"))
  }

  // --- Supersede stale grep outputs (Pattern 1) ---
  for (const call of grepCalls) {
    if (latestGrepByKey.get(call.key) !== call.callID && !superseded.has(call.callID)) {
      superseded.set(call.callID, grepMarker())
    }
  }

  // --- Supersede stale glob outputs (Pattern 2) ---
  for (const call of globCalls) {
    if (latestGlobByKey.get(call.key) !== call.callID && !superseded.has(call.callID)) {
      superseded.set(call.callID, globMarker())
    }
  }

  // --- Supersede stale directory listings (Pattern 3) ---
  for (let i = 0; i < listingCalls.length; i++) {
    const current = listingCalls[i]!
    if (superseded.has(current.callID)) continue

    // 1. Check if a later directory listing targeted the same directory
    const laterListing = listingCalls.slice(i + 1).find((next) => next.targetDir === current.targetDir)
    if (laterListing) {
      superseded.set(current.callID, listingMarker("subsequent directory listing"))
      continue
    }

    // 2. Check if a later commit occurred after this listing
    const laterCommit = mutations.find((m) => m.index > current.index && m.isGitCommit)
    if (laterCommit) {
      superseded.set(current.callID, listingMarker("files modified by git commit"))
      continue
    }

    // 3. Check if any file in target directory was mutated
    const laterMutation = mutations.find(
      (m) => m.index > current.index && m.paths.some((p) => isWithinDirectory(p, current.targetDir)),
    )
    if (laterMutation) {
      const reason = current.targetDir
        ? `files modified in ${current.targetDir} by ${laterMutation.toolName}`
        : `files modified by ${laterMutation.toolName}`
      superseded.set(current.callID, listingMarker(reason))
    }
  }

  // --- Supersede stale auto-verification outputs (Pattern 4) ---
  for (let i = 0; i < verificationCalls.length - 1; i++) {
    const v = verificationCalls[i]!
    const marker = verificationMarker()
    const vIdx = v.output.indexOf("─── Auto-Verification")
    const prefix = vIdx >= 0 ? v.output.slice(0, vIdx).trimEnd() : ""
    const replacement = prefix ? `${prefix}\n\n${marker}` : marker
    superseded.set(v.callID, replacement)
  }

  if (superseded.size > 0) {
    log.info("compression.superseding", {
      durationMs: Math.round((performance.now() - start) * 100) / 100,
      supersededCount: superseded.size,
      totalReads: readCalls.size,
      totalGitStatus: gitStatusCalls.length,
      totalGitDiff: gitDiffCalls.length,
      totalGreps: grepCalls.length,
      totalGlobs: globCalls.length,
      totalListings: listingCalls.length,
      totalVerifications: verificationCalls.length,
    })
    CompressionMetrics.recordSuperseded(superseded.size)
  }

  return superseded
}

/**
 * Check whether a target file path resides within a given directory.
 * An empty string or "." indicates the root directory (encompassing all files).
 */
function isWithinDirectory(filePath: string, dir: string): boolean {
  if (dir === "" || dir === ".") return true
  const na = normalizePath(filePath)
  const nd = normalizePath(dir)
  if (na === nd) return true
  if (na.startsWith(nd + "/")) return true
  return na.includes("/" + nd + "/") || na.endsWith("/" + nd)
}

/**
 * Match paths by exact equality or by shared suffix.
 * Handles cases like "src/foo.ts" vs "/home/user/project/src/foo.ts"
 * and "./src/foo.ts" vs "src/foo.ts".
 */
function pathsMatch(a: string, b: string): boolean {
  const na = normalizePath(a)
  const nb = normalizePath(b)
  if (na === nb) return true
  // One is a suffix of the other (handles absolute vs relative)
  return na.endsWith("/" + nb) || nb.endsWith("/" + na)
}

function normalizePath(p: string): string {
  // Strip leading ./ and trailing /
  return p.replace(/^\.\//, "").replace(/\/+$/, "")
}
