
//
// Kilo-specific provider logic extracted from packages/opencode/src/provider/provider.ts
// to minimize merge conflicts with upstream opencode.
//
// This module exports patch functions and data that the upstream provider.ts
// calls at well-defined injection points (each marked with kilocode_change).

import { AI_SDK_PROVIDERS } from "@opencode-ai/core/v1/config/provider"
import { DEFAULT_HEADERS } from "@/foxcode/const"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { ModelV2 } from "@opencode-ai/core/model"
import { optionalOmitUndefined } from "@opencode-ai/core/schema"
import { ProviderError } from "@/provider/error"
import { Effect, Schema } from "effect"
import type { LanguageModelV3 } from "@ai-sdk/provider"
import { mapValues, omit, pickBy } from "remeda"
import { reasoningSummary } from "./reasoning-summary"
import type { Provider } from "@/provider/provider"
import type { Auth } from "@/auth"
import type { Config } from "@/config/config"
import { organization, token } from "./catalog"

/** Default timeout (ms) for provider HTTP requests (connection phase). */
export const REQUEST_TIMEOUT_MS = process.env.FOX_REQUEST_TIMEOUT_MS
  ? Number(process.env.FOX_REQUEST_TIMEOUT_MS)
  : 30_000 // 30 seconds default

// ---------------------------------------------------------------------------
// Bundled providers
// ---------------------------------------------------------------------------

type BundledSDK = { languageModel(modelId: string): LanguageModelV3 }

export const FOX_BUNDLED_PROVIDERS: Record<string, () => Promise<(options: any) => BundledSDK>> = {}
export const KILO_BUNDLED_PROVIDERS = FOX_BUNDLED_PROVIDERS

// ---------------------------------------------------------------------------
// Model schema extensions  (spread into Provider.Model Schema.Struct)
// ---------------------------------------------------------------------------

export const FOX_MODEL_SCHEMA_EXTENSIONS = {
  recommendedIndex: optionalOmitUndefined(Schema.Finite),
  isFree: Schema.optional(Schema.Boolean),
  mayTrainOnYourPrompts: Schema.optional(Schema.Boolean),
  hasUserByokAvailable: Schema.optional(Schema.Boolean),
  terminalBench: optionalOmitUndefined(
    Schema.Struct({
      overallScore: Schema.Finite,
      avgAttemptCostUsd: Schema.Finite,
    }),
  ),
  autoRouting: optionalOmitUndefined(
    Schema.Struct({
      models: Schema.Array(Schema.String),
    }),
  ),
  ai_sdk_provider: Schema.optional(Schema.Literals(AI_SDK_PROVIDERS)),
}
export const KILO_MODEL_SCHEMA_EXTENSIONS = FOX_MODEL_SCHEMA_EXTENSIONS

// ---------------------------------------------------------------------------
// fromModelsDevModel patch — returns kilo-specific fields
// ---------------------------------------------------------------------------

export function patchModelsDevModel(providerID: string, source: any) {
  return {
    variants: providerID === "fox" ? (source.variants ?? {}) : {},
    recommendedIndex: source.recommendedIndex,
    prompt: source.prompt,
    isFree: source.isFree,
    mayTrainOnYourPrompts: source.mayTrainOnYourPrompts,
    hasUserByokAvailable: source.hasUserByokAvailable,
    terminalBench: source.terminalBench,
    autoRouting: source.autoRouting,
    ai_sdk_provider: source.ai_sdk_provider,
    options: source.options ?? {},
  }
}

// ---------------------------------------------------------------------------
// Config model patch — merges kilo-specific fields from config + existing
// ---------------------------------------------------------------------------

export function patchConfigModel(cfg: any, existing: any) {
  return {
    recommendedIndex: cfg.recommendedIndex ?? existing?.recommendedIndex,
    prompt: cfg.prompt ?? existing?.prompt,
    isFree: cfg.isFree ?? existing?.isFree,
    mayTrainOnYourPrompts: cfg.mayTrainOnYourPrompts ?? existing?.mayTrainOnYourPrompts,
    hasUserByokAvailable: cfg.hasUserByokAvailable ?? existing?.hasUserByokAvailable,
    terminalBench: existing?.terminalBench,
    autoRouting: existing?.autoRouting,
    ai_sdk_provider: cfg.ai_sdk_provider ?? existing?.ai_sdk_provider,
    variants: cfg.variants
      ? mapValues(
          pickBy(cfg.variants, (v) => !!v && !v.disabled),
          (v) => omit(v, ["disabled"]),
        )
      : {},
  }
}

const CUSTOM_PROVIDER_PACKAGES = new Set(["@ai-sdk/openai-compatible", "@ai-sdk/openai"])
const FALLBACK_EFFORTS = ["none", "low", "medium", "high", "xhigh", "max"]
type Variants = NonNullable<Provider.Model["variants"]>
type Generate = (model: Provider.Model) => Variants

