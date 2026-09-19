import { Effect, Schema } from "effect"
import { HttpClient } from "effect/unstable/http"
import * as Tool from "./tool"
import * as McpWebSearch from "./mcp-websearch"
import DESCRIPTION from "./websearch.txt"
import { Env } from "@/env"

const MAX_RESULTS = 10

export const Parameters = Schema.Struct({
  query: Schema.String.annotate({ description: "Websearch query" }),
  numResults: Schema.optional(Schema.Number).annotate({
    description: "Number of search results to return (default: 8, maximum: 10)",
  }),
  livecrawl: Schema.optional(Schema.Literals(["fallback", "preferred"])).annotate({
    description:
      "Live crawl mode - 'fallback': use live crawling as backup if cached content unavailable, 'preferred': prioritize live crawling (default: 'fallback')",
  }),
  type: Schema.optional(Schema.Literals(["auto", "fast", "deep"])).annotate({
    description: "Search type - 'auto': balanced search (default), 'fast': quick results, 'deep': comprehensive search",
  }),
  contextMaxCharacters: Schema.optional(Schema.Number).annotate({
    description: "Maximum characters for context string optimized for LLMs (default: 10000)",
  }),
})

// Only Exa is supported — free keyless path via mcp-exa-unauth, or BYOK with EXA_API_KEY.
export type WebSearchProvider = "exa"

export function selectWebSearchProvider(): WebSearchProvider {
  return "exa"
}

export function webSearchProviderLabel(_provider: unknown) {
  return "Exa Web Search"
}

export function webSearchModelName(extra: Tool.Context["extra"]) {
  const model = extra?.model
  if (!model || typeof model !== "object") return undefined
  const api = "api" in model && model.api && typeof model.api === "object" ? model.api : undefined
  const apiID = api && "id" in api && typeof api.id === "string" ? api.id : undefined
  const id = "id" in model && typeof model.id === "string" ? model.id : undefined
  return (apiID ?? id)?.slice(0, 100)
}

export const WebSearchTool = Tool.define(
  "websearch",
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient
    const env = yield* Env.Service
    return {
      get description() {
        return DESCRIPTION.replace("{{year}}", new Date().getFullYear().toString())
      },
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const exaKey = yield* env.get("EXA_API_KEY")
          const provider: WebSearchProvider = "exa"
          const title = "Exa Web Search"
          // Transport: BYOK if EXA_API_KEY set, otherwise public unauthenticated endpoint.
          const transport = exaKey ? "mcp-exa-byok" : "mcp-exa-unauth"

          yield* ctx.metadata({
            title: `${title} "${params.query}"`,
            metadata: { provider, transport },
          })
          yield* ctx.ask({
            permission: "websearch",
            patterns: [params.query],
            always: ["*"],
            metadata: {
              query: params.query,
              numResults: params.numResults,
              livecrawl: params.livecrawl,
              type: params.type,
              contextMaxCharacters: params.contextMaxCharacters,
              provider,
            },
          })

          const result = yield* McpWebSearch.call(
            http,
            McpWebSearch.exaUrl(exaKey),
            "web_search_exa",
            McpWebSearch.SearchArgs,
            {
              query: params.query,
              type: params.type || "auto",
              numResults: Math.min(params.numResults || 8, MAX_RESULTS),
              livecrawl: params.livecrawl || "fallback",
              contextMaxCharacters: params.contextMaxCharacters,
            },
            "25 seconds",
          )

          return {
            output: result ?? "No search results found. Please try a different query.",
            title: `${title}: ${params.query}`,
            metadata: { provider, transport },
          }
        }).pipe(Effect.orDie),
    }
  }),
)
