// All CommandModules in one place so help.ts and generate-cli-docs.ts can
// introspect them without importing index.ts (which has startup side effects).
import { AcpCommand } from "../cli/cmd/acp"
import { McpCommand } from "../cli/cmd/mcp"
import { TuiThreadCommand } from "../cli/cmd/tui"
import { AttachCommand } from "../cli/cmd/attach"
import { RunCommand } from "../cli/cmd/run"
import { GenerateCommand } from "../cli/cmd/generate"
import { DebugCommand } from "../cli/cmd/debug"
import { ProvidersCommand } from "../cli/cmd/providers"
import { AgentCommand } from "../cli/cmd/agent"
import { ServeCommand } from "../cli/cmd/serve"
import { ModelsCommand } from "../cli/cmd/models"
import { StatsCommand } from "../cli/cmd/stats"
import { ExportCommand } from "../cli/cmd/export"
import { ImportCommand } from "../cli/cmd/import"
import { PrCommand } from "../cli/cmd/pr"
import { SessionCommand } from "../cli/cmd/session"
import { DbCommand } from "../cli/cmd/db"
import { ConfigCommand as ConfigCLICommand } from "../cli/cmd/config"
import { PluginCommand } from "../cli/cmd/plug"
import { RollCallCommand } from "./cli/cmd/roll-call"
import { DaemonCommand } from "./cli/cmd/daemon"
import { WorktreeCommand } from "./cli/cmd/worktree"
import { HelpCommand } from "./help-command"

// Synthetic entry for the yargs built-in .completion() command so that
// generateHelp --all and cli-reference.md include it automatically.
const CompletionCommand = {
  command: "completion",
  describe: "generate shell completion script",
  handler: () => {},
}

export const commands = [
  AcpCommand,
  McpCommand,
  TuiThreadCommand,
  AttachCommand,
  RunCommand,
  GenerateCommand,
  DebugCommand,
  ProvidersCommand,
  AgentCommand,
  ServeCommand,
  ModelsCommand,
  RollCallCommand,
  StatsCommand,
  ExportCommand,
  ImportCommand,
  PrCommand,
  SessionCommand,
  DaemonCommand,
  WorktreeCommand,
  DbCommand,
  ConfigCLICommand,
  PluginCommand,
  HelpCommand,
  CompletionCommand,
]
