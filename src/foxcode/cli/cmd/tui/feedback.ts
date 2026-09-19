
/**
 * Per-message thumbs up/down feedback for the TUI.
 *
 * Wired via the `messages_feedback_up` / `messages_feedback_down` keybinds
 * in the Session route. Kept out of `routes/session/index.tsx` so the
 * upstream-shared session route stays free of Kilo telemetry plumbing.
 */
import type { DialogContext } from "@tui/ui/dialog"
import type { ToastContext } from "@tui/ui/toast"

interface SessionRevert {
  revert?: { messageID: string }
}

interface Context {
  toast: ToastContext
  session: () => SessionRevert | undefined
  messages: () => unknown[]
}

export function submitFeedback(rating: "up" | "down", dialog: DialogContext, ctx: Context): void {
  ctx.toast.show({
    message: rating === "up" ? "Thanks for the feedback!" : "Thanks — we'll use this to improve.",
    variant: "success",
  })
  dialog.clear()
}
