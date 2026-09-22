/**
 * Adaptive Compression — Content Classification & Level Policy
 *
 * Heuristic classifier that assigns a CompressionLevel (0-3) and RiskProfile
 * to tool output content. All decisions are deterministic and sub-millisecond.
 *
 * Level 0 — Preserve:   No compression beyond baseline transforms.
 * Level 1 — Light:      Timestamp stripping, boilerplate removal.
 * Level 2 — Moderate:   Repeated pattern collapsing, noise reduction.
 * Level 3 — Aggressive: Heavy dedup, summary blocks (future).
 *
 * Risk profiles cap the maximum allowed level:
 *   critical → max Level 0 (preserve everything)
 *   cautious → max Level 1
 *   safe     → max Level 3
 */

export type CompressionLevel = 0 | 1 | 2 | 3
export type RiskProfile = "safe" | "cautious" | "critical"

export interface ContentClassification {
  /** Assigned compression level (may be capped by risk). */
  readonly level: CompressionLevel
  /** Risk profile — determines max level. */
  readonly risk: RiskProfile
  /** Detected content type hint. */
  readonly contentType: string
  /** Classifier confidence 0-1. Low confidence = uncertain content. */
  readonly confidence: number
  /** Detected patterns (for audit/debug). */
  readonly hints: readonly string[]
}

/**
 * Optional session-level override. Guardian can set this in Phase 2.5.
 * For now, only user-specified (via flag or config).
 */
export interface CompressionPolicyOverride {
  readonly maxLevel?: CompressionLevel
  readonly riskOverride?: RiskProfile
  readonly preservePatterns?: readonly string[]
  readonly source: "heuristic" | "guardian" | "user"
}

const MAX_LEVEL_BY_RISK: Record<RiskProfile, CompressionLevel> = {
  safe: 3,
  cautious: 1,
  critical: 0,
}

// ---------------------------------------------------------------------------
// Heuristic patterns
// ---------------------------------------------------------------------------

const TIMESTAMP_PATTERN = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/
const ISO_TIMESTAMP = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
const UNIX_EPOCH = /\b1[6-7]\d{8}\b/

