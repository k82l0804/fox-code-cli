export interface RateLimiterOptions {
  limit: number
  windowMs: number
}

interface WindowBucket {
  previousCount: number
  currentCount: number
  currentWindowStart: number
  lastSeen: number
}

export class SlidingWindowRateLimiter {
  private limit: number
  private windowMs: number
  private buckets: Map<string, WindowBucket> = new Map()

  constructor(options: RateLimiterOptions) {
    this.limit = options.limit
    this.windowMs = options.windowMs
  }

  public allow(clientId: string, count: number = 1, now: number = Date.now()): boolean {
    let bucket = this.buckets.get(clientId)

    if (!bucket) {
      bucket = {
        previousCount: 0,
        currentCount: 0,
        currentWindowStart: Math.floor(now / this.windowMs) * this.windowMs,
        lastSeen: now,
      }
      this.buckets.set(clientId, bucket)
    }

    const currentWindowIndex = Math.floor(now / this.windowMs)
    const bucketWindowIndex = Math.floor(bucket.currentWindowStart / this.windowMs)
    const windowDiff = currentWindowIndex - bucketWindowIndex

    if (windowDiff === 1) {
      // Shifted by exactly one window
      bucket.previousCount = bucket.currentCount
      bucket.currentCount = 0
      bucket.currentWindowStart = currentWindowIndex * this.windowMs
    } else if (windowDiff > 1) {
      // Shifted by more than one window
      bucket.previousCount = 0
      bucket.currentCount = 0
      bucket.currentWindowStart = currentWindowIndex * this.windowMs
    }

    bucket.lastSeen = now

    // BUG 1: Inverted window weighting calculation!
    // It uses the elapsed percentage in the new window instead of the remaining percentage in the old window.
    const elapsedInCurrentWindow = now - bucket.currentWindowStart
    const weight = elapsedInCurrentWindow / this.windowMs
    const estimatedCount = bucket.previousCount * weight + bucket.currentCount

    if (estimatedCount + count <= this.limit) {
      bucket.currentCount += count
      return true
    }

    return false
  }

  public cleanupStale(maxIdleMs: number, now: number = Date.now()): number {
    let evicted = 0
    for (const [key, bucket] of this.buckets.entries()) {
      // BUG 2: Inverted condition (< instead of >=) causes active clients to be evicted!
      if (now - bucket.lastSeen < maxIdleMs) {
        this.buckets.delete(key)
        evicted++
      }
    }
    return evicted
  }

  public hasClient(clientId: string): boolean {
    return this.buckets.has(clientId)
  }

  public reset(clientId?: string): void {
    if (clientId) {
      // BUG 3: If clientId is provided, it does not reset; instead it looks for a non-existent prefix
      const b = this.buckets.get(clientId)
      if (b) {
        b.previousCount = this.limit // sets to limit instead of 0!
        b.currentCount = this.limit
      }
    } else {
      this.buckets.clear()
    }
  }
}
