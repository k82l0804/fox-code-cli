import { getCached, setCached, type DiscoveredModelLimits } from "./discovery-cache"

export type { DiscoveredModelLimits } from "./discovery-cache"

/**
 * Parse a raw model JSON object or payload into context and output token limits.
 * Supports OpenAI/LiteLLM/OpenRouter/vLLM, Anthropic, and Google formats.
 */
export function parseModelLimits(data: unknown): { context?: number; output?: number } | undefined {
  if (!data || typeof data !== "object") return undefined

  let obj: any = data
  if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
    obj = obj.data
  }

  let context: number | undefined
  let output: number | undefined

  // Context window:
  // 1. OpenAI / LiteLLM / OpenRouter / vLLM formats:
  // - context_window
  // - max_context_length
  // - max_input_tokens
  // 2. Google:
  // - inputTokenLimit
  // 3. Anthropic / generic:
  // - max_tokens (when context)
  if (typeof obj.context_window === "number" && obj.context_window > 0) {
    context = obj.context_window
  } else if (typeof obj.max_context_length === "number" && obj.max_context_length > 0) {
    context = obj.max_context_length
  } else if (typeof obj.inputTokenLimit === "number" && obj.inputTokenLimit > 0) {
    context = obj.inputTokenLimit
  } else if (typeof obj.max_input_tokens === "number" && obj.max_input_tokens > 0) {
    context = obj.max_input_tokens
  } else if (typeof obj.max_tokens === "number" && obj.max_tokens > 0) {
    context = obj.max_tokens
  }

  // Output token limit:
  // 1. Anthropic:
  // - max_output_tokens
  // 2. Google:
  // - outputTokenLimit
  // 3. OpenAI / generic:
  // - max_tokens (when distinct from context, or if context was set from context_window/inputTokenLimit)
  if (typeof obj.max_output_tokens === "number" && obj.max_output_tokens > 0) {
    output = obj.max_output_tokens
  } else if (typeof obj.outputTokenLimit === "number" && obj.outputTokenLimit > 0) {
    output = obj.outputTokenLimit
  } else if (
    context !== undefined &&
    typeof obj.max_tokens === "number" &&
    obj.max_tokens > 0 &&
    context !== obj.max_tokens
  ) {
    output = obj.max_tokens
  }

  if (context !== undefined || output !== undefined) {
    return { context, output }
  }
  return undefined
}

/**
 * Query a provider's /v1/models endpoint and extract context window limits.
 * Falls back to static limits if the endpoint is unavailable or doesn't
 * report limits.
 *
 * OpenAI format: model.context_window or model.max_tokens
 * Anthropic format: model.max_tokens (context), model.max_output_tokens
 * Google format: model.inputTokenLimit, model.outputTokenLimit
 */
export async function discoverModelLimits(
  baseUrl: string,
  modelId: string,
  apiKey?: string,
  staticLimits?: { context?: number; output?: number },
  timeoutMs = 5000,
): Promise<DiscoveredModelLimits> {
  const cacheKey = `${baseUrl}:${modelId}`
  const cached = getCached(cacheKey)
  if (cached) {
    return cached
  }

  const fallback: DiscoveredModelLimits = {
    context: staticLimits?.context,
    output: staticLimits?.output,
    source: "static",
  }

  if (!baseUrl || !modelId) {
    setCached(cacheKey, fallback)
    return fallback
  }

  const cleanBase = baseUrl.replace(/\/+$/, "")
  const url = `${cleanBase}/models/${modelId}`

  const headers: Record<string, string> = {
    Accept: "application/json",
  }
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    let response: Response
    try {
      response = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      setCached(cacheKey, fallback)
      return fallback
    }

    const data = await response.json()
    const parsed = parseModelLimits(data)

    if (parsed && (parsed.context !== undefined || parsed.output !== undefined)) {
      const result: DiscoveredModelLimits = {
        context: parsed.context ?? staticLimits?.context,
        output: parsed.output ?? staticLimits?.output,
        source: "api",
      }
      setCached(cacheKey, result)
      return result
    }

    setCached(cacheKey, fallback)
    return fallback
  } catch {
    setCached(cacheKey, fallback)
    return fallback
  }
}
