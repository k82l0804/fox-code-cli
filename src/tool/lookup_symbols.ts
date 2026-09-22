import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import DESCRIPTION from "./lookup_symbols.txt"
import { InstanceState } from "@/effect/instance-state"
import { Global } from "@opencode-ai/core/global"
import { AstIndexer } from "@foxcode/indexing/ast/indexer"

/** Singleton indexer per project directory. */
const indexers = new Map<string, AstIndexer>()

export function getOrCreateIndexer(directory: string): AstIndexer {
  let indexer = indexers.get(directory)
  if (!indexer) {
    indexer = AstIndexer.create(directory, Global.Path.state)
    indexers.set(directory, indexer)
  }
  return indexer
}

const symbolKinds = ["function", "class", "interface", "type", "method", "export", "variable"] as const

export const Parameters = Schema.Struct({
  query: Schema.String.annotate({ description: "Symbol name or pattern to search for" }),
  kind: Schema.optional(
    Schema.Literals(symbolKinds).annotate({
      description: "Filter by symbol kind",
    }),
  ),
  directory: Schema.optional(
    Schema.String.annotate({ description: "Limit search to files under this subdirectory (relative path)" }),
  ),
})

export const LookupSymbolsTool = Tool.define(
  "lookup_symbols",
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

          const results = indexer.lookupSymbols(args.query, {
            kind: args.kind as string | undefined,
            directory: args.directory,
          })

          if (results.length === 0) {
            const scanning = indexer.isScanning ? " (index scan still in progress)" : ""
            return {
              title: "Symbol Lookup",
              output: `No symbols matching "${args.query}" found.${scanning}`,
              metadata: { symbolCount: 0 },
            }
          }

          const lines = results.map(
            (r) =>
              `${r.filePath}:${r.line}: ${r.kind} ${r.name}${r.parentName ? ` [${r.parentName}]` : ""} — ${r.signature}`,
          )
          const header = `Found ${results.length} symbol${results.length > 1 ? "s" : ""}:`
          return {
            title: "Symbol Lookup",
            output: [header, ...lines].join("\n"),
            metadata: { symbolCount: results.length },
          }
        }),
    }
  }),
)
