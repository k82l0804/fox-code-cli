import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { UI } from "./cli/ui"
import { TuiThreadCommand } from "./cli/cmd/tui"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { FormatError } from "./cli/error"
import { EOL } from "os"
import { errorMessage } from "./util/error"
import { Heap } from "./cli/heap"
import { FoxCli } from "@/foxcode/cli/setup"
import * as Log from "@opencode-ai/core/util/log"
import { ensureProcessMetadata } from "@opencode-ai/core/util/opencode-process"
import {
  AcpCommand,
  AgentCommand,
  AttachCommand,
  DbCommand,
  DebugCommand,
  ExportCommand,
  GenerateCommand,
  ImportCommand,
  McpCommand,
  ModelsCommand,
  PluginCommand,
  PrCommand,
  ProvidersCommand,
  RunCommand,
  ServeCommand,
  SessionCommand,
  StatsCommand,
  waitForLazyCommands,
} from "@/foxcode/cli/lazy-commands"

// @ts-ignore
globalThis.AI_SDK_LOG_WARNINGS = false

const args = hideBin(process.argv)
const metadata = ensureProcessMetadata("main")
if (await FoxCli.runner()) process.exit()
function show(out: string) {
  const text = out.trimStart()
  if (!text.startsWith("fox ")) {
    process.stderr.write(UI.logo() + EOL + EOL)
    process.stderr.write(text + EOL)
    return
  }
  process.stderr.write(out)
}

let cli = yargs(args)
  .parserConfiguration({ "populate--": true })
  .scriptName("fox")
  .wrap(100)
  .help("help", "show help")
  .alias("help", "h")
  .version("version", "show version number", InstallationVersion)
  .alias("version", "v")
  .option("print-logs", {
    describe: "print logs to stderr",
    type: "boolean",
  })
  .option("log-level", {
    describe: "log level",
    type: "string",
    choices: ["DEBUG", "INFO", "WARN", "ERROR"],
  })
  .option("pure", {
    describe: "run without external plugins",
    type: "boolean",
  })
  .middleware(async (opts) => {
    if (opts.printLogs) {
      process.env.FOX_PRINT_LOGS = "1"
    }
    if (opts.logLevel) {
      process.env.FOX_LOG_LEVEL = opts.logLevel
    }
    if (opts.pure) {
      process.env.FOX_PURE = "1"
    }

    Heap.start()

    process.env.AGENT = "1"
    process.env.OPENCODE = "1"
    process.env.FOX_PID = String(process.pid)
    await FoxCli.bootstrap(opts)
    Log.Default.info("fox", {
      version: InstallationVersion,
      command: args[0] ?? "", // avoid persisting prompts, passwords, tokens, headers, or environment values
      process_role: metadata.processRole,
      run_id: metadata.runID,
    })
  })
  .usage("")
  .completion("completion", "generate shell completion script")
  .command(AcpCommand)
  .command(McpCommand)
  .command(TuiThreadCommand)
  .command(AttachCommand)
  .command(RunCommand)
  .command(GenerateCommand)
  .command(DebugCommand)
  .command(ProvidersCommand)
  .command(AgentCommand)
  .command(ServeCommand)
  .command(ModelsCommand)
  .command(StatsCommand)
  .command(ExportCommand)
  .command(ImportCommand)
  .command(PrCommand)
  .command(SessionCommand)
  .command(PluginCommand)
  .command(DbCommand)
cli = FoxCli.register(cli)
await waitForLazyCommands()
cli = cli
  .fail((msg, err) => {
    if (
      msg?.startsWith("Unknown argument") ||
      msg?.startsWith("Not enough non-option arguments") ||
      msg?.startsWith("Invalid values:")
    ) {
      if (err) throw err
      cli.showHelp(show)
    }
    if (err) throw err
    process.exit(1)
  })
  .strict()

try {
  if (args.includes("-h") || args.includes("--help")) {
    await cli.parse(args, (err: Error | undefined, _argv: unknown, out: string) => {
      if (err) throw err
      if (!out) return
      show(out)
    })
  } else {
    await cli.parse()
  }
} catch (e) {
  const formatted = FormatError(e)
  if (formatted) UI.error(formatted)
  if (formatted === undefined) {
    UI.error("Unexpected error" + EOL)
    process.stderr.write(errorMessage(e) + EOL)
    if (e && typeof e === "object") {
      if ("stack" in e && e.stack) {
        process.stderr.write(String(e.stack) + EOL)
      }
      if ("cause" in e && (e as any).cause) {
        process.stderr.write("Cause: " + String((e as any).cause?.stack ?? (e as any).cause) + EOL)
      }
      if (Symbol.for("effect/Runtime/FiberFailure/Cause") in e) {
        const cause = (e as any)[Symbol.for("effect/Runtime/FiberFailure/Cause")]
        process.stderr.write("FiberFailure Cause: " + JSON.stringify(cause, null, 2) + EOL)
      }
    }
  }
  process.exitCode = 1
} finally {
  await Promise.race([
    FoxCli.shutdown(),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ])
  // Wait up to 500ms for stdout/stderr to drain before forcing exit
  await new Promise<void>((resolve) => {
    let pending = 2
    const timer = setTimeout(resolve, 500)
    const onDrain = () => {
      pending--
      if (pending <= 0) {
        clearTimeout(timer)
        resolve()
      }
    }
    if (!process.stdout.write("")) process.stdout.once("drain", onDrain); else onDrain()
    if (!process.stderr.write("")) process.stderr.once("drain", onDrain); else onDrain()
  })
  // Some subprocesses don't react properly to SIGTERM and similar signals.
  // Most notably, some docker-container-based MCP servers don't handle such signals unless
  // run using `docker run --init`.
  // Explicitly exit to avoid any hanging subprocesses.
  process.exit()
}
