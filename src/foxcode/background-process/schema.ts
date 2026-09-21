import { BusEvent } from "@/bus/bus-event"
import { Identifier } from "@/id/id"
import { SessionID } from "@/session/schema"
import { NonNegativeInt, PositiveInt, optionalOmitUndefined, withStatics } from "@opencode-ai/core/schema"
import { zod, ZodOverride } from "@opencode-ai/core/effect-zod"
import { Schema, Types } from "effect"
import z from "zod"

const idSchema = Schema.String.annotate({ [ZodOverride]: z.string().startsWith("bgp") }).pipe(
  Schema.brand("BackgroundProcessID"),
)
export type ID = typeof idSchema.Type
export const ID = idSchema.pipe(
  withStatics((schema: typeof idSchema) => ({
    ascending: (id?: string) => {
      if (id && !id.startsWith("bgp")) throw new Error(`Background process ID must start with bgp: ${id}`)
      return schema.make(id ?? Identifier.create("bgp", "ascending"))
    },
    zod: zod(schema),
  })),
)

export const Status = Schema.Literals(["starting", "running", "ready", "exited", "failed", "stopping", "stopped"])
export type Status = Schema.Schema.Type<typeof Status>

export const Lifetime = Schema.Literals(["session", "parent", "persistent"])
export type Lifetime = Schema.Schema.Type<typeof Lifetime>

export const Ready = Schema.Struct({
  pattern: optionalOmitUndefined(Schema.String).annotate({
    description: "Regular expression matched against output to mark the process ready",
  }),
  port: optionalOmitUndefined(PositiveInt).annotate({
    description: "Local TCP port to probe until accepting connections",
  }),
  timeout: optionalOmitUndefined(PositiveInt).annotate({
    description: "Milliseconds to wait for readiness before returning the process as running",
  }),
})
  .annotate({ identifier: "BackgroundProcessReady" })
  .pipe(withStatics((s) => ({ zod: zod(s) })))
export type Ready = Types.DeepMutable<Schema.Schema.Type<typeof Ready>>

export const Info = Schema.Struct({
  id: ID,
  sessionID: SessionID,
  pid: optionalOmitUndefined(PositiveInt),
  command: Schema.String,
  cwd: Schema.String,
  description: optionalOmitUndefined(Schema.String),
  ports: Schema.mutable(Schema.Array(PositiveInt)),
  status: Status,
  lifetime: Lifetime,
  ready: Schema.Boolean,
  exitCode: optionalOmitUndefined(Schema.NullOr(NonNegativeInt)),
  signal: optionalOmitUndefined(Schema.NullOr(Schema.String)),
  output: Schema.String,
  time: Schema.Struct({
    started: NonNegativeInt,
    updated: NonNegativeInt,
    ended: optionalOmitUndefined(NonNegativeInt),
  }),
})
  .annotate({ identifier: "BackgroundProcessInfo" })
  .pipe(withStatics((s) => ({ zod: zod(s) })))
export type Info = Types.DeepMutable<Schema.Schema.Type<typeof Info>>

export const StartInput = Schema.Struct({
  sessionID: SessionID,
  command: Schema.String.annotate({ description: "Command to run in the configured shell" }),
  cwd: optionalOmitUndefined(Schema.String).annotate({
    description: "Working directory. Defaults to the project directory",
  }),
  description: optionalOmitUndefined(Schema.String).annotate({ description: "Short human readable process label" }),
  ready: optionalOmitUndefined(Ready),
  lifetime: optionalOmitUndefined(Lifetime),
  parentID: optionalOmitUndefined(SessionID),
})
  .annotate({ identifier: "BackgroundProcessStartInput" })
  .pipe(withStatics((s) => ({ zod: zod(s) })))
export type StartInput = Types.DeepMutable<Schema.Schema.Type<typeof StartInput>>

export const Logs = Schema.Struct({
  id: ID,
  sessionID: SessionID,
  output: Schema.String,
})
  .annotate({ identifier: "BackgroundProcessLogs" })
  .pipe(withStatics((s) => ({ zod: zod(s) })))
export type Logs = Types.DeepMutable<Schema.Schema.Type<typeof Logs>>

export const Event = {
  Updated: BusEvent.define(
    "background_process.updated",
    Schema.Struct({
      info: Info,
      scope: Schema.String,
    }),
  ),
  Deleted: BusEvent.define(
    "background_process.deleted",
    Schema.Struct({
      sessionID: SessionID,
      processID: ID,
      scope: Schema.String,
    }),
  ),
}
