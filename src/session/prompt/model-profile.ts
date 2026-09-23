import type { ModelTier } from "@/foxcode/model-tier"
import MODEL_PROFILES_DATA from "./model-profiles.json"

export interface ModelProfile {
  readonly id: string
  readonly name: string
  readonly tier?: ModelTier
  readonly parameterHint?: number
  readonly patterns: readonly string[]
  readonly contextWindow: number
  readonly toolCalling: "native" | "xml" | "json-markdown"
  readonly systemPromptBudget: number
  readonly temperature: number
  readonly topP: number
  readonly promptFile: string
  readonly quirks: readonly string[]
}

export interface ResolveProfileInput {
  readonly modelId?: string
  readonly providerId?: string
  readonly overrideProfile?: string
}

const profiles: readonly ModelProfile[] = MODEL_PROFILES_DATA.profiles as ModelProfile[]
const defaultProfile: ModelProfile = MODEL_PROFILES_DATA.default as ModelProfile

/**
 * Normalizes common model identifiers, stripping version tags, colons (e.g., Ollama 'llama3.1:8b'),
 * and directory prefixes for robust matching.
 */
function normalizeIdentifier(id: string): string {
  return id
    .toLowerCase()
    .replace(/:(latest|[\w\.-]+)$/, "") // Strip Ollama tags like :8b, :latest
    .replace(/[^a-z0-9\/\-_.]/g, "")
}

/**
 * Match a target string against a pattern, checking for substring containment
 * or normalized key equality.
 */
function matchesPattern(target: string, pattern: string): boolean {
  const normTarget = normalizeIdentifier(target)
  const normPattern = normalizeIdentifier(pattern)

  if (normTarget === normPattern) return true
  if (normTarget.includes(normPattern)) return true

  // Handle hyphen/dot variations (e.g., "llama3.1" vs "llama-3.1" or "gemma2" vs "gemma-2")
  const strippedTarget = normTarget.replace(/[-_.]/g, "")
  const strippedPattern = normPattern.replace(/[-_.]/g, "")
  return strippedTarget.includes(strippedPattern)
}

/**
 * Resolves the appropriate ModelProfile based on:
 * 1. Explicit override (e.g. --profile <id> or fox.jsonc model_profile)
 * 2. Auto-detection matching modelId and providerId against curated profiles
 * 3. Fallback to default profile
 */
export function resolveProfile(input: ResolveProfileInput): ModelProfile {
  // 1. Explicit override (config, flag, or FOX_MODEL_PROFILE env)
  const override = input.overrideProfile ?? process.env["FOX_MODEL_PROFILE"]
  if (override) {
    const matched = getProfile(override)
    if (matched) return matched
  }

  // 2. Auto-detection
  const candidates: string[] = []
  if (input.modelId) {
    candidates.push(input.modelId)
    if (input.providerId) {
      candidates.push(`${input.providerId}/${input.modelId}`)
    }
  }

  if (candidates.length > 0) {
    for (const profile of profiles) {
      for (const pattern of profile.patterns) {
        if (candidates.some((c) => matchesPattern(c, pattern))) {
          return profile
        }
      }
    }
  }

  return defaultProfile
}

/**
 * Returns all configured model profiles.
 */
export function listProfiles(): readonly ModelProfile[] {
  return profiles
}

/**
 * Finds a profile by ID or name (case-insensitive).
 */
export function getProfile(idOrName: string): ModelProfile | undefined {
  const norm = idOrName.toLowerCase().trim()
  return profiles.find((p) => p.id.toLowerCase() === norm || p.name.toLowerCase() === norm)
}

export * as ModelProfile from "./model-profile"
