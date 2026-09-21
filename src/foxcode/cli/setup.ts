import type { Argv } from "yargs"
import * as Log from "@opencode-ai/core/util/log"
import { InstallationBuildKind, InstallationVersion } from "@opencode-ai/core/installation/version"
import { FoxShutdown } from "@/foxcode/cli/shutdown"
import { createHelpCommand } from "@/foxcode/help-command"
import { hasLazyCommandSelection } from "@/foxcode/cli/lazy-commands"
import type { Auth } from "@/auth"
import {
  ConfigCLICommand,
  CompressionCLICommand,
  DaemonCommand,
  PtySmokeCommand,
  RollCallCommand,
  StandardSuiteCLICommand,
  WorktreeCommand,
} from "@/foxcode/cli/lazy-fox-commands"

const log = Log.create({ service: "foxcode.cli" })

// All Kilo-specific CLI customization lives here so the shared upstream entrypoint
// (src/index.ts) only needs a handful of thin call-sites behind kilocode_change markers.
// This keeps index.ts close to upstream and reduces merge conflicts on every sync.
//
// Startup cost note: this module is imported eagerly from src/index.ts, so its static
// import graph must stay light. Heavy dependencies (telemetry, gateway auth migration,
// AppRuntime, config, auth, session-export, JSON migration) are dynamically imported
// inside the function that needs them, following the deferral pattern upstream applied
// in opencode#30453. The registered command modules must follow the same rule: a light
// top level, with implementation imports inside their handlers.
export namespace FoxCli {
  let info = false
  let narrow = false

  export function workerTui(opts: { [key: string]: unknown }) {
    return !hasLazyCommandSelection() && opts.mini !== true && !opts.worktree
  }

  // Register only the Kilo-specific commands. Upstream commands stay in index.ts's chain so
  // upstream merges that add or remove commands keep working without touching this file.
  export function register<T>(cli: Argv<T>): Argv<T> {
    cli
      .command(RollCallCommand)
      .command(DaemonCommand)
      .command(ConfigCLICommand)
      .command(WorktreeCommand)
      .command(CompressionCLICommand)
      .command(StandardSuiteCLICommand)
    if (process.env.FOX_PTY_SMOKE === "1") cli.command(PtySmokeCommand)
    // Safe self-reference: `cli` is a typed parameter and yargs `.command()` returns the same
    // instance, so the help command can resolve the fully-built root at handler time. This also
    // sidesteps the self-referential type error the old inline registration hit in index.ts.
    cli.command(createHelpCommand(() => cli))
    return cli
  }

  export async function runner() {
    if (!process.argv.includes("__background-process-runner")) return false
    return (await import("@/foxcode/background-process/runner")).BackgroundProcessRunner.maybe()
  }

  // Runs from the upstream `.middleware`, before any command handler. Env tagging is additive so
  // it never has to modify upstream's own env assignments.
  export async function bootstrap(opts: { [key: string]: unknown }): Promise<void> {
    info = opts.help === true || opts.version === true
    if (info) return
    narrow = workerTui(opts)

    const { FoxLog } = await import("@/foxcode/log")
    await FoxLog.init()

    if (!process.env["FOX_FEATURE"])
      process.env["FOX_FEATURE"] = process.argv.includes("serve") ? "unknown" : "cli"
    if (!process.env["FOX_VERSION"]) process.env["FOX_VERSION"] = InstallationVersion
    process.env.FOX = "1"
    process.env.KILO = "1"

    // Must run before AppRuntime initializes the SQLite database, or the marker
    // exists before legacy JSON can be imported.
    const { JsonMigration } = await import("@/foxcode/storage/json-migration")
    await JsonMigration.bootstrap()
  }

  // Runs from the `finally` block on every exit path.
  export async function shutdown(): Promise<void> {
    if (info) return
    const { SessionExport } = await import("@/foxcode/session-export")
    try {
      await SessionExport.shutdown()
    } finally {
      await FoxShutdown.run()
      if (narrow) {
        const { FoxCliBootstrapRuntime } = await import("@/foxcode/cli/bootstrap-runtime")
        await FoxCliBootstrapRuntime.dispose()
        return
      }
      const { InstanceRuntime } = await import("@/project/instance-runtime")
      await InstanceRuntime.disposeAllInstances() // safety net (no-op if already disposed)
    }
  }
}

export { FoxCli as KiloCli }
