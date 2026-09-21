export * as Transaction from "./transaction"

import { Effect } from "effect"
import type { FSUtil } from "./fs-util"

/**
 * A single journal entry recording the pre-image of a file before mutation.
 * - `preImage: null` means the file did not exist (was created during the transaction).
 * - `preImage: Uint8Array` means the file existed with these exact bytes.
 */
export interface JournalEntry {
  readonly canonical: string
  readonly preImage: Uint8Array | null
}

/**
 * An in-memory content journal that enables all-or-nothing multi-file mutations.
 *
 * Design:
 * - **Journal-on-first-write**: Only the first mutation of a given file within a
 *   transaction records its pre-image. Subsequent writes to the same file do not
 *   re-journal — the original pre-image is the rollback target.
 * - **Rollback restores pre-images**: For creates (pre-image `null`), rollback
 *   deletes the file. For updates/deletes, rollback writes the original bytes.
 * - **Commit is a no-op**: Writes happen eagerly to disk (required for permission
 *   UX and incremental tool output). Commit simply seals the journal.
 * - **Scoped to a single Effect.gen block** — not a persistent database transaction.
 */
export interface Transaction {
  /**
   * Record a file's pre-image before mutating it. Only the first call for a
   * given canonical path is recorded; subsequent calls are no-ops.
   */
  readonly journal: (canonical: string, preImage: Uint8Array | null) => void

  /**
   * Seal the transaction. Clears the journal. After commit, rollback is a no-op.
   */
  readonly commit: () => void

  /**
   * Roll back all journaled files to their pre-images.
   * - Pre-image `null` → delete the file (it was created during the transaction).
   * - Pre-image `Uint8Array` → write the original bytes back.
   * After rollback the journal is cleared.
   */
  readonly rollback: (fs: FSUtil.Interface) => Effect.Effect<void>

  /**
   * Whether the transaction has been committed or rolled back.
   */
  readonly sealed: () => boolean

  /**
   * Read-only view of journal entries for inspection / dry-run reporting.
   */
  readonly entries: () => ReadonlyMap<string, Uint8Array | null>
}

/**
 * Create a new in-memory transaction.
 */
export function create(): Transaction {
  const _journal = new Map<string, Uint8Array | null>()
  let _sealed = false

  return {
    journal(canonical: string, preImage: Uint8Array | null) {
      if (_sealed) return
      if (_journal.has(canonical)) return
      _journal.set(canonical, preImage)
    },

    commit() {
      _sealed = true
      _journal.clear()
    },

    rollback(fs: FSUtil.Interface) {
      if (_sealed) return Effect.void
      _sealed = true
      return Effect.gen(function* () {
        // Rollback in reverse insertion order to handle dependent paths correctly
        const entries = [..._journal.entries()].reverse()
        for (const [canonical, preImage] of entries) {
          if (preImage === null) {
            // File was created during the transaction — delete it
            yield* fs.remove(canonical, { force: true }).pipe(
              Effect.catch(() => Effect.void),
            )
          } else {
            // File existed before — restore original bytes
            yield* fs.writeFile(canonical, preImage).pipe(
              Effect.catch(() => Effect.void),
            )
          }
        }
        _journal.clear()
      })
    },

    sealed() {
      return _sealed
    },

    entries() {
      return _journal
    },
  }
}
