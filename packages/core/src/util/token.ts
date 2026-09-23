export * as Token from "./token"

const CHARS_PER_TOKEN = 4

export const estimate = (input: string) => Math.max(0, Math.round(input.length / CHARS_PER_TOKEN))

export function estimateObject(value: unknown): number {
  if (typeof value === "string") return estimate(value)
  return estimate(JSON.stringify(value))
}

const messageCache = new WeakMap<object, number>()

export function estimateMessage(message: unknown): number {
  if (typeof message === "string") return estimate(message)
  if (typeof message === "object" && message !== null) {
    const cached = messageCache.get(message)
    if (cached !== undefined) return cached
    const tokens = estimate(JSON.stringify(message))
    messageCache.set(message, tokens)
    return tokens
  }
  return estimate(JSON.stringify(message))
}
