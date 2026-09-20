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

/**
 * The compact marker shown to the model when a read output is superseded.
 * Includes the tool that caused the supersession so the model understands
 * why the earlier output is no longer shown.
 */
function supersedeMarker(filePath: string, mutatedBy: string): string {
  return `[File content superseded — ${filePath} was modified by ${mutatedBy}]`
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

/**
 * Build a set of tool call IDs whose output should be superseded.
 *
 * Scans the message history forward, tracking file reads and mutations.
 * A read is superseded if a later mutation targets the same file path.
 *
 * The scan normalizes paths by basename to handle relative vs absolute
 * path mismatches. This is conservative but catches the most common case
 * where the model reads "src/foo.ts" and then edits "src/foo.ts".
 */
export function buildSupersededSet(msgs: SessionV1.WithParts[], options?: { enabled?: boolean }): Map<string, string> {
  const enabled = options?.enabled ?? Flag.FOX_EXPERIMENTAL_COMPRESS_SUPERSEDE
  if (!enabled) return new Map()

  const start = performance.now()

  // Forward pass: collect all reads with their file paths
  // Map: callID → filePath
  const readCalls = new Map<string, string>()
  // Map: normalizedPath → latest read callID
  const latestReadByPath = new Map<string, string>()

  for (const msg of msgs) {
    if (msg.info.role !== "assistant") continue
    for (const part of msg.parts) {
      if (part.type !== "tool") continue
      if (part.state.status !== "completed") continue

      const toolName = part.tool
      if (READ_TOOLS.has(toolName)) {
        const filePath = extractPath(part.state.input)
        if (filePath) {
          readCalls.set(part.callID, filePath)
          latestReadByPath.set(filePath, part.callID)
        }
      }
    }
  }

  if (readCalls.size === 0) return new Map()

  // Forward pass: find mutations and mark earlier reads as superseded
  // Map: callID → supersedeMarker text
  const superseded = new Map<string, string>()

  for (const msg of msgs) {
    if (msg.info.role !== "assistant") continue
    for (const part of msg.parts) {
      if (part.type !== "tool") continue
      if (part.state.status !== "completed") continue

      const toolName = part.tool
      if (!MUTATE_TOOLS.has(toolName)) continue

      let mutatedPaths: string[] = []

      if (toolName === "edit" || toolName === "write") {
        const filePath = extractPath(part.state.input)
        if (filePath) mutatedPaths = [filePath]
      } else if (toolName === "apply_patch") {
        // Extract paths from the structured output or the text output
        const output = part.state.output
        if (typeof output === "string") {
          mutatedPaths = extractPatchPaths(output)
        } else if (typeof output === "object" && output !== null) {
          const obj = output as { applied?: Array<{ target?: string }> }
          if (Array.isArray(obj.applied)) {
            mutatedPaths = obj.applied
              .filter((item) => typeof item.target === "string")
              .map((item) => item.target!)
          }
        }
      }

      for (const mutatedPath of mutatedPaths) {
        // Check all read calls for matching paths
        for (const [callID, readPath] of readCalls) {
          // Skip if this read call comes AFTER the mutation (can't supersede future reads)
          // Skip if already superseded
          if (superseded.has(callID)) continue

          // Match by exact path or by basename normalization
          if (pathsMatch(readPath, mutatedPath)) {
            // Don't supersede the LATEST read of this path — the model might
            // have re-read the file after editing it
            if (latestReadByPath.get(readPath) === callID) continue
            superseded.set(callID, supersedeMarker(readPath, toolName))
          }
        }
      }
    }
  }

  if (superseded.size > 0) {
    log.info("compression.superseding", {
      durationMs: Math.round((performance.now() - start) * 100) / 100,
      supersededCount: superseded.size,
      totalReads: readCalls.size,
    })
    CompressionMetrics.recordSuperseded(superseded.size)
  }

  return superseded
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
