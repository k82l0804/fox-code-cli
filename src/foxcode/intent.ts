/**
 * Repo-Level Intent Detection
 *
 * Classifies task scope from a goal/message description using
 * deterministic heuristics. No LLM calls — pure string analysis.
 *
 * Outputs a structured IntentClassification that downstream
 * systems (model routing, Guardian, TUI) can consume.
 */

import type { ModelTier } from "./model-tier"

/** Scope categories from narrow to broad */
export type TaskScope =
  | "trivial" // Typo fix, comment addition, formatting
  | "single" // Single-file bug fix, small feature in one file
  | "multi" // Multi-file change, moderate refactor
  | "cross" // Cross-module architectural change
  | "unknown" // Cannot classify confidently

/** What kind of work the task involves */
export type TaskIntent =
  | "fix" // Bug fix, error repair
  | "feature" // New feature, add capability
  | "refactor" // Restructure without behavior change
  | "research" // Investigation, explanation, code review
  | "config" // Configuration, dependency, build changes
  | "test" // Test creation, test fix
  | "docs" // Documentation changes
  | "unknown"

export interface IntentClassification {
  /** Primary intent category */
  readonly intent: TaskIntent
  /** Estimated scope / blast radius */
  readonly scope: TaskScope
  /** Confidence 0-1 in the classification */
  readonly confidence: number
  /** Human-readable explanation of the classification */
  readonly reason: string
  /** Suggested minimum model tier for this task */
  readonly suggestedMinTier: ModelTier
  /** Whether this task likely needs write tools */
  readonly needsWriteTools: boolean
  /** Pattern matches that drove the classification */
  readonly signals: ReadonlyArray<string>
}

export interface ClassifyInput {
  /** The user's message / goal text */
  readonly message: string
  /** Optional: currently active file path (from IDE context) */
  readonly activeFile?: string
  /** Optional: file paths mentioned in the message */
  readonly mentionedFiles?: ReadonlyArray<string>
}

interface PatternRule {
  readonly pattern: RegExp
  readonly signal: string
}

