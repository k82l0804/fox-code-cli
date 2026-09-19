import type { OpenAICompatibleProviderOptions } from "@ai-sdk/openai-compatible"

export function foxProviderOptions(options: { [x: string]: any }) {
  const result: Record<string, any> = {}
  result.openai = {
    reasoningEffort: options.reasoning?.effort,
    textVerbosity: options.verbosity,
    store: false,
    forceReasoning: options.reasoning?.enabled,
  }
  result.openaiCompatible = {
    reasoningEffort: options.reasoning?.effort,
    textVerbosity: options.verbosity,
  } satisfies OpenAICompatibleProviderOptions
  return result
}
