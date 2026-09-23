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

const DESCRIPTION = [
  "Write the entire contents of a file. This tool replaces the full file content (or creates a new file).",
  "Use this tool for simple file creation or modification. Provide the complete file content — do not use diffs or patches.",
  "",
  "Parameters:",
  "- file_path: The absolute path to the file to write",
  "- content: The complete new content for the file",
].join("\n")

export const Parameters = Schema.Struct({
  file_path: Schema.String.annotate({
    description: "The absolute path to the file to write (must be absolute, not relative)",
  }),
  content: Schema.String.annotate({ description: "The complete new content for the file" }),
})

type Metadata = {
  filepath: string
  exists: boolean
  linesAdded: number
  linesRemoved: number
}

export const RewriteFileTool = Tool.define<typeof Parameters, Metadata, FSUtil.Service | EventV2Bridge.Service>(
  "rewrite_file",
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const events = yield* EventV2Bridge.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: { file_path: string; content: string }, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const filepath = path.isAbsolute(params.file_path)
            ? params.file_path
            : path.join(instance.directory, params.file_path)

          // Path security checks
          assertMutablePath(filepath)
          yield* assertExternalDirectoryEffect(ctx, filepath)

          const exists = yield* fs.existsSafe(filepath)
          const oldContent = exists ? (yield* fs.readFileStringSafe(filepath)) ?? "" : ""
          const next = Bom.split(params.content)
          const oldBom = Bom.split(oldContent)
          const desiredBom = oldBom.bom || next.bom
          const newContent = next.text

          // Compute diff stats
          const changes = diffLines(oldBom.text, newContent)
          let linesAdded = 0
          let linesRemoved = 0
          for (const change of changes) {
            const count = change.count ?? 0
            if (change.added) linesAdded += count
            if (change.removed) linesRemoved += count
          }

          // Permission check (uses "edit" permission like write tool)
          yield* ctx.ask({
            permission: "edit",
            patterns: [path.relative(instance.worktree, filepath)],
            always: ["*"],
            metadata: {
              filepath,
              diff: `rewrite_file: ${exists ? "overwrite" : "create"} ${filepath}`,
              filediff: undefined,
            },
          })

          // Write the file (creates parent directories as needed)
          yield* fs.writeWithDirs(filepath, Bom.join(newContent, desiredBom))
          yield* events.publish(FileSystem.Event.Edited, { file: filepath })
          yield* events.publish(Watcher.Event.Updated, {
            file: filepath,
            event: exists ? "change" : "add",
          })

          const action = exists ? "Overwrote" : "Created"
          const stats = exists
            ? ` (+${linesAdded} lines, -${linesRemoved} lines)`
            : ` (${newContent.split("\n").length} lines)`

          return {
            title: path.relative(instance.worktree, filepath),
            metadata: {
              filepath,
              exists,
              linesAdded,
              linesRemoved,
            },
            output: `${action} ${path.relative(instance.worktree, filepath)}${stats}`,
          }
        }).pipe(Effect.orDie),
    }
  }),
)