const INTENT_RULES: Record<TaskIntent, ReadonlyArray<PatternRule>> = {
  fix: [
    { pattern: /\bfix(?:es|ed|ing)?\b/i, signal: "fix" },
    { pattern: /\bbug(?:s)?\b/i, signal: "bug" },
    { pattern: /\berror(?:s)?\b/i, signal: "error" },
    { pattern: /\bbroken\b/i, signal: "broken" },
    { pattern: /\bfailing test(?:s)?\b/i, signal: "failing test" },
    { pattern: /\bcrash(?:es|ed|ing)?\b/i, signal: "crash" },
    { pattern: /\bregression(?:s)?\b/i, signal: "regression" },
    { pattern: /\bissue\s*#?\d+\b/i, signal: "issue #" },
  ],
  feature: [
    { pattern: /\badd(?:s|ed|ing)?\b/i, signal: "add" },
    { pattern: /\bimplement(?:s|ed|ing)?\b/i, signal: "implement" },
    { pattern: /\bcreate(?:s|ed|ing)?\b/i, signal: "create" },
    { pattern: /\bbuild(?:s|ing)?\b/i, signal: "build" },
    { pattern: /\bnew feature\b/i, signal: "new feature" },
    { pattern: /\bsupport for\b/i, signal: "support for" },
  ],
  refactor: [
    { pattern: /\brefactor(?:s|ed|ing)?\b/i, signal: "refactor" },
    { pattern: /\brestructure(?:s|ed|ing)?\b/i, signal: "restructure" },
    { pattern: /\brename(?:s|ed|ing)?\b/i, signal: "rename" },
    { pattern: /\bmove(?:s|ed|ing)?\b/i, signal: "move" },
    { pattern: /\bextract(?:s|ed|ing)?\b/i, signal: "extract" },
    { pattern: /\bdecouple(?:s|ed|ing)?\b/i, signal: "decouple" },
    { pattern: /\bclean up\b/i, signal: "clean up" },
  ],
  research: [
    { pattern: /\bexplain\b/i, signal: "explain" },
    { pattern: /\bhow does\b/i, signal: "how does" },
    { pattern: /\bwhy\b/i, signal: "why" },
    { pattern: /\binvestigate\b/i, signal: "investigate" },
    { pattern: /\breview\b/i, signal: "review" },
    { pattern: /\bunderstand\b/i, signal: "understand" },
    { pattern: /\bfind\b/i, signal: "find" },
    { pattern: /\bsearch\b/i, signal: "search" },
    { pattern: /\bwhat is\b/i, signal: "what is" },
  ],
  config: [
    { pattern: /\bconfig(?:uration)?\b/i, signal: "config" },
    { pattern: /\bdependenc(?:y|ies)\b/i, signal: "dependency" },
    { pattern: /\bpackage\.json\b/i, signal: "package.json" },
    { pattern: /\btsconfig(?:\.json)?\b/i, signal: "tsconfig" },
    { pattern: /\benv\b/i, signal: "env" },
    { pattern: /\bdocker(?:file)?\b/i, signal: "docker" },
    { pattern: /\bci\b/i, signal: "ci" },
    { pattern: /\bdeploy(?:ment)?\b/i, signal: "deploy" },
  ],
  test: [
    { pattern: /\btest(?:s)?\b/i, signal: "test" },
    { pattern: /\bspec(?:s)?\b/i, signal: "spec" },
    { pattern: /\bcoverage\b/i, signal: "coverage" },
    { pattern: /\bassertion(?:s)?\b/i, signal: "assertion" },
    { pattern: /\bmock(?:s|ing)?\b/i, signal: "mock" },
  ],
  docs: [
    { pattern: /\bdocument(?:s|ed|ing|ation)?\b/i, signal: "document" },
    { pattern: /\breadme(?:\.md)?\b/i, signal: "readme" },
    { pattern: /\bjsdoc\b/i, signal: "jsdoc" },
    { pattern: /\bcomment(?:s)?\b/i, signal: "comment" },
    { pattern: /\bchangelog\b/i, signal: "changelog" },
  ],
  unknown: [],
}

const TRIVIAL_RULES: ReadonlyArray<PatternRule> = [
  { pattern: /\btypo(?:s)?\b/i, signal: "typo" },
  { pattern: /\bcomment(?:s)?\b/i, signal: "comment" },
  { pattern: /\bformat(?:ting)?\b/i, signal: "format" },
  { pattern: /\blint fix\b/i, signal: "lint fix" },
]

const CROSS_RULES: ReadonlyArray<PatternRule> = [
  { pattern: /\bacross\b/i, signal: "across" },
  { pattern: /\ball files\b/i, signal: "all files" },
  { pattern: /\brefactor module\b/i, signal: "refactor module" },
  { pattern: /\bsystem-wide\b/i, signal: "system-wide" },
  { pattern: /\barchitecture\b/i, signal: "architecture" },
  { pattern: /\bmonorepo\b/i, signal: "monorepo" },
  { pattern: /\bcross-package\b/i, signal: "cross-package" },
  { pattern: /\bcross-module\b/i, signal: "cross-module" },
  { pattern: /\ball packages\b/i, signal: "all packages" },
  { pattern: /\bpackage(?:s)?\b/i, signal: "package" },
]

const FILE_PATTERN = /(?:^|\s|["'`])([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]{1,8})(?:$|\s|["'`]|[,;:?!)])/g

function extractFiles(text: string): string[] {
  const matches: string[] = []
  let match: RegExpExecArray | null
  FILE_PATTERN.lastIndex = 0
  while ((match = FILE_PATTERN.exec(text)) !== null) {
    const filename = match[1]
    if (filename && !filename.startsWith("http") && !matches.includes(filename)) {
      matches.push(filename)
    }
  }
  return matches
}

export function detectIntent(text: string, signals: string[]): TaskIntent {
  if (!text.trim()) return "unknown"

  let bestIntent: TaskIntent = "unknown"
  let maxMatches = 0
  const intentScores: Partial<Record<TaskIntent, number>> = {}
  const intentSignals: Partial<Record<TaskIntent, string[]>> = {}

  for (const [intentKey, rules] of Object.entries(INTENT_RULES)) {
    const intent = intentKey as TaskIntent
    if (intent === "unknown") continue
    let count = 0
    const matchedSignals: string[] = []
    for (const rule of rules) {
      if (rule.pattern.test(text)) {
        count++
        matchedSignals.push(rule.signal)
      }
    }
    if (count > 0) {
      intentScores[intent] = count
      intentSignals[intent] = matchedSignals
      if (count > maxMatches) {
        maxMatches = count
        bestIntent = intent
      }
    }
  }

  if (bestIntent !== "unknown" && intentSignals[bestIntent]) {
    signals.push(...intentSignals[bestIntent]!)
  }

  return bestIntent
}

export function detectScope(
  text: string,
  input: ClassifyInput,
  intent: TaskIntent,
  signals: string[],
): TaskScope {
  if (!text.trim()) return "unknown"

  // 1. Trivial check
  for (const rule of TRIVIAL_RULES) {
    if (rule.pattern.test(text)) {
      signals.push(rule.signal)
      return "trivial"
    }
  }

  // 2. Cross check
  let crossCount = 0
  for (const rule of CROSS_RULES) {
    if (rule.pattern.test(text)) {
      crossCount++
      signals.push(rule.signal)
    }
  }
  if (crossCount > 0) {
    return "cross"
  }

  // 3. File mentions
  const files = input.mentionedFiles ?? extractFiles(text)
  if (files.length >= 2) {
    signals.push(`${files.length} files mentioned`)
    return "multi"
  }
  if (files.length === 1) {
    signals.push(`1 file mentioned: ${files[0]}`)
    return "single"
  }

  // 4. Active file present
  if (input.activeFile) {
    signals.push(`active file: ${input.activeFile}`)
    return "single"
  }

  // 5. Intent-driven scope heuristics
  if (intent === "feature" || intent === "refactor") {
    signals.push(`${intent} implies multi-file`)
    return "multi"
  }

  if (intent === "research" || intent === "unknown") {
    return "unknown"
  }

  return "single"
}

export function tierForScopeAndIntent(scope: TaskScope, intent: TaskIntent): ModelTier {
  if (scope === "trivial") return "C"
  if (scope === "cross") return "A"
  if (scope === "single") {
    if (intent === "research") return "C"
    return "B"
  }
  return "B"
}

/**
 * Classify task intent and scope from the user's message.
 * Pure function — no I/O, no LLM calls, deterministic.
 */
export function classifyIntent(input: ClassifyInput): IntentClassification {
  const message = input.message.length > 2000 ? input.message.slice(0, 2000) : input.message
  const signals: string[] = []

  // 1. Detect intent
  const intent = detectIntent(message, signals)

  // 2. Detect scope
  const scope = detectScope(message, input, intent, signals)

  // 3. Derive tier recommendation and write-tool need
  const suggestedMinTier = tierForScopeAndIntent(scope, intent)
  const needsWriteTools = intent !== "research" && intent !== "docs"

  // 4. Confidence: higher when more signals match
  const confidence = Math.min(0.3 + signals.length * 0.15, 0.95)

  return {
    intent,
    scope,
    confidence,
    reason: `${intent}/${scope}: ${signals.slice(0, 3).join(", ")}`,
    suggestedMinTier,
    needsWriteTools,
    signals,
  }
}
