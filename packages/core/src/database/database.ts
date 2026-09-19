export * as Database from "./database"

import { EffectDrizzleSqlite } from "@opencode-ai/effect-drizzle-sqlite"
import { layer as sqliteLayer } from "#sqlite"
import { Context, Effect, Layer } from "effect"
import { Global } from "../global"
import { Flag } from "../flag/flag"
import { isAbsolute, join } from "path"
import { existsSync } from "fs"
import { DbPreflight } from "../foxcode/db-preflight"
import { ensure as compat } from "../foxcode/database-compat"
import { DatabaseMigration } from "./migration"
import { InstallationChannel } from "../installation/version"
import { makeGlobalNode } from "../effect/app-node"

const makeDatabase = EffectDrizzleSqlite.makeWithDefaults()
type DatabaseShape = Effect.Success<typeof makeDatabase>

export interface Interface {
  db: DatabaseShape
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/storage/Database") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const db = yield* makeDatabase
    yield* db.run("PRAGMA busy_timeout = 5000")
    yield* db.run("PRAGMA journal_mode = WAL")
    yield* db.run("PRAGMA synchronous = NORMAL")
    yield* db.run("PRAGMA cache_size = -64000")
    yield* db.run("PRAGMA foreign_keys = ON")
    yield* db.run("PRAGMA wal_checkpoint(PASSIVE)")
    yield* DatabaseMigration.apply(db)
    yield* compat(db)
    return { db }
  }).pipe(Effect.orDie),
)

export function layerFromPath(filename: string) {
  DbPreflight.assertWritable(filename)
  return layer.pipe(Layer.provide(sqliteLayer({ filename, disableWAL: true })))
}

export function path() {
  if (Flag.FOX_DB) {
    if (Flag.FOX_DB === ":memory:" || isAbsolute(Flag.FOX_DB)) return Flag.FOX_DB
    return join(Global.Path.data, Flag.FOX_DB)
  }
  if (
    ["latest", "beta", "prod"].includes(InstallationChannel) ||
    Flag.FOX_DISABLE_CHANNEL_DB
  )
    return join(Global.Path.data, "fox.db")
  const safe = InstallationChannel.replace(/[^a-zA-Z0-9._-]/g, "-")
  const next = join(Global.Path.data, `fox-${safe}.db`)
  const prevKilo = join(Global.Path.data, `kilo-${safe}.db`)
  const prevOpencode = join(Global.Path.data, `opencode-${safe}.db`)
  if (!existsSync(next)) {
    if (existsSync(prevKilo)) return prevKilo
    if (existsSync(prevOpencode)) return prevOpencode
  }
  return next
}
export const node = makeGlobalNode({
  service: Service,
  layer: Layer.unwrap(Effect.sync(() => layerFromPath(path()))),
  deps: [],
})
