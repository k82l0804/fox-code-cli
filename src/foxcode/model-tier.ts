/**
 * Model Capability Tier System
 *
 * Classifies LLM models into capability tiers based on parameter count,
 * curated profiles, and provider heuristics. Used by the session loop
 * to cap multi-turn steps, warn users, and surface tier info for
 * autonomous subagent model routing.
 *
 * Resolution priority:
 * 1. Explicit override (config `model_tier` or `FOX_MODEL_TIER` env)
 * 2. `tier` field in matched ModelProfile from model-profiles.json
 * 3. Pattern extraction from model ID (regex for parameter count)
 * 4. Frontier provider heuristic (OpenAI/Anthropic/Google → S, unknown → B)
 */

export type ModelTier = "S" | "A" | "B" | "C" | "D"

export interface TierInfo {
  readonly tier: ModelTier
  readonly label: string
  /** Maximum agentic loop steps. Infinity for S/A, 5 for B, 3 for C, 1 for D */
  readonly maxSteps: number
  /** Whether the model can reliably produce correct code edits */
  readonly codingReliable: boolean
  /** Whether to warn when used in coding/debug agent modes */
  readonly warnOnCoding: boolean
  /** Whether the tier uses harness fence-parsing instead of edit tool schemas (Tier C/D) */
  readonly useFenceParse: boolean
  /** How the tier was determined */
  readonly source: "override" | "profile" | "pattern" | "heuristic" | "reclassified"
}

interface TierMeta {
  readonly label: string
  readonly maxSteps: number
  readonly codingReliable: boolean
  readonly warnOnCoding: boolean
  readonly useFenceParse: boolean
}

/**
 * Static tier metadata. Keyed by tier letter.
 */
export const TIER_META: Record<ModelTier, TierMeta> = {
  S: { label: "Production-grade (70B+)", maxSteps: Infinity, codingReliable: true, warnOnCoding: false, useFenceParse: false },
  A: { label: "Reliable multi-turn (30-40B)", maxSteps: Infinity, codingReliable: true, warnOnCoding: false, useFenceParse: false },
  B: { label: "Partial repair (13-20B)", maxSteps: 5, codingReliable: true, warnOnCoding: false, useFenceParse: false },
  C: { label: "Summarization only (7-10B)", maxSteps: 3, codingReliable: false, warnOnCoding: true, useFenceParse: true },
  D: { label: "Basic chat (<7B)", maxSteps: 1, codingReliable: false, warnOnCoding: true, useFenceParse: true },
}

/**
 * Repo map token budget allocated per model tier for buildCodeContextBlock().
 * S/A/B receive 1000 tokens; C/D receive 1500 tokens (weak models need more pre-injected context).
 */
export const TIER_MAP_TOKEN_BUDGET: Record<ModelTier, number> = {
  S: 1000,
  A: 1000,
  B: 1000,
  C: 1500,
  D: 1500,
}

/**
 * Provider IDs whose models default to Tier S when parameter count
 * cannot be determined. These are frontier API providers.
 */
export const FRONTIER_PROVIDERS = new Set([
  "openai",
  "anthropic",
  "google",
  "xai",
  "amazon-bedrock",
  "azure",
  "opencode",
  "fox",
  "kilo",
])

// ---------------------------------------------------------------------------
// Parameter extraction
// ---------------------------------------------------------------------------

/**
 * Regex patterns to extract parameter count (in billions) from model IDs.
 *
 * Matches patterns like:
 * - `llama-3.1-8b-instruct` → 8
 * - `gemma-4-27b` → 27
 * - `codestral:32b` → 32
 * - `qwen2.5-72b-instruct` → 72
 * - `phi-4-mini-3.8b` → 3.8
 * - `llama3.1:70b-instruct-q4_K_M` → 70
 *
 * Does NOT match version numbers like `3.1` or `2.5` that appear before
 * the parameter segment.
 */
