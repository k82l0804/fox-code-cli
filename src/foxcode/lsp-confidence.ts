/**
 * LSP Confidence Scoring
 *
 * Assigns a 0.0-1.0 confidence score to an edit based on
 * LSP diagnostics before and after the edit. A score of 1.0
 * means no errors introduced; lower scores indicate problems.
 */

import type { Diagnostic } from "vscode-languageserver-types"

/** Diagnostic severity as defined by LSP spec */
export const enum Severity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}

/** Weights for computing the confidence penalty per diagnostic severity */
export const SEVERITY_WEIGHTS: Record<number, number> = {
  [Severity.Error]: 0.25, // Each error reduces confidence by 25%
  [Severity.Warning]: 0.05, // Each warning reduces by 5%
  [Severity.Information]: 0.01, // Each info reduces by 1%
  [Severity.Hint]: 0.0, // Hints don't affect confidence
}

/** Trusted diagnostic sources that carry higher weight */
export const HIGH_TRUST_SOURCES = new Set([
  "ts", // TypeScript
  "typescript",
  "Pyright",
  "pyright",
  "rust-analyzer",
  "rustc",
  "gopls",
  "clangd",
])

export interface ConfidenceInput {
  /** Diagnostics for the edited file(s) BEFORE the edit */
  readonly before: ReadonlyArray<Diagnostic>
  /** Diagnostics for the edited file(s) AFTER the edit */
  readonly after: ReadonlyArray<Diagnostic>
  /** The file path being scored (for logging) */
  readonly filePath: string
}

export interface ConfidenceResult {
  /** Overall confidence score 0.0-1.0 */
  readonly score: number
  /** Human-readable confidence label */
  readonly label: "high" | "medium" | "low" | "critical"
  /** Number of new errors introduced by this edit */
  readonly newErrors: number
  /** Number of errors fixed by this edit */
  readonly fixedErrors: number
  /** Net diagnostic delta (negative = improvement) */
  readonly netDelta: number
  /** Human-readable summary */
  readonly summary: string
}

/**
 * Compute edit confidence from LSP diagnostic deltas.
 */
export function computeConfidence(input: ConfidenceInput): ConfidenceResult {
  const beforeErrors = countBySeverity(input.before)
  const afterErrors = countBySeverity(input.after)

  // Calculate new diagnostics introduced
  const newErrors = Math.max(0, afterErrors.errors - beforeErrors.errors)
  const newWarnings = Math.max(0, afterErrors.warnings - beforeErrors.warnings)
  const fixedErrors = Math.max(0, beforeErrors.errors - afterErrors.errors)

  // Compute penalty
  const penalty =
    newErrors * SEVERITY_WEIGHTS[Severity.Error] +
    newWarnings * SEVERITY_WEIGHTS[Severity.Warning]

  // Apply trust multiplier for high-trust sources
  const highTrustNewErrors =
    input.after.filter(
      (d) => (d.severity ?? 4) === Severity.Error && HIGH_TRUST_SOURCES.has(d.source ?? ""),
    ).length -
    input.before.filter(
      (d) => (d.severity ?? 4) === Severity.Error && HIGH_TRUST_SOURCES.has(d.source ?? ""),
    ).length
  const trustPenalty = Math.max(0, highTrustNewErrors) * 0.1 // Extra 10% per high-trust error

  const score = Math.max(0, Math.min(1.0, 1.0 - penalty - trustPenalty))
  const netDelta = afterErrors.total - beforeErrors.total

  const label: ConfidenceResult["label"] =
    score >= 0.9 ? "high" : score >= 0.6 ? "medium" : score >= 0.3 ? "low" : "critical"

  const parts: string[] = []
  if (newErrors > 0) parts.push(`+${newErrors} error${newErrors !== 1 ? "s" : ""}`)
  if (fixedErrors > 0) parts.push(`-${fixedErrors} error${fixedErrors !== 1 ? "s" : ""} fixed`)
  if (newWarnings > 0) parts.push(`+${newWarnings} warning${newWarnings !== 1 ? "s" : ""}`)
  const summary =
    parts.length > 0
      ? `Edit confidence: ${label} (${(score * 100).toFixed(0)}%) — ${parts.join(", ")}`
      : `Edit confidence: ${label} (${(score * 100).toFixed(0)}%) — no new diagnostics`

  return { score, label, newErrors, fixedErrors, netDelta, summary }
}

function countBySeverity(diagnostics: ReadonlyArray<Diagnostic>) {
  let errors = 0,
    warnings = 0,
    info = 0,
    total = 0
  for (const d of diagnostics) {
    total++
    switch (d.severity) {
      case Severity.Error:
        errors++
        break
      case Severity.Warning:
        warnings++
        break
      case Severity.Information:
        info++
        break
    }
  }
  return { errors, warnings, info, total }
}
