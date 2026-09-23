export interface DiscoveredModelLimits {
  readonly context?: number
  readonly output?: number
  readonly source: "api" | "static"
}

const cache = new Map<string, DiscoveredModelLimits>()

export function getCached(key: string): DiscoveredModelLimits | undefined {
  return cache.get(key)
}

export function setCached(key: string, limits: DiscoveredModelLimits): void {
  cache.set(key, limits)
}

export function clearCache(): void {
  cache.clear()
}
