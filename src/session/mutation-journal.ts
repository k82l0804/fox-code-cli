/**
 * Mutation Journal — session-scoped, append-only log of successful mutations
 * applied by the harness.
 *
 * Enforces the Phase 2E loop assertion:
 * "Harness applied ≥1 successful mutation since the user message that started this goal."
 */

export interface MutationEntry {
  /** The mutation tool that applied the change: "edit" | "apply_patch" | "write" | "rewrite_file" */
  readonly tool: string
  /** Absolute path of the mutated file */
  readonly file: string
  /** Timestamp when mutation occurred */
  readonly timestamp: number
  /** Assistant message ID that triggered the tool */
  readonly messageId: string
}

export interface MutationJournal {
  /** All mutations since the current goal started. */
  readonly entries: readonly MutationEntry[]
  /** True if no mutations have been successfully applied. */
  isEmpty(): boolean
  /** True if at least one mutation was successfully applied. */
  hasEntries(): boolean
  /** Record a successful mutation. Excludes "commit" and invalid entries. */
  record(entry: MutationEntry): void
  /** Reset on new user message (new goal). */
  reset(): void
  /** Count of unique files mutated. */
  fileCount(): number
  /** Most recent mutation entry, if any. */
  lastEntry(): MutationEntry | undefined
}

/** Non-mutating tools that must be explicitly excluded from counting as file mutations. */
const EXCLUDED_TOOLS = new Set(["commit"])

export function createJournal(): MutationJournal {
  const entries: MutationEntry[] = []

  return {
    get entries() {
      return [...entries]
    },
    isEmpty() {
      return entries.length === 0
    },
    hasEntries() {
      return entries.length > 0
    },
    record(entry: MutationEntry) {
      if (!entry || !entry.file) return
      if (EXCLUDED_TOOLS.has(entry.tool)) return
      entries.push(Object.freeze({ ...entry }))
    },
    reset() {
      entries.length = 0
    },
    fileCount() {
      return new Set(entries.map((e) => e.file)).size
    },
    lastEntry() {
      return entries.length > 0 ? entries[entries.length - 1] : undefined
    },
  }
}