const PARAM_PATTERNS = [
  // "8b", "70b", "27b" preceded by separator or start
  /(?:^|[-_:./])(\d+(?:\.\d+)?)[bB](?:[-_:./]|$)/,
  // "8B-instruct" style
  /(\d+(?:\.\d+)?)[bB]-/,
  // Explicit "XxY" notation used by some providers (e.g., "8x7b")
  /(\d+)x(\d+(?:\.\d+)?)[bB]/,
]

/**
 * Extract parameter count in billions from a model ID string.
 * Returns undefined if no parameter count pattern is found.
 */
export function extractParamCount(modelId: string): number | undefined {
  const lower = modelId.toLowerCase()

  // Try MoE pattern first (e.g., "8x7b" = 56B active or use the total)
  const moe = PARAM_PATTERNS[2].exec(lower)
  if (moe) {
    const experts = parseFloat(moe[1])
    const perExpert = parseFloat(moe[2])
    // MoE total parameter count (e.g., Mixtral 8x7B ≈ 46B total)
    return experts * perExpert
  }

  for (const pattern of PARAM_PATTERNS.slice(0, 2)) {
    const match = pattern.exec(lower)
    if (match) {
      const value = parseFloat(match[1])
      // Sanity: parameter counts are typically 1-1000B.
      // Filter out version numbers that happen to match (e.g., "3.1")
      if (value >= 1 && value <= 1000) return value
    }
  }

  return undefined
}

// ---------------------------------------------------------------------------
// Tier classification
// ---------------------------------------------------------------------------

/**
 * Map a parameter count (in billions) to a capability tier.
 */
