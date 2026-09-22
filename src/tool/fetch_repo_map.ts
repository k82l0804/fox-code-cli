import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import DESCRIPTION from "./fetch_repo_map.txt"
import { InstanceState } from "@/effect/instance-state"
import { getOrCreateIndexer } from "./lookup_symbols"

export const Parameters = Schema.Struct({
  directory: Schema.optional(
    Schema.String.annotate({ description: "Subdirectory to map (relative path, default: project root)" }),
  ),
  depth: Schema.optional(
    Schema.Int.annotate({ description: "Maximum directory depth to display (default: 3)" }),
  ),
})

export const FetchRepoMapTool = Tool.define(
  "fetch_repo_map",
  Effect.gen(function* () {
    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (args: Schema.Schema.Type<typeof Parameters>, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const indexer = getOrCreateIndexer(instance.directory)

          // Trigger scan if index is empty
          const stats = indexer.stats()
          if (stats.files === 0 && !indexer.isScanning) {
            yield* Effect.promise(() => indexer.scan())
          }

          const output = indexer.repoMap({
            directory: args.directory,
            depth: args.depth,
          })

          const indexStats = indexer.stats()
          const footer = `\n\n---\nIndex: ${indexStats.files} files, ${indexStats.symbols} symbols${indexer.isScanning ? " (scan in progress)" : ""}`

          return {
            title: "Repository Map",
            output: output + footer,
            metadata: { files: indexStats.files, symbols: indexStats.symbols },
          }
        }),
    }
  }),
)
