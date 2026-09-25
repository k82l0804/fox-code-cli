import { Schema } from "effect"
import * as path from "path"
import { Effect } from "effect"
import * as Tool from "./tool"
import { diffLines } from "diff"
import { EventV2Bridge } from "@/event-v2-bridge"
import { FileSystem } from "@opencode-ai/core/filesystem"
import { Watcher } from "@opencode-ai/core/filesystem/watcher"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { InstanceState } from "@/effect/instance-state"
import { assertExternalDirectoryEffect } from "./external-directory"
import { assertMutablePath } from "../foxcode/agent-manager/protection"
import * as Bom from "@/util/bom"

import { syntaxCheck } from "./syntax-gate"

const DESCRIPTION = [
  "Write the entire contents of a file. This tool replaces the full file content (or creates a new file).",
  "Use this tool for simple file creation or modification. Provide the complete file content — do not use diffs or patches.",
  "If the file does not exist, set create: true to create it.",
  "",
  "Parameters:",
  "- file_path: The absolute path to the file to write",
  "- content: The complete new content for the file",
  "- create: Set to true to create a new file if it does not already exist (default: false)",
  "- reason: Optional explanation of why the file is being rewritten",
].join("\n")

export const Parameters = Schema.Struct({
  file_path: Schema.String.annotate({
    description: "The absolute path to the file to write (must be absolute, not relative)",
  }),
  content: Schema.String.annotate({ description: "The complete new content for the file" }),
  create: Schema.optional(Schema.Boolean).annotate({
    description: "Set to true to create a new file if it does not already exist (default: false)",
  }),
  reason: Schema.optional(Schema.String).annotate({
    description: "Optional explanation of why the file is being rewritten",
  }),
})

type Metadata = {
  filepath: string
  exists: boolean
  linesAdded: number
  linesRemoved: number
  rejected?: boolean
}

export function resolveRewritePath(filePath: string, directory: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(directory, filePath)
}

export function computeRewriteDiffStats(oldContent: string, newContent: string): { linesAdded: number; linesRemoved: number } {
  const changes = diffLines(oldContent, newContent)
  let linesAdded = 0
  let linesRemoved = 0
  for (const change of changes) {
    const count = change.count ?? 0
    if (change.added) linesAdded += count
    if (change.removed) linesRemoved += count
  }
  return { linesAdded, linesRemoved }
}

export function prepareRewriteContent(oldContent: string, newContent: string): {
  desiredBom: boolean
  cleanNewContent: string
  cleanOldContent: string
  fullContent: string
} {
  const next = Bom.split(newContent)
  const oldBom = Bom.split(oldContent)
  const desiredBom = oldBom.bom || next.bom
  return {
    desiredBom,
    cleanNewContent: next.text,
    cleanOldContent: oldBom.text,
    fullContent: Bom.join(next.text, desiredBom),
  }
}

export function buildRewriteOutput(
  exists: boolean,
  displayPath: string,
  stats: { linesAdded: number; linesRemoved: number; lineCount: number },
): string {
  const action = exists ? "Overwrote" : "Created"
  const detail = exists
    ? ` (+${stats.linesAdded} lines, -${stats.linesRemoved} lines)`
    : ` (${stats.lineCount} lines)`
  return `${action} ${displayPath}${detail}`
}

export function buildRewritePermissionAsk(worktree: string, filepath: string, exists: boolean) {
  return {
    permission: "edit" as const,
    patterns: [path.relative(worktree, filepath)],
    always: ["*"],
    metadata: {
      filepath,
      diff: `rewrite_file: ${exists ? "overwrite" : "create"} ${filepath}`,
      filediff: undefined,
    },
  }
}

export const RewriteFileTool = Tool.define<typeof Parameters, Metadata, FSUtil.Service | EventV2Bridge.Service>(
  "rewrite_file",
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const events = yield* EventV2Bridge.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (
        params: { file_path: string; content: string; reason?: string; create?: boolean },
        ctx: Tool.Context,
      ) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const filepath = resolveRewritePath(params.file_path, instance.directory)

          // Path security checks
          assertMutablePath(filepath)
          yield* assertExternalDirectoryEffect(ctx, filepath)

          const exists = yield* fs.existsSafe(filepath)
          if (!exists && !params.create) {
            throw new Error("File does not exist. Set create: true to create a new file.")
          }

          const oldContent = exists ? (yield* fs.readFileStringSafe(filepath)) ?? "" : ""
          const { desiredBom, cleanNewContent, cleanOldContent, fullContent } = prepareRewriteContent(
            oldContent,
            params.content,
          )

          // Syntax gate check before modifying disk
          const preSyntax = exists
            ? yield* Effect.promise(() => syntaxCheck(cleanOldContent, filepath))
            : { count: 0, supported: false, errorLines: [] }
          const postSyntax = yield* Effect.promise(() => syntaxCheck(cleanNewContent, filepath))

          const displayPath = path.relative(instance.worktree, filepath)
          if (postSyntax.supported && postSyntax.count > preSyntax.count) {
            const diffCount = postSyntax.count - preSyntax.count
            const linesStr = postSyntax.errorLines.length > 0 ? ` Lines: ${postSyntax.errorLines.join(", ")}.` : ""
            return {
              title: displayPath,
              metadata: {
                filepath,
                exists,
                linesAdded: 0,
                linesRemoved: 0,
                rejected: true,
              },
              output: `Edit rejected: introduces ${diffCount} syntax error(s).${linesStr} Please check your changes.`,
            }
          }

          // Compute diff stats
          const { linesAdded, linesRemoved } = computeRewriteDiffStats(cleanOldContent, cleanNewContent)

          // Permission check (uses "edit" permission like write tool)
          yield* ctx.ask(buildRewritePermissionAsk(instance.worktree, filepath, exists))

          // Write the file (creates parent directories as needed)
          yield* fs.writeWithDirs(filepath, fullContent)
          yield* events.publish(FileSystem.Event.Edited, { file: filepath })
          yield* events.publish(Watcher.Event.Updated, {
            file: filepath,
            event: exists ? "change" : "add",
          })

          const output = buildRewriteOutput(exists, displayPath, {
            linesAdded,
            linesRemoved,
            lineCount: cleanNewContent.split("\n").length,
          })

          return {
            title: displayPath,
            metadata: {
              filepath,
              exists,
              linesAdded,
              linesRemoved,
            },
            output,
          }
        }).pipe(Effect.orDie),
    }
  }),
)
