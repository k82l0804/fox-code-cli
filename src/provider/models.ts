
import { Config } from "@/config/config"
import { Auth } from "@/auth"
import { ModelCache } from "./model-cache"
import * as Core from "@opencode-ai/core/models-dev"
import { Context, Effect, Layer } from "effect"
import { AI_SDK_PROVIDERS } from "@opencode-ai/core/v1/config/provider"
import { compatible, organization, token } from "@/foxcode/provider/catalog"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
export const Model = Core.Model
export type Model = Core.Model
export const Provider = Core.Provider
export type Provider = Core.Provider
export const CatalogModelStatus = Core.CatalogModelStatus
export type CatalogModelStatus = Core.CatalogModelStatus

export interface Interface extends Core.Interface {}

export class Service extends Context.Service<Service, Interface>()("@opencode/ModelsDev") {}
function baseURL(url: string | undefined, org: string | undefined) {
  if (!url) return
  const base = url.replace(/\/+$/, "")
  if (org) {
    if (base.includes("/api/organizations/")) return base
    if (base.endsWith("/api")) return `${base}/organizations/${org}`
    return `${base}/api/organizations/${org}`
  }
  if (base.includes("/openrouter")) return base
  if (base.endsWith("/api")) return `${base}/openrouter`
  return `${base}/api/openrouter`
}

export const layer: Layer.Layer<Service, never, Core.Service | Config.Service | Auth.Service | ModelCache.Service> =
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const core = yield* Core.Service
      const config = yield* Config.Service
      const _auth = yield* Auth.Service
      const _cache = yield* ModelCache.Service

      const get = Effect.fn("ModelsDev.get")(function* () {
        const providers = yield* core.get()
        const _fallback = providers.kilo
        delete providers.kilo

        const cfg = yield* config.get()
        const _disabled = new Set(cfg.disabled_providers ?? [])
        const enabled = cfg.enabled_providers ? new Set(cfg.enabled_providers) : undefined

        const addLocal = Effect.fnUntraced(function* () {
          if (providers.local) return
          const localOpts = cfg.provider?.local?.options
          const localURL =
            localOpts?.baseURL ??
            process.env.OPENAI_BASE_URL ??
            process.env.FOX_LOCAL_LLM_URL ??
            "http://localhost:8000/v1"
          const apiKey =
            localOpts?.apiKey ??
            process.env.OPENAI_API_KEY ??
            process.env.FOX_API_KEY ??
            "local-dev"

          const configuredModels = cfg.provider?.local?.models
          const models: Record<string, Core.Model> = {}

          if (configuredModels && Object.keys(configuredModels).length > 0) {
            for (const [id, m] of Object.entries(configuredModels)) {
              models[id] = {
                id,
                name: m?.name ?? id,
                limit: { context: m?.limit?.context ?? 128000, output: m?.limit?.output ?? 16384 },
                attachment: true,
                reasoning: false,
                temperature: true,
                tool_call: true,
                release_date: "",
              } as Core.Model
            }
          } else {
            // Attempt to dynamically discover models from the OpenAI-compatible endpoint
            const fetched = yield* Effect.tryPromise(async () => {
              const res = await fetch(`${localURL.replace(/\/+$/, "")}/models`, {
                headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
                signal: AbortSignal.timeout(2000),
              })
              if (!res.ok) return []
              const json = await res.json()
              return Array.isArray(json?.data) ? json.data.map((d: any) => d.id) : []
            }).pipe(Effect.catch(() => Effect.succeed([] as string[])))

            if (fetched.length > 0) {
              for (const id of fetched) {
                models[id] = {
                  id,
                  name: id,
                  limit: { context: 128000, output: 16384 },
                  attachment: true,
                  reasoning: false,
                  temperature: true,
                  tool_call: true,
                  release_date: "",
                } as Core.Model
              }
            } else {
              models["gpt-4o-mini"] = {
                id: "gpt-4o-mini",
                name: "GPT-4o Mini",
                limit: { context: 128000, output: 16384 },
                attachment: true,
                reasoning: false,
                temperature: true,
                tool_call: true,
                release_date: "",
              } as Core.Model
              models["gpt-4o"] = {
                id: "gpt-4o",
                name: "GPT-4o",
                limit: { context: 128000, output: 16384 },
                attachment: true,
                reasoning: false,
                temperature: true,
                tool_call: true,
                release_date: "",
              } as Core.Model
            }
          }

          providers.local = {
            id: "local",
            name: cfg.provider?.local?.name ?? "Local OpenAI",
            env: ["OPENAI_API_KEY", "FOX_API_KEY"],
            api: localURL,
            npm: "@ai-sdk/openai-compatible",
            models,
          }
        })

        yield* addLocal()
        return providers
      })

      return Service.of({ get, refresh: core.refresh })
    }),
  )

export const defaultLayer: Layer.Layer<Service> = Layer.suspend(() => AppNodeBuilder.build(node))
export const node = LayerNode.make({
  service: Service,
  layer,
  deps: [Core.node, Config.node, Auth.node, ModelCache.node],
})

export { AI_SDK_PROVIDERS }
export * as ModelsDev from "./models"
