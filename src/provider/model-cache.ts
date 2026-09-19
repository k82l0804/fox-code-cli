
import { Context, Deferred, Duration, Effect, Exit, Layer, Schema, Scope } from "effect"
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import { Config } from "../config/config"
import { Auth } from "../auth"
import { compatible, organization, token } from "@/foxcode/provider/catalog"
import type { Provider } from "@opencode-ai/core/models-dev"
import * as Log from "@opencode-ai/core/util/log"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { httpClient } from "@opencode-ai/core/effect/app-node-platform"

type Models = Provider["models"]
export type Failure = { kind: "schema" } | { name?: string; message?: string }
export type FoxModelsResult = {
  readonly models: Models
  readonly error?: Failure
}
type FoxOptions = {
  baseURL?: string
  apiKey?: string
  token?: string
  organizationId?: string
  kilocodeOrganizationId?: string
  kilocodeToken?: string
}
type Options = { -readonly [K in keyof FoxOptions]?: FoxOptions[K] } & { apiKey?: string }
type Result = { readonly models: Models; readonly error?: Failure }
type View = { models?: Models; timestamp?: number }
type Flight = { readonly done: Deferred.Deferred<Result, unknown>; version: number }

export interface FoxModels {
  readonly fetch: (options: FoxOptions) => Effect.Effect<FoxModelsResult, unknown>
}

export class FoxModelsService extends Context.Service<FoxModelsService, FoxModels>()(
  "@foxcode/ModelCache/FoxModels",
) {}

export const foxModelsLayer = Layer.succeed(
  FoxModelsService,
  FoxModelsService.of({ fetch: () => Effect.succeed({ models: {} }) }),
)
type Cell = {
  readonly providerID: string
  readonly options: Options
  readonly view: View
  cached?: { readonly result: Result; readonly expires: number }
  flight?: Flight
}

