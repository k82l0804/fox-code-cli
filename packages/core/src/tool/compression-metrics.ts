/**
 * Request-scoped accumulator for compression metrics.
 *
 * Reset at the start of each LLM step (step-start), read and emitted
 * when step-finish fires. This module uses module-level state because:
 * 1. Fox CLI is single-threaded (Bun/Node)
 * 2. Only one LLM step runs at a time per process
 * 3. The compress pipeline (compress.ts) and supersede pipeline need to
 *    record metrics without access to Effect services
 */
export * as CompressionMetrics from "./compression-metrics"

export interface CompressionSummary {
  /** Total chars of tool output before compression. */
  charsBefore: number
  /** Total chars of tool output after compression. */
  charsAfter: number
  /** Total chars saved by tool-output compression. */
  charsSaved: number
  /** Percentage reduction in tool-output chars. */
  pctSaved: number
  /** Schema minification: bytes saved. */
  schemaSaved: number
  /** Number of superseded (stale) tool reads removed. */
  superseded: number
  /** Number of Git commands rewritten with terse flags. */
  rewrites: number
  /** Number of shell outputs truncated by line/byte limits. */
  truncations: number
  /** Total compression overhead in milliseconds. */
  overheadMs: number
  /** Which compression transforms were active. */
  transforms: string[]
  /** Transforms that were skipped due to low ROI this step. */
  skipped: string[]
  /** Per-transform ROI scores (charsSaved / overheadMs). */
  roi: Record<string, number>
}

/** Minimum ROI (charsSaved / overheadMs) to keep a transform active. */
export const ROI_THRESHOLD = 5

/** Number of calls in the sliding window for ROI averaging. */
const WINDOW_SIZE = 10

/** How often to re-evaluate a skipped transform (every N calls). */
const REEVALUATE_INTERVAL = 20

// ---------------------------------------------------------------------------
// Per-step accumulators (reset each step)
// ---------------------------------------------------------------------------

let _charsBefore = 0
let _charsAfter = 0
let _overheadMs = 0
let _schemaSaved = 0
let _superseded = 0
let _rewrites = 0
let _truncations = 0
let _transforms = new Set<string>()

// ---------------------------------------------------------------------------
// Per-transform ROI tracking (persistent across steps)
// ---------------------------------------------------------------------------

interface TransformROI {
  /** Sliding window of recent ROI scores. */
  window: number[]
  /** Total calls since last re-evaluation. */
  callsSinceReevaluate: number
  /** Currently skipped due to low ROI? */
  skipped: boolean
}

const _roiTracker = new Map<string, TransformROI>()

/** Reset all accumulators. Call at step-start. */
export function reset(): void {
  _charsBefore = 0
  _charsAfter = 0
  _overheadMs = 0
  _schemaSaved = 0
  _superseded = 0
  _rewrites = 0
  _truncations = 0
  _transforms = new Set()
}

/** Record a compression transform result. Called from compress.ts process(). */
export function record(transform: string, charsBefore: number, charsAfter: number, durationMs: number): void {
  _charsBefore += charsBefore
  _charsAfter += charsAfter
  _overheadMs += durationMs
  if (charsBefore > charsAfter) {
    _transforms.add(transform)
  }
}

/** Record per-transform ROI for auto-skip decisions. */
export function recordTransformROI(name: string, charsSaved: number, durationMs: number): void {
  let tracker = _roiTracker.get(name)
  if (!tracker) {
    tracker = { window: [], callsSinceReevaluate: 0, skipped: false }
    _roiTracker.set(name, tracker)
  }

  const roi = durationMs > 0 ? charsSaved / durationMs : charsSaved > 0 ? Infinity : 0
  tracker.window.push(roi)
  if (tracker.window.length > WINDOW_SIZE) {
    tracker.window.shift()
  }

  // Check if average ROI is below threshold
  if (tracker.window.length >= 3) {
    const avgROI = tracker.window.reduce((a, b) => a + b, 0) / tracker.window.length
    tracker.skipped = avgROI < ROI_THRESHOLD
    if (tracker.skipped) {
      tracker.callsSinceReevaluate = 0
    }
  }
}

/** Check if a transform should be skipped due to low ROI. */
export function shouldSkip(name: string): boolean {
  const tracker = _roiTracker.get(name)
  if (!tracker || !tracker.skipped) return false

  // Periodically re-evaluate skipped transforms
  tracker.callsSinceReevaluate++
  if (tracker.callsSinceReevaluate >= REEVALUATE_INTERVAL) {
    tracker.skipped = false
    tracker.window = [] // Reset window for fresh evaluation
    tracker.callsSinceReevaluate = 0
    return false
  }

  return true
}

/** Get ROI data for a specific transform (for logging/debugging). */
export function getTransformROI(name: string): { avgROI: number; skipped: boolean } | undefined {
  const tracker = _roiTracker.get(name)
  if (!tracker || tracker.window.length === 0) return undefined
  const avgROI = Math.round((tracker.window.reduce((a, b) => a + b, 0) / tracker.window.length) * 100) / 100
  return { avgROI, skipped: tracker.skipped }
}

/** Reset ROI tracking (for tests). */
export function resetROI(): void {
  _roiTracker.clear()
}

/** Record schema minification savings. Called from llm.ts. */
export function recordSchema(bytesSaved: number): void {
  _schemaSaved += bytesSaved
  if (bytesSaved > 0) {
    _transforms.add("schema")
  }
}

/** Record superseded (stale read) count. Called from supersede.ts. */
export function recordSuperseded(count: number): void {
  _superseded += count
  if (count > 0) {
    _transforms.add("supersede")
  }
}

/** Record Git command rewrite. Called from compress.ts rewriteGitCommand(). */
export function recordRewrite(): void {
  _rewrites++
  _transforms.add("git_rewrite")
}

/** Record shell output truncation. Called from compress.ts truncateShellOutput(). */
export function recordTruncation(): void {
  _truncations++
  _transforms.add("truncation")
}

/** Read the accumulated summary. Call at step-finish. */
export function summary(): CompressionSummary {
  const saved = _charsBefore - _charsAfter

  // Collect ROI scores and skipped transforms
  const roi: Record<string, number> = {}
  const skipped: string[] = []
  for (const [name, tracker] of _roiTracker) {
    if (tracker.window.length > 0) {
      const avg = tracker.window.reduce((a, b) => a + b, 0) / tracker.window.length
      roi[name] = Math.round(avg * 100) / 100
    }
    if (tracker.skipped) {
      skipped.push(name)
    }
  }

  return {
    charsBefore: _charsBefore,
    charsAfter: _charsAfter,
    charsSaved: saved,
    pctSaved: _charsBefore > 0 ? Math.round((saved / _charsBefore) * 1000) / 10 : 0,
    schemaSaved: _schemaSaved,
    superseded: _superseded,
    rewrites: _rewrites,
    truncations: _truncations,
    overheadMs: Math.round(_overheadMs * 100) / 100,
    transforms: [..._transforms],
    skipped,
    roi,
  }
}

/** True if any compression activity was recorded this step. */
export function active(): boolean {
  return _charsBefore > 0 || _schemaSaved > 0 || _superseded > 0 || _rewrites > 0 || _truncations > 0
}