export function customProviderVariants(model: Provider.Model, npm: unknown, generate: Generate): Variants {
  if (model.variants && Object.keys(model.variants).length > 0) return model.variants

  const supported = typeof npm === "string" && CUSTOM_PROVIDER_PACKAGES.has(npm) && model.api.npm === npm
  const variants = generate(model)
  if (Object.keys(variants).length > 0) return variants
  if (!model.capabilities.reasoning || !supported) return variants

  return Object.fromEntries(
    FALLBACK_EFFORTS.map((effort) => {
      if (npm === "@ai-sdk/openai") {
        return [
          effort,
          {
            reasoningEffort: effort,
            reasoningSummary: reasoningSummary(model),
            include: ["reasoning.encrypted_content"],
          },
        ]
      }
      return [effort, { reasoningEffort: effort }]
    }),
  )
}

// ---------------------------------------------------------------------------
// Custom loaders (new or fully-replaced loaders)
// ---------------------------------------------------------------------------

type CustomDep = {
  auth: (id: string) => Effect.Effect<any | undefined>
  config: () => Effect.Effect<any>
  env: () => Effect.Effect<Record<string, string | undefined>>
  get: (key: string) => Effect.Effect<string | undefined>
}

// Mirrors upstream's CustomLoader return type so Object.entries preserves proper typing
type CustomLoaderResult = {
  autoload: boolean
  getModel?: (sdk: any, modelID: string, options?: Record<string, any>) => Promise<any>
  vars?: (options: Record<string, any>) => Record<string, string>
  options?: Record<string, any>
  discoverModels?: () => Promise<Record<string, any>>
}

type CustomLoader = (provider: any) => Effect.Effect<CustomLoaderResult>


export function foxCustomLoaders(_dep: CustomDep): Record<string, CustomLoader> {
  return {
    // Override opencode to prevent auto-connecting without credentials
    opencode: () =>
      Effect.succeed({
        autoload: false,
        options: { headers: DEFAULT_HEADERS },
      }),
  }
}
export const kiloCustomLoaders = foxCustomLoaders

export function patchCustomLoaderResult(
  _providerID: string,
  result: { options?: Record<string, any> },
  _env: Record<string, string | undefined>,
) {
  if (!result.options) return
}

// ---------------------------------------------------------------------------
// Fetch timeout wrappers
// Replaces AbortSignal.timeout() with a cancellable setTimeout+AbortController
// so the timer is cleared once response headers arrive, then hands the remaining
// deadline to wrapFirstByte until the body produces data. One configured
// `timeout` value bounds both phases together, so providers that accept a
// request and go silent cannot hang the agent loop, while healthy streaming
// responses are never aborted mid-stream.
// ---------------------------------------------------------------------------

/**
 * Resolves the configured request timeout in milliseconds. `timeout: false`
 * explicitly disables it (returns `undefined`); any other invalid, unset or
 * non-positive value falls back to {@link REQUEST_TIMEOUT_MS} so the wait for a
 * provider response is always bounded rather than left open-ended.
 */
export function requestTimeout(options: Record<string, any>): number | undefined {
  const ms = options["timeout"] ?? REQUEST_TIMEOUT_MS
  if (ms === false) return undefined
  if (typeof ms === "number" && Number.isFinite(ms) && ms > 0) return ms
  return REQUEST_TIMEOUT_MS
}

export function buildTimeoutSignal(options: Record<string, any>): {
  signal: AbortSignal | undefined
  clear: () => void
} {
  const ms = requestTimeout(options)
  if (ms === undefined) return { signal: undefined, clear() {} }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new DOMException("The operation timed out.", "TimeoutError")), ms)
  return {
    signal: controller.signal,
    clear() {
      clearTimeout(timer)
    },
  }
}

/**
 * Bounds the wait for the response body's first byte by `ms`.
 *
 * Response headers do not prove a live stream: a provider can answer 200 with
 * SSE headers and then never send data. The connection-phase timeout is cleared
 * as soon as headers arrive, so that state used to hang the agent loop forever
 * (the turn sits between step-finish and the next step-start with no error).
 *
 * Only the first byte is guarded. Once any data arrives the wrapper becomes a
 * passthrough, so idle gaps inside a streaming response (reasoning, buffering,
 * slow token generation) are never touched here and remain opt-in through
 * `chunkTimeout`.
 */
export function wrapFirstByte(res: Response, ms: number, ctl: AbortController) {
  if (typeof ms !== "number" || ms <= 0) return res
  if (!res.body) return res

  const reader = res.body.getReader()
  let seen = false
  const body = new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      if (seen) {
        const part = await reader.read()
        if (part.done) return ctrl.close()
        return ctrl.enqueue(part.value)
      }

      const part = await new Promise<Awaited<ReturnType<typeof reader.read>>>((resolve, reject) => {
        const id = setTimeout(() => {
          const err = new ProviderError.ResponseStreamError(`Provider sent no response data within ${ms}ms`)
          ctl.abort(err)
          void reader.cancel(err)
          reject(err)
        }, ms)

        reader.read().then(
          (part) => {
            clearTimeout(id)
            resolve(part)
          },
          (err) => {
            clearTimeout(id)
            reject(err)
          },
        )
      })

      seen = true
      if (part.done) return ctrl.close()
      ctrl.enqueue(part.value)
    },
    async cancel(reason) {
      ctl.abort(reason)
      await reader.cancel(reason)
    },
  })

  return new Response(body, {
    headers: new Headers(res.headers),
    status: res.status,
    statusText: res.statusText,
  })
}
