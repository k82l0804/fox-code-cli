/**
 * Oscillation Detector — content-hash based oscillation detection for the
 * Autonomous Verification Layer.
 *
 * Tracks SHA-256 content hashes per file across a sliding window of turns,
 * identifying A→B→A toggle patterns where an agent repeatedly flips code
 * between two (or more) alternating states.
 *
 * This is architecturally distinct from the existing `isDoomLoop` in
 * `src/session/processor.ts`, which only detects N identical consecutive
 * tool calls with the exact same inputs. Oscillation detection tracks
 * *file content outcomes*, not tool invocation identity.
 */
export * as Oscillation from "./oscillation"

import { createHash } from "crypto"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single recorded mutation event for a file. */
export interface MutationRecord {
  /** SHA-256 hex digest of the file content after mutation. */
  readonly contentHash: string
  /** Logical turn index within the session (monotonically increasing). */
  readonly turn: number
}

/** Result of oscillation detection for a single file. */
export interface OscillationResult {
  /** Whether an oscillation pattern was detected. */
  readonly detected: boolean
  /** The file path that was checked. */
  readonly filePath: string
  /**
   * If detected, describes the oscillation pattern. For example:
   * `"A→B→A"` means the content returned to a previous state.
   */
  readonly pattern?: string
  /** The turn indices involved in the oscillation. */
  readonly turns?: readonly number[]
}

// ---------------------------------------------------------------------------
// OscillationTracker — mutable per-session state
// ---------------------------------------------------------------------------

/**
 * Mutable state object tracking per-file content hashes across turns.
 * One tracker per session processor Handle.
 */
export interface OscillationTracker {
  /** Sliding window size (number of recent mutations to retain per file). */
  readonly windowSize: number
  /** Per-file mutation history. Key is the canonical file path. */
  readonly history: Map<string, MutationRecord[]>
}

/**
 * Create a new oscillation tracker with the given window size.
 * @param windowSize Number of recent mutations to retain per file (default: 4).
 */
export function createTracker(windowSize = 4): OscillationTracker {
  return { windowSize, history: new Map() }
}

/**
 * Record a file mutation and check for oscillation in one step.
 *
 * @param tracker The oscillation tracker state.
 * @param filePath Canonical file path that was mutated.
 * @param contentHash SHA-256 hex digest of the file content after mutation.
 * @param turn Logical turn index.
 * @returns OscillationResult indicating whether oscillation was detected.
 */
export function recordAndDetect(
  tracker: OscillationTracker,
  filePath: string,
  contentHash: string,
  turn: number,
): OscillationResult {
  const records = tracker.history.get(filePath) ?? []

  // Check for oscillation BEFORE recording the new mutation:
  // Does the new contentHash match any *non-immediately-previous* record?
  // Pattern: ... → X → (something else) → X (current) = oscillation
  const oscillation = detectToggle(records, contentHash, turn)

  // Record the new mutation
  records.push({ contentHash, turn })

  // Enforce sliding window — keep only the most recent entries
  while (records.length > tracker.windowSize) {
    records.shift()
  }

  tracker.history.set(filePath, records)

  return oscillation
    ? { detected: true, filePath, pattern: oscillation.pattern, turns: oscillation.turns }
    : { detected: false, filePath }
}

/**
 * Compute the SHA-256 hex digest of file content.
 * Accepts string or Uint8Array.
 */
export function contentHash(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex")
}

/**
 * Reset the tracker state for a specific file or all files.
 * Useful when a user message arrives (signaling a new intent).
 */
export function reset(tracker: OscillationTracker, filePath?: string): void {
  if (filePath) {
    tracker.history.delete(filePath)
  } else {
    tracker.history.clear()
  }
}

// ---------------------------------------------------------------------------
// Warning Formatting
// ---------------------------------------------------------------------------

export namespace OscillationWarning {
  /**
   * Format a model-facing warning string for an oscillation result.
   * Returns undefined if no oscillation was detected.
   */
  export function format(result: OscillationResult): string | undefined {
    if (!result.detected) return undefined
    const turns = result.turns ? ` (turns ${result.turns.join(" → ")})` : ""
    return [
      `⚠️ OSCILLATION DETECTED on ${result.filePath}${turns}`,
      `Pattern: ${result.pattern ?? "content returned to a previous state"}`,
      ``,
      `You are toggling the same code between alternating states. This indicates a strategy deadlock.`,
      `STOP repeating the same approach. Instead:`,
      `1. Re-read the file to understand its current state`,
      `2. Analyze WHY your previous fix was reverted`,
      `3. Try a fundamentally different approach to solve the underlying problem`,
    ].join("\n")
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface ToggleMatch {
  pattern: string
  turns: number[]
}

/**
 * Check if `newHash` matches any non-immediately-previous record in the
 * history, forming an A→B→A toggle pattern.
 */
function detectToggle(
  records: readonly MutationRecord[],
  newHash: string,
  newTurn: number,
): ToggleMatch | undefined {
  if (records.length < 2) return undefined

  const lastRecord = records[records.length - 1]!
  // If the new hash is the same as the immediately previous one,
  // that's not oscillation — it's idempotent (no real change).
  if (lastRecord.contentHash === newHash) return undefined

  // Look for a match in records *before* the last one.
  for (let i = records.length - 2; i >= 0; i--) {
    if (records[i]!.contentHash === newHash) {
      // Found an A→B→A pattern:
      // records[i] had hash A, then something changed to B (or more),
      // and now we're back to A.
      const turnSequence = [
        records[i]!.turn,
        ...records.slice(i + 1).map((r) => r.turn),
        newTurn,
      ]
      const hashLabels = new Map<string, string>()
      let nextLabel = 65 // ASCII 'A'
      const labelFor = (hash: string) => {
        if (!hashLabels.has(hash)) {
          hashLabels.set(hash, String.fromCharCode(nextLabel++))
        }
        return hashLabels.get(hash)!
      }
      const patternParts = [
        labelFor(records[i]!.contentHash),
        ...records.slice(i + 1).map((r) => labelFor(r.contentHash)),
        labelFor(newHash),
      ]
      return {
        pattern: patternParts.join("→"),
        turns: turnSequence,
      }
    }
  }

  return undefined
}
