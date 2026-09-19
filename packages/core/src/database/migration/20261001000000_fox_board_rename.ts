import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

/**
 * Rename kilo_board_message → fox_board_message and kilo_board → fox_board.
 *
 * SQLite supports ALTER TABLE … RENAME TO since 3.26 (2018).
 * We use it directly here — bun ships a modern SQLite.
 *
 * Both renames are guarded: if the old table doesn't exist (fresh install that
 * was never a kilo install) the migration is a no-op.
 */
export default {
  id: "20261001000000_fox_board_rename",
  up(tx) {
    return Effect.gen(function* () {
      // Check which tables exist — cast via unknown since tx.run is untyped at row level
      const tables = (yield* tx.run(
        `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('kilo_board_message', 'kilo_board')`,
      )) as unknown as Array<{ name: string }>
      const names = new Set(tables.map((t) => t.name))

      if (names.has("kilo_board_message")) {
        yield* tx.run(`ALTER TABLE \`kilo_board_message\` RENAME TO \`fox_board_message\``)
      }
      if (names.has("kilo_board")) {
        yield* tx.run(`ALTER TABLE \`kilo_board\` RENAME TO \`fox_board\``)
      }
    })
  },
} satisfies DatabaseMigration.Migration
