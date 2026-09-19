/**
 * Fox CLI Commands for TUI
 *
 * Provides /privacy, /about, and /indexing (when enabled) commands.
 */

import { createMemo } from "solid-js"
import { useBindings } from "@tui/keymap"
import { useSync } from "@tui/context/sync"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
import { reconcile } from "solid-js/store"
import { DialogIndexing } from "./components/dialog-indexing.js"

import { indexingEnabled } from "./indexing-feature"
import { showAboutDialog } from "./cli/cmd/tui/component/dialog-about.js"

// These types are OpenCode-internal and imported at runtime
type UseSDK = any
type SDK = any

/**
 * Register Fox CLI commands
 * Call this from a component inside the TUI app
 *
 * @param useSDK - OpenCode's useSDK hook (passed from TUI context)
 */
export function registerFoxCommands(useSDK: () => UseSDK) {
  const sync = useSync()
  const dialog = useDialog()
  const sdk = useSDK()
  const toast = useToast()

  const indexing = createMemo(() => indexingEnabled(sync.data.config))

  useBindings(() => ({
    commands: [

      ...(indexing()
        ? [
            {
              name: "kilo.indexing",
              title: "Indexing",
              desc: "Configure codebase indexing",
              category: "Kilo",
              slashName: "indexing",
              slashAliases: ["index", "embedding"],
              run: () => {
                dialog.replace(() => <DialogIndexing useSDK={useSDK} />)
              },
            },
          ]
        : []),

      // /privacy command
      {
        name: "kilo.privacy",
        get title() {
          const active = sync.data.config.privacy_mode === true || sync.data.globalConfig.privacy_mode === true
          return active ? "Disable privacy mode" : "Enable privacy mode"
        },
        desc: "Blur PII (balance, email, etc.) and confirm before showing profile",
        category: "Kilo",
        slashName: "privacy",
        run: async () => {
          const active = sync.data.config.privacy_mode === true || sync.data.globalConfig.privacy_mode === true
          const next = !active
          const updates = [
            sdk.client.config.overlayUpdate({
              scope: "global",
              set: { privacy_mode: next },
            }),
          ]
          if (!next && sync.data.config.privacy_mode === true) {
            updates.push(
              sdk.client.config.overlayUpdate({
                scope: "project",
                unset: [["privacy_mode"]],
              }),
            )
          }
          const responses = await Promise.all(updates)
          const failed = responses.find((r) => r.error)
          if (failed) {
            const status = failed.response?.status ?? "?"
            toast.show({ message: `Failed to update privacy mode (${status})`, variant: "error" })
            return
          }
          const [cfg, global] = await Promise.all([
            sdk.client.config.get({}),
            sdk.client.global.config.get({}),
          ])
          if (cfg.data) sync.set("config", reconcile(cfg.data))
          if (global.data) sync.set("globalConfig", reconcile(global.data))
          toast.show({
            message: next ? "Privacy mode enabled" : "Privacy mode disabled",
            variant: "success",
          })
        },
      },

      // /about command
      {
        name: "kilo.about",
        title: "About",
        desc: "Show version, environment, and diagnostic info",
        category: "Kilo",
        slashName: "about",
        run: () => {
          showAboutDialog(dialog)
        },
      },
    ].map((command) => ({
      namespace: "palette",
      ...command,
    })),
  }))
}