export interface Interface {
  readonly getFailure: (providerID: string) => Effect.Effect<Failure | undefined>
  readonly failedProviders: () => Effect.Effect<string[]>
  readonly get: (providerID: string) => Effect.Effect<Models | undefined>
  readonly fetch: (providerID: string, options?: Options) => Effect.Effect<Models, unknown>
  readonly refresh: (providerID: string, options?: Options) => Effect.Effect<Models, unknown>
  readonly clear: (providerID: string) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@foxcode/ModelCache") {}

const log = Log.create({ service: "model-cache" })
const ttl = Duration.minutes(5)

export const layer: Layer.Layer<
  Service,
  never,
  Auth.Service | Config.Service | FoxModelsService | HttpClient.HttpClient
> = Layer.effect(
  Service,
  Effect.gen(function* () {
    const auth = yield* Auth.Service
    const cfg = yield* Config.Service
    const kilo = yield* FoxModelsService
    const scope = yield* Scope.Scope
    const cells = new Map<string, Cell>()
    const active = new Map<string, Cell>()
    const versions = new Map<string, number>()
    const failures = new Map<string, Failure>()

    const getFailure = Effect.fn("ModelCache.getFailure")(function* (providerID: string) {
      return failures.get(providerID)
    })

    const failedProviders = Effect.fn("ModelCache.failedProviders")(function* () {
      return [...failures.keys()]
    })

    const authOptions = Effect.fn("ModelCache.authOptions")(function* (providerID: string) {
      if (providerID !== "fox") return {}
      const config = yield* cfg.get()
      const options: Options = {}

      if (providerID === "fox") {
        const item = config.provider?.[providerID]
        const info = yield* auth.get(providerID)
        options.kilocodeOrganizationId = organization(item?.options, info)
        options.kilocodeToken = token(item?.options, info)
        log.debug("auth options resolved", {
          providerID,
          hasToken: !!options.kilocodeToken,
          hasOrganizationId: !!options.kilocodeOrganizationId,
        })
      }

      return options
    })

    const fetchModels = (providerID: string, options: Options): Effect.Effect<Result, unknown> => {
      if (providerID === "fox") return kilo.fetch(options)
      log.debug("provider not implemented", { providerID })
      return Effect.succeed({ models: {} })
    }

    const load = Effect.fn("ModelCache.load")(function* (providerID: string, options: Options) {
      const resolved = yield* authOptions(providerID).pipe(
        Effect.catchCause((cause) =>
          Effect.sync(() => {
            log.warn("auth options failed", { providerID, cause })
            return {}
          }),
        ),
      )
      const input = { ...resolved, ...options }
      if (providerID === "fox" && !compatible(input)) return { models: {}, error: { kind: "schema" as const } }
      return yield* fetchModels(providerID, input)
    })

    const key = (providerID: string, options?: Options) => {
      if (providerID === "fox") {
        return JSON.stringify([providerID, options?.baseURL, options?.kilocodeOrganizationId, options?.kilocodeToken])
      }
      return providerID
    }

    const cell = Effect.fn("ModelCache.cell")(function* (providerID: string, options: Options = {}) {
      const id = key(providerID, options)
      const existing = cells.get(id)
      if (existing) return existing
      const view: View = {}
      const next: Cell = { providerID, options, view }
      cells.set(id, next)
      return next
    })

    const invalidate = (entry: Cell) =>
      Effect.sync(() => {
        entry.cached = undefined
      })

    const detach = (entry: Cell) =>
      invalidate(entry).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            entry.flight = undefined
          }),
        ),
      )

    const commit = (providerID: string, version: number, entry: Cell, result: Result) =>
      Effect.sync(() => {
        if ((versions.get(providerID) ?? 0) !== version) return result.models
        if (result.error) {
          failures.set(providerID, result.error)
          log.warn("model fetch error", { providerID, error: result.error })
        } else {
          failures.delete(providerID)
        }
        entry.view.models = result.models
        entry.view.timestamp = Date.now()
        active.set(providerID, entry)
        log.info("models fetched and cached", { providerID, count: Object.keys(result.models).length })
        return result.models
      })

    // A refresh belongs to the cache service, not the caller that happened to start it.
    const evaluate = (entry: Cell, version: number) =>
      Effect.uninterruptibleMask((restore) =>
        Effect.gen(function* () {
          const cached = entry.cached
          if (cached && cached.expires > Date.now()) {
            yield* commit(entry.providerID, version, entry, cached.result)
            return cached.result
          }

          const existing = entry.flight
          if (existing) {
            existing.version = version
            return yield* restore(Deferred.await(existing.done))
          }

          const done = yield* Deferred.make<Result, unknown>()
          const flight = { done, version } satisfies Flight
          entry.flight = flight
          yield* Effect.uninterruptibleMask((restore) =>
            Effect.gen(function* () {
              const exit = yield* restore(load(entry.providerID, entry.options)).pipe(Effect.exit)
              if (entry.flight === flight) {
                entry.flight = undefined
                if (Exit.isSuccess(exit)) {
                  entry.cached = { result: exit.value, expires: Date.now() + Duration.toMillis(ttl) }
                  yield* commit(entry.providerID, flight.version, entry, exit.value)
                }
              }
              yield* Deferred.done(done, exit)
            }),
          ).pipe(Effect.forkIn(scope, { startImmediately: true }))
          return yield* restore(Deferred.await(done))
        }),
      )

    const get = Effect.fn("ModelCache.get")(function* (providerID: string) {
      const entry = active.get(providerID)
      if (!entry?.view.models || entry.view.timestamp === undefined) {
        log.debug("cache miss", { providerID })
        return
      }

      const age = Date.now() - entry.view.timestamp
      if (age > Duration.toMillis(ttl)) {
        log.debug("cache expired", { providerID, age })
        entry.view.models = undefined
        entry.view.timestamp = undefined
        yield* invalidate(entry)
        return
      }

      log.debug("cache hit", { providerID, age })
      return entry.view.models
    })

    const fetch = Effect.fn("ModelCache.fetch")(function* (providerID: string, options?: Options) {
      const cached = yield* get(providerID)
      if (cached) return cached
      const version = (versions.get(providerID) ?? 0) + 1
      versions.set(providerID, version)
      const entry = yield* cell(providerID, options)
      log.info("fetching models", { providerID })
      const result = yield* evaluate(entry, version)
      return result.models
    })

    const refresh = Effect.fn("ModelCache.refresh")(function* (providerID: string, options?: Options) {
      const version = (versions.get(providerID) ?? 0) + 1
      versions.set(providerID, version)
      const entry = yield* cell(providerID, options)
      log.info("refreshing models", { providerID })
      yield* invalidate(entry)
      const result = yield* evaluate(entry, version)
      return result.models
    })

    const clear = Effect.fn("ModelCache.clear")(function* (providerID: string) {
      versions.set(providerID, (versions.get(providerID) ?? 0) + 1)
      const entries = [...cells.entries()].filter(([, entry]) => entry.providerID === providerID)
      yield* Effect.all(
        entries.map(([id, entry]) => detach(entry).pipe(Effect.tap(() => Effect.sync(() => cells.delete(id))))),
        { discard: true },
      )
      active.delete(providerID)
      failures.delete(providerID)
      if (entries.some(([, entry]) => entry.view.models)) {
        log.info("cache cleared", { providerID })
        return
      }
      log.debug("no cache to clear", { providerID })
    })

    return Service.of({ getFailure, failedProviders, get, fetch, refresh, clear })
  }),
)

export const defaultLayer: Layer.Layer<Service> = Layer.suspend(() => AppNodeBuilder.build(node))
const kiloModels = LayerNode.make({ name: "kilo-models", layer: foxModelsLayer, deps: [] })
export const node = LayerNode.make({
  service: Service,
  layer,
  deps: [Auth.node, Config.node, kiloModels, httpClient],
})

export * as ModelCache from "./model-cache"

export { type FoxModels as KiloModels, type FoxModelsResult as KiloModelsResult, FoxModelsService as KiloModelsService, foxModelsLayer as kiloModelsLayer }
