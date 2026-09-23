import type { Argv } from "yargs"
import { Effect } from "effect"
import { cmd } from "./cmd"
import { effectCmd, CliError } from "../effect-cmd"
import { Checkpoint } from "@opencode-ai/core/checkpoint"
import { LocationServiceMap, locationServiceMapLayer } from "@opencode-ai/core/location-services"
import { Location } from "@opencode-ai/core/location"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { UI } from "../ui"
import { Locale } from "@/util/locale"
import { EOL } from "os"

const withLocation = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.provide(LocationServiceMap.Service.get(Location.Ref.make({ directory: AbsolutePath.make(process.cwd()) }))),
    Effect.provide(locationServiceMapLayer),
  )

export const CheckpointListCommand = effectCmd({
  command: "list",
  describe: "list recorded shadow checkpoints",
  builder: (yargs) =>
    yargs.option("format", {
      describe: "output format",
      type: "string",
      choices: ["table", "json"],
      default: "table",
    }),
  handler: Effect.fn("Cli.checkpoint.list")(function* (args) {
    const list = yield* withLocation(
      Checkpoint.Service.use((svc) => svc.list()),
    ).pipe(Effect.orDie)

    if (list.length === 0) {
      UI.println(UI.Style.TEXT_DIM + "No checkpoints recorded yet." + UI.Style.TEXT_NORMAL)
      return
    }

    if (args.format === "json") {
      console.log(JSON.stringify(list, null, 2))
      return
    }

    const maxIdWidth = Math.max(16, ...list.map((c) => c.id.length))
    const maxNameWidth = Math.max(14, ...list.map((c) => (c.name ?? "").length))
    const maxSourceWidth = Math.max(12, ...list.map((c) => c.source.length))

    const header = `ID${" ".repeat(maxIdWidth - 2)}  Name${" ".repeat(maxNameWidth - 4)}  Source${" ".repeat(maxSourceWidth - 6)}  Files  Created`
    const lines: string[] = [header, "─".repeat(header.length + 8)]

    for (const c of list) {
      const name = (c.name ?? "").padEnd(maxNameWidth)
      const source = c.source.padEnd(maxSourceWidth)
      const timeStr = Locale.todayTimeOrDateTime(c.timestamp)
      const filesCount = String(c.files.length).padStart(5)
      lines.push(`${c.id.padEnd(maxIdWidth)}  ${name}  ${source}  ${filesCount}  ${timeStr}`)
    }

    console.log(lines.join(EOL))
  }),
})

export const CheckpointCreateCommand = effectCmd({
  command: "create <name>",
  describe: "create a named checkpoint of current workspace state",
  builder: (yargs) =>
    yargs
      .positional("name", {
        type: "string",
        demandOption: true,
        describe: "Name for the checkpoint (e.g. pre-refactor)",
      })
      .option("description", {
        alias: "d",
        type: "string",
        describe: "Optional description of checkpoint",
      }),
  handler: Effect.fn("Cli.checkpoint.create")(function* (args) {
    const created = yield* withLocation(
      Checkpoint.Service.use((svc) => svc.create(args.name, args.description)),
    ).pipe(
      Effect.mapError((err) => new CliError({ message: err.message })),
    )

    UI.println(
      UI.Style.TEXT_SUCCESS_BOLD +
        `Checkpoint created: "${created.name ?? created.id}" (${created.id})` +
        UI.Style.TEXT_NORMAL,
    )
  }),
})

export const CheckpointUndoCommand = effectCmd({
  command: "undo [checkpoint]",
  describe: "revert workspace files to a previous or named checkpoint",
  builder: (yargs) =>
    yargs.positional("checkpoint", {
      type: "string",
      describe: "Checkpoint ID or name to restore (defaults to previous checkpoint)",
    }),
  handler: Effect.fn("Cli.checkpoint.undo")(function* (args) {
    const result = yield* withLocation(
      Checkpoint.Service.use((svc) => svc.undo(args.checkpoint)),
    ).pipe(
      Effect.mapError((err) => new CliError({ message: err.message })),
    )

    if (!result.success) {
      UI.println(UI.Style.TEXT_WARNING + result.message + UI.Style.TEXT_NORMAL)
      return
    }

    UI.println(UI.Style.TEXT_SUCCESS_BOLD + result.message + UI.Style.TEXT_NORMAL)
    if (result.restoredFiles.length > 0) {
      for (const file of result.restoredFiles) {
        UI.println(UI.Style.TEXT_DIM + `  ↺ ${file}` + UI.Style.TEXT_NORMAL)
      }
    }
  }),
})

export const CheckpointDiffCommand = effectCmd({
  command: "diff [checkpoint]",
  describe: "show diff between current workspace and a checkpoint",
  builder: (yargs) =>
    yargs.positional("checkpoint", {
      type: "string",
      describe: "Checkpoint ID or name (defaults to most recent checkpoint)",
    }),
  handler: Effect.fn("Cli.checkpoint.diff")(function* (args) {
    const diffs = yield* withLocation(
      Checkpoint.Service.use((svc) => svc.diff(args.checkpoint)),
    ).pipe(
      Effect.mapError((err) => new CliError({ message: err.message })),
    )

    if (diffs.length === 0) {
      UI.println(UI.Style.TEXT_DIM + "No changes detected since checkpoint." + UI.Style.TEXT_NORMAL)
      return
    }

    for (const d of diffs) {
      UI.println(UI.Style.TEXT_NORMAL_BOLD + `diff ${d.path}` + UI.Style.TEXT_NORMAL)
      if (d.patch) {
        console.log(d.patch)
      }
    }
  }),
})

export const CheckpointCommand = cmd({
  command: "checkpoint",
  describe: "manage named shadow checkpoints and undo",
  builder: (yargs: Argv) =>
    yargs
      .command(CheckpointListCommand)
      .command(CheckpointCreateCommand)
      .command(CheckpointUndoCommand)
      .command(CheckpointDiffCommand)
      .demandCommand(),
  async handler() {},
})
