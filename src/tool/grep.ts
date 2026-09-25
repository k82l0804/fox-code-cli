import path from "path"
import { Effect, Schema } from "effect"
import { InstanceState } from "@/effect/instance-state"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Ripgrep } from "@opencode-ai/core/ripgrep"
import * as KiloGrep from "@/foxcode/tool/grep-signal-controls"
import { assertExternalDirectoryEffect } from "./external-directory"
import DESCRIPTION from "./grep.txt"
import * as Tool from "./tool"

export const Parameters = Schema.Struct({
  pattern: Schema.String.annotate({ description: "Pattern to search for in file contents (regex by default)" }),
  path: Schema.optional(Schema.String).annotate({
    description: "The directory to search in. Defaults to the current working directory.",
  }),
  include: Schema.optional(Schema.String).annotate({
    description: 'File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}")',
  }),
  ...KiloGrep.fields,
})

export const GrepTool = Tool.define(
  "grep",
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const ripgrep = yield* Ripgrep.Service
    return {
      description: KiloGrep.describe(DESCRIPTION),
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const limit = params.limit ?? KiloGrep.DEFAULT_LIMIT
          const isDetailed = params.context === true || (typeof params.context === "number" && params.context > 0)
          const contextLines = typeof params.context === "number" ? params.context : params.context === true ? 2 : 0
          const empty = {
            title: params.pattern,
            metadata: { matches: 0, truncated: false },
            output: "No files found",
          }
          if (!params.pattern) {
            throw new Error("pattern is required")
          }

          yield* ctx.ask({
            permission: "grep",
            patterns: [params.pattern],
            always: ["*"],
            metadata: {
              pattern: params.pattern,
              path: params.path,
              include: params.include,
              ...KiloGrep.metadata(params, limit, params.context ?? 0),
            },
          })

          const ins = yield* InstanceState.context
          const requested = path.isAbsolute(params.path ?? ins.directory)
            ? (params.path ?? ins.directory)
            : path.join(ins.directory, params.path ?? ".")
          const requestedInfo = yield* fs.stat(requested).pipe(Effect.catch(() => Effect.succeed(undefined)))
          yield* assertExternalDirectoryEffect(ctx, requested, {
            bypass: false,
            kind: requestedInfo?.type === "Directory" ? "directory" : "file",
          })

          const search = FSUtil.resolve(requested)
          const info = yield* fs.stat(search).pipe(Effect.catch(() => Effect.succeed(undefined)))
          if (!info || (info.type !== "File" && info.type !== "Directory")) return empty
          const cwd = info?.type === "Directory" ? search : path.dirname(search)
          const result = yield* ripgrep.grep({
            cwd,
            file: info?.type === "File" ? path.basename(search) : undefined,
            pattern: params.pattern,
            include: params.include,
            ...KiloGrep.options(params, limit, contextLines),
            signal: ctx.abort,
          })
          const matches = result.items
          if (matches.length === 0) return empty
          const rows = matches.map((item) => ({
            path: path.resolve(
              requestedInfo?.type === "Directory" ? requested : path.dirname(requested),
              item.entry.path,
            ),
            line: item.line,
            text: item.text,
            context: item.context,
            textTruncated: item.textTruncated,
          }))

          const truncated = result.truncated
          const final = rows
          if (final.length === 0) return empty

          const total = rows.filter((row) => !row.context).length
          const hasMore = truncated

          if (!isDetailed) {
            const fileMap = new Map<string, Array<{ line: number; text: string }>>()
            for (const row of final) {
              if (row.context) continue
              const rel = path.relative(ins.directory, row.path) || row.path
              const list = fileMap.get(rel) ?? []
              list.push(row)
              fileMap.set(rel, list)
            }
            const totalFiles = fileMap.size
            if (totalFiles === 0) return empty
            const output = [`Found "${params.pattern}" in ${totalFiles} file${totalFiles === 1 ? "" : "s"}:`]
            const entries = Array.from(fileMap.entries())
            const maxFiles = 20
            const displayed = entries.slice(0, maxFiles)
            for (const [filePath, hits] of displayed) {
              const hitCount = hits.length
              const previews = hits.slice(0, 2).map((h) => `line ${h.line}: ${h.text.trim()}`).join("; ")
              output.push(`${filePath} (${hitCount} hit${hitCount === 1 ? "" : "s"}) - ${previews}`)
            }
            if (entries.length > maxFiles) {
              const moreFiles = entries.length - maxFiles
              output.push(`... and ${moreFiles} more file${moreFiles === 1 ? "" : "s"}`)
            }
            if (result.partial) output.push("", "(Some paths were inaccessible.)")
            return {
              title: params.pattern,
              metadata: {
                matches: total,
                truncated,
              },
              output: output.join("\n"),
            }
          }

          const output = [`Found ${total} matches${hasMore ? " (more matches available)" : ""}`]

          let current = ""
          for (const match of final) {
            if (current !== match.path) {
              if (current !== "") output.push("")
              current = match.path
              output.push(`${match.path}:`)
            }
            output.push(KiloGrep.line(match, contextLines))
          }

          if (truncated) {
            output.push("")
            output.push(KiloGrep.limitNotice(limit))
          }
          output.push(...KiloGrep.notices(rows))
          if (result.partial) output.push("", "(Some paths were inaccessible.)")
          return {
            title: params.pattern,
            metadata: {
              matches: total,
              truncated,
            },
            output: output.join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
