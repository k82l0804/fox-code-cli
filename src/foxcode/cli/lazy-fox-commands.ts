import { lazy } from "@/foxcode/cli/lazy-commands"

export const RollCallCommand = lazy({
  command: "roll-call <filter>",
  describe: "batch-test text models matching a filter for connectivity and latency",
  load: async () => (await import("@/foxcode/cli/cmd/roll-call")).RollCallCommand,
})

export const DaemonCommand = lazy({
  command: "daemon",
  describe: "manage the local fox daemon",
  load: async () => (await import("@/foxcode/cli/cmd/daemon")).DaemonCommand,
})

export const ConfigCLICommand = lazy({
  command: "config",
  describe: "configuration tools",
  load: async () => (await import("@/cli/cmd/config")).ConfigCommand,
})

export const WorktreeCommand = lazy({
  command: "worktree",
  describe: "manage git worktrees",
  load: async () => (await import("@/foxcode/cli/cmd/worktree")).WorktreeCommand,
})

export const PtySmokeCommand = lazy({
  command: "__pty-smoke",
  describe: false,
  load: async () => (await import("@/foxcode/cli/cmd/pty-smoke")).PtySmokeCommand,
})