export function tierFromParams(params: number): ModelTier {
  if (params >= 70) return "S"
  if (params >= 30) return "A"
  if (params >= 13) return "B"
  if (params >= 7) return "C"
  return "D"
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export interface ResolveTierInput {
  readonly modelId?: string
  readonly providerId?: string
  /** Explicit tier from config `model_tier` field */
  readonly overrideTier?: string | null
  /** Tier from matched ModelProfile (model-profiles.json) */
  readonly profileTier?: string
  /** Parameter hint from matched ModelProfile */
  readonly profileParamHint?: number
  /** Explicit profile override */
  readonly overrideProfile?: string
}

const VALID_TIERS = new Set<string>(["S", "A", "B", "C", "D"])

function isValidTier(value: string | undefined | null): value is ModelTier {
  return typeof value === "string" && VALID_TIERS.has(value.toUpperCase())
}

/**
 * Resolve the capability tier for a model through the full priority chain:
 * 1. Config/env override (`model_tier` or `FOX_MODEL_TIER`)
 * 2. Profile `tier` field from model-profiles.json
 * 3. Parameter count extracted from model ID
 * 4. Frontier provider heuristic
 */
export function resolveTier(input: ResolveTierInput): TierInfo {
  // 1. Explicit override
  if (input.overrideTier && isValidTier(input.overrideTier)) {
    const tier = input.overrideTier.toUpperCase() as ModelTier
    return { tier, ...TIER_META[tier], source: "override" }
  }

  const envTier = process.env["FOX_MODEL_TIER"]
  if (!input.overrideTier && envTier && isValidTier(envTier)) {
    const tier = envTier.toUpperCase() as ModelTier
    return { tier, ...TIER_META[tier], source: "override" }
  }

  // 2. Profile tier
  if (input.profileTier && isValidTier(input.profileTier)) {
    const tier = input.profileTier.toUpperCase() as ModelTier
    return { tier, ...TIER_META[tier], source: "profile" }
  }

  // 3. Parameter count from model ID
  const modelId = input.modelId ?? ""
  const params = extractParamCount(modelId) ?? input.profileParamHint
  if (params !== undefined) {
    const tier = tierFromParams(params)
    return { tier, ...TIER_META[tier], source: "pattern" }
  }

  // 4. Frontier provider heuristic
  const providerId = input.providerId?.toLowerCase() ?? ""
  if (FRONTIER_PROVIDERS.has(providerId)) {
    return { tier: "S", ...TIER_META.S, source: "heuristic" }
  }

  // Unknown model from unknown provider — assume mid-range
  return { tier: "B", ...TIER_META.B, source: "heuristic" }
}

/**
 * Calculates maxSteps taking agent explicit steps and model tier into account.
 * Agent-configured steps always take precedence over tier default.
 */
export function computeMaxSteps(agentSteps: number | undefined, tierInfo: TierInfo): number {
  return agentSteps ?? tierInfo.maxSteps
}

/**
 * Determines whether a warning should be emitted for using the given model in a coding agent.
 */
export function shouldWarnCoding(tierInfo: TierInfo, agentName: string): boolean {
  return tierInfo.warnOnCoding && ["code", "debug"].includes(agentName)
}

/**
 * Determines whether execution should be hard-refused when refuse_small_model_coding is set.
 */
export function shouldRefuseCoding(options: {
  readonly tierInfo: TierInfo
  readonly agentName: string
  readonly refuseSmallModelCoding?: boolean
}): boolean {
  if (!options.refuseSmallModelCoding) return false
  if (!options.tierInfo.warnOnCoding) return false
  return ["code", "debug"].includes(options.agentName)
}

// ---------------------------------------------------------------------------
// Tool surface filtering
// ---------------------------------------------------------------------------

/**
 * Tool IDs that are safe for all tiers — read-only, single-invocation,
 * or designed for small models. These tools remain available regardless
 * of tier filtering.
 */
export const TIER_SAFE_TOOLS = new Set([
  "read",
  "grep",
  "glob",
  "bash",
  "webfetch",
  "websearch",
  "question",
  "invalid",
  "todowrite",
  "rewrite_file",
  "recall",
  "repo_overview",
  "semantic_search",
  "notebook_read",
  // Kilo tools that are read-only / status
  "agent_manager_models",
  "fox_memory_recall",
  "kilo_memory_recall",
  "kilo_local_recall",
])

/**
 * Canonical tool surface mapping per model capability tier (Phase 2E Task 2E-4).
 * - S/A: full tool-calling suite with lookup_symbols
 * - B: full tool-calling suite
 * - C/D: minimal explore-only suite (grep + bash); edits handled via harness fence-parse
 */
export const TIER_TOOL_SURFACE: Record<ModelTier, Set<string>> = {
  S: new Set(["edit", "rewrite_file", "read", "grep", "glob", "lsp", "bash", "lookup_symbols"]),
  A: new Set(["edit", "rewrite_file", "read", "grep", "glob", "lsp", "bash", "lookup_symbols"]),
  B: new Set(["edit", "rewrite_file", "read", "grep", "glob", "lsp", "bash"]),
  C: new Set(["grep", "bash"]),
  D: new Set(["grep", "bash"]),
}

/**
 * Tools removed from default surface for ALL tiers:
 * - apply_patch: internal harness use only
 * - write: deprecated, subsumed into rewrite_file(create: true)
 * - commit: harness-owned only
 * - fetch_repo_map: injected via code context block in system prefix
 */
export const EXCLUDED_FROM_ALL_TIERS = new Set(["apply_patch", "write", "commit", "fetch_repo_map"])

/**
 * Standard known built-in tool IDs for classification.
 */
export const KNOWN_BUILTIN_TOOLS = new Set([
  "edit",
  "rewrite_file",
  "write",
  "apply_patch",
  "read",
  "grep",
  "glob",
  "lsp",
  "bash",
  "commit",
  "fetch_repo_map",
  "lookup_symbols",
  "task",
  "skill",
  "webfetch",
  "websearch",
  "question",
  "todo",
  "todowrite",
  "plan_exit",
  "notebook_edit",
  "notebook_execute",
  "notebook_read",
  "agent_manager",
  "agent_manager_models",
  "background_process",
  "board_read",
  "board_post",
  "goal_report",
  "browser_open",
  "cancel_wakeup",
  "chart",
  "generate_image",
  "memory_recall",
  "memory_save",
  "fox_memory_recall",
  "fox_memory_save",
  "kilo_memory_recall",
  "kilo_memory_save",
  "kilo_local_recall",
  "notify_user",
  "open_plan",
  "schedule_wakeup",
  "send_file",
  "repo_overview",
  "repo_clone",
  "invalid",
  "suggest",
  "recall",
  "semantic_search",
])

/**
 * Tool IDs hidden from Tier C/D models. These tools require multi-step
 * reasoning, complex schema formatting (diffs, patches), or recursive
 * subagent coordination that small models cannot reliably handle.
 */
export const TIER_COMPLEX_TOOLS = new Set([
  "task",
  "write",
  "edit",
  "apply_patch",
  "skill",
  "lookup_symbols",
  "fetch_repo_map",
  "lsp",
  "commit",
  "notebook_edit",
  "notebook_execute",
  // Kilo write tools that require multi-step reasoning
  "agent_manager",
  "fox_memory_save",
  "kilo_memory_save",
])

/**
 * Filter a tool list based on the model's capability tier (Canonical ACI Matrix).
 *
 * - Tiers S/A: edit, rewrite_file, read, grep, glob, lsp, bash, lookup_symbols
 * - Tier B: edit, rewrite_file, read, grep, glob, lsp, bash
 * - Tiers C/D: grep, bash only (fence-parse editing handled by harness)
 * - Custom/plugin tools outside KNOWN_BUILTIN_TOOLS pass through.
 *
 * @param tools - Array of objects with an `id` field
 * @param tierInfo - The resolved tier info
 * @param enabled - When false, no filtering is applied (config override)
 */
export function filterToolsByTier<T extends { id: string }>(
  tools: T[],
  tierInfo: TierInfo,
  enabled: boolean = true,
): T[] {
  if (!enabled) return tools
  const allowed = TIER_TOOL_SURFACE[tierInfo.tier] ?? TIER_TOOL_SURFACE.B
  return tools.filter((tool) => {
    if (KNOWN_BUILTIN_TOOLS.has(tool.id)) {
      return allowed.has(tool.id)
    }
    return true
  })
}

// ---------------------------------------------------------------------------
// Runtime tier reclassification
// ---------------------------------------------------------------------------

/**
 * Tracks dynamic tier promotion/demotion within a session loop.
 * Only C↔B transitions are allowed — S, A, and D tiers are never changed.
 */
export interface TierReclassState {
  /** Current (possibly reclassified) tier info */
  current: TierInfo
  /** Original tier info at session start */
  readonly original: TierInfo
  /** Consecutive tool call failures (reset on success) */
  consecutiveFailures: number
  /** Whether any reclassification has occurred */
  reclassified: boolean
}

/**
 * Create initial reclassification state from a resolved tier.
 */
export function createReclassState(initial: TierInfo): TierReclassState {
  return {
    current: initial,
    original: initial,
    consecutiveFailures: 0,
    reclassified: false,
  }
}

/**
 * Process a successful tool call. May promote C → B.
 *
 * Rules:
 * - Only C → B promotion is supported
 * - S, A, B, D tiers are never promoted
 * - Success always resets the failure counter
 */
export function reclassifyOnSuccess(state: TierReclassState): TierReclassState {
  const next = { ...state, consecutiveFailures: 0 }
  if (next.current.tier === "C") {
    next.current = { tier: "B", ...TIER_META.B, source: "reclassified" }
    next.reclassified = true
  }
  return next
}

/**
 * Process a tool call failure. May demote B → C after 2 consecutive failures.
 *
 * Rules:
 * - Only B → C demotion is supported
 * - Only demotes models whose original tier is not B (preserves B-native models)
 * - Requires 2+ consecutive failures
 * - S, A, C, D tiers are never demoted
 */
export function reclassifyOnFailure(state: TierReclassState): TierReclassState {
  const next = { ...state, consecutiveFailures: state.consecutiveFailures + 1 }
  if (next.current.tier === "B" && next.consecutiveFailures >= 2 && state.original.tier !== "B") {
    next.current = { tier: "C", ...TIER_META.C, source: "reclassified" }
    next.reclassified = true
  }
  return next
}

export * as ModelTierModule from "./model-tier"

