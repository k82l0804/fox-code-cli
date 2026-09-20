import type { BuiltinTuiPlugin } from "@opencode-ai/tui/builtins"
import HomeNews from "@/foxcode/plugins/home-news"
import HomeOnboarding from "@/foxcode/plugins/home-onboarding"
import Attention from "@/foxcode/plugins/attention"
import HomeFooter from "@/foxcode/plugins/home-footer"
import Permissions from "@/foxcode/plugins/permissions"
import MemoryStatus from "@/foxcode/plugins/memory-status"
import MemoryPalette from "@/foxcode/plugins/memory-palette"
import SidebarProcesses from "@/foxcode/plugins/sidebar-background-processes"
import SidebarIndexing from "@/foxcode/plugins/sidebar-indexing"
import SidebarPr from "@/foxcode/plugins/sidebar-pr"
import SidebarUsage from "@/foxcode/plugins/sidebar-usage"
import SidebarCompression from "@/foxcode/plugins/sidebar-compression"
import Sandbox from "@/foxcode/plugins/sandbox"
import Reload from "@/foxcode/plugins/reload"
import SessionSwitcher from "@/foxcode/plugins/session-switcher"
import SessionV2Debug from "@/foxcode/plugins/session-v2-debug"
import type { RuntimeFlags } from "@/effect/runtime-flags"

const plugins = [
  HomeNews,
  HomeOnboarding,
  Attention,
  HomeFooter,
  Permissions,
  MemoryStatus,
  MemoryPalette,
  SidebarProcesses,
  SidebarIndexing,
  SidebarPr,
  SidebarUsage,
  SidebarCompression,
  Sandbox,
  Reload,
] satisfies BuiltinTuiPlugin[]

export function withKiloTuiPlugins(
  builtins: BuiltinTuiPlugin[],
  flags: Pick<RuntimeFlags.Info, "experimentalEventSystem" | "experimentalSessionSwitcher">,
) {
  return [
    ...plugins,
    ...(flags.experimentalEventSystem ? [SessionV2Debug] : []),
    ...(flags.experimentalSessionSwitcher ? [SessionSwitcher] : []),
    ...builtins,
  ]
}