const REPEATED_LINE_THRESHOLD = 4 // ≥4 consecutive similar lines
const DOM_MARKERS = /^<(!DOCTYPE|html|div|span|table|body|head)\b/im
const STACK_TRACE_MARKERS = /^\s+at\s+|^Traceback|^Error:|^Caused by:/m
const GAIA_REASONING_MARKERS = /\b(reasoning|chain.of.thought|step \d+|therefore|thus|conclude)\b/i
const OSWORLD_MARKERS = /\b(PID|USER\s+PID|window_id|desktop_id|xdotool)\b/i
const GIT_MULTI_STEP = /\[Step \d|tool=|^---$/m
const CI_PIPELINE_MARKERS = /\b(PASS|FAIL|✓|✗|ok \d|not ok|passed|failed|error:)\b/i

const NPM_WARN = /^npm warn /m
const PIP_WARN = /^\s*(WARNING|DEPRECATION):/m
const DOCKER_LAYER = /^[a-f0-9]{12}:/m

/**
 * Classify content for adaptive compression.
 * Returns a classification with level, risk, and detected hints.
 */
export function classifyContent(
  text: string,
  toolName: string,
  command?: string,
): ContentClassification {
  const hints: string[] = []
  let contentType = "unknown"
  let risk: RiskProfile = "safe"
  let confidence = 0.8

  // Escape hatch: # no-truncate means the user explicitly asked for full fidelity
  if (command?.includes("# no-truncate") || text.includes("# no-truncate")) {
    return { level: 0, risk: "critical", contentType: "escape-hatch", confidence: 1.0, hints: ["no-truncate-escape-hatch"] }
  }

  const len = text.length

  // ----- Critical risk: never compress -----

  // Stack traces
  if (STACK_TRACE_MARKERS.test(text) && !text.includes("diff --git")) {
    const traceLineCount = (text.match(/^\s+at\s+/gm) ?? []).length
    if (traceLineCount >= 3) {
      contentType = "stack-trace"
      risk = "critical"
      confidence = 0.9
      hints.push("stack-trace-detected")
    }
  }

  // GAIA-style reasoning inputs
  if (GAIA_REASONING_MARKERS.test(text) && risk !== "critical") {
    const matchCount = (text.match(GAIA_REASONING_MARKERS) ?? []).length
    if (matchCount >= 2) {
      contentType = "reasoning-input"
      risk = "critical"
      confidence = 0.7
      hints.push("reasoning-markers")
    }
  }

  // OSWorld system state
  if (OSWORLD_MARKERS.test(text) && risk !== "critical") {
    contentType = "system-state"
    risk = "critical"
    confidence = 0.7
    hints.push("osworld-markers")
  }

  // ----- Cautious risk: max Level 1 -----

  // DOM/HTML content
  if (DOM_MARKERS.test(text) && risk === "safe") {
    contentType = "dom-snapshot"
    risk = "cautious"
    confidence = 0.85
    hints.push("dom-html-detected")
  }

  // Multi-step agent traces
  if (GIT_MULTI_STEP.test(text) && risk === "safe") {
    contentType = "agent-trace"
    risk = "cautious"
    confidence = 0.8
    hints.push("multi-step-trace")
  }

  // Error-signal-heavy content (k8s logs, crash reports, OOM dumps)
  // These contain lines the user NEEDS to read — don't collapse them.
  const ERROR_SIGNAL_RE = /\b(OOMKilled|CrashLoop|BackOff|panic|FATAL|core dump|segfault|SIGKILL|SIGTERM|killed|PermissionDenied)\b/i
  if (risk === "safe" && ERROR_SIGNAL_RE.test(text)) {
    const signalCount = (text.match(new RegExp(ERROR_SIGNAL_RE.source, "gi")) ?? []).length
    if (signalCount >= 2) {
      contentType = contentType === "unknown" ? "error-log" : contentType
      risk = "cautious"
      confidence = 0.85
      hints.push(`error-signals:${signalCount}`)
    }
  }

  // ----- Safe: check for compressible patterns -----

  // Timestamps
  if (TIMESTAMP_PATTERN.test(text)) {
    const tsCount = (text.match(TIMESTAMP_PATTERN) ?? []).length
    if (tsCount >= 3) {
      hints.push(`timestamps:${tsCount}`)
    }
  }

  // Repeated line patterns
  const lines = text.split("\n")
  let maxConsecutiveSimilar = 0
  let currentRun = 1
  for (let i = 1; i < lines.length && i < 500; i++) {
    // Two lines are "similar" if they share the first 10 chars and length is within 50%
    const prev = lines[i - 1]!
    const curr = lines[i]!
    const prefix = prev.slice(0, 10)
    if (
      prefix.length >= 5 &&
      curr.startsWith(prefix) &&
      Math.abs(prev.length - curr.length) < Math.max(prev.length, curr.length) * 0.5
    ) {
      currentRun++
      maxConsecutiveSimilar = Math.max(maxConsecutiveSimilar, currentRun)
    } else {
      currentRun = 1
    }
  }
  if (maxConsecutiveSimilar >= REPEATED_LINE_THRESHOLD) {
    hints.push(`repeated-lines:${maxConsecutiveSimilar}`)
  }

  // Boilerplate patterns
  if (NPM_WARN.test(text)) hints.push("npm-warnings")
  if (PIP_WARN.test(text)) hints.push("pip-warnings")
  if (DOCKER_LAYER.test(text)) hints.push("docker-layers")

  // CI/CD pipeline output
  if (CI_PIPELINE_MARKERS.test(text) && risk === "safe") {
    const ciMatches = (text.match(CI_PIPELINE_MARKERS) ?? []).length
    if (ciMatches >= 5) {
      hints.push("ci-pipeline-output")
      if (contentType === "unknown") contentType = "ci-pipeline"
    }
  }

  // Diff content (already handled well by existing transforms)
  if (text.includes("diff --git") && contentType === "unknown") {
    contentType = "diff"
  }

  // Git output
  if (command?.startsWith("git") && contentType === "unknown") {
    contentType = "git-output"
  }

  // Shell output fallback
  if (toolName === "bash" && contentType === "unknown") {
    contentType = "shell-output"
  }

  // ----- Assign level based on hints -----

  let level: CompressionLevel = 0

  if (risk === "safe") {
    if (hints.some((h) => h.startsWith("repeated-lines:")) && maxConsecutiveSimilar >= 6) {
      level = 2 // Moderate: collapse repeated patterns
    } else if (hints.some((h) => h.startsWith("timestamps:") || h === "npm-warnings" || h === "pip-warnings" || h === "docker-layers")) {
      level = 1 // Light: strip timestamps/boilerplate
    }
  } else if (risk === "cautious") {
    // Only allow Level 1 for cautious content with clear patterns
    if (hints.some((h) => h.startsWith("timestamps:"))) {
      level = 1
    }
  }

  // Cap by risk
  const maxLevel = MAX_LEVEL_BY_RISK[risk]
  if (level > maxLevel) level = maxLevel as CompressionLevel

  return { level, risk, contentType, confidence, hints }
}
