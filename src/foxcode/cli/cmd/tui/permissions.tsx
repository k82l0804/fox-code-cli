import type { PermissionRequest } from "@foxcode/sdk/v2"
import { useTheme } from "@tui/context/theme"
import { MemoryPermissionRegistry } from "@/foxcode/cli/cmd/tui/routes/session/memory-permission"

function MemoryBody(props: { request: PermissionRequest }) {
  const { theme } = useTheme()
  const value = String(props.request.metadata?.text ?? props.request.metadata?.query ?? "")
  return (
    <box paddingLeft={1} flexDirection="column">
      <text fg={theme.textMuted}>{value || "No memory content provided"}</text>
    </box>
  )
}

export namespace MemoryPermission {
  export function register() {
    const saveHandler = (request: any) => {
      const action = String(request.metadata?.action ?? "save")
      return {
        icon: "◇",
        title: `Memory ${action}`,
        body: <MemoryBody request={request} />,
      }
    }
    const recallHandler = (request: any) => ({
      icon: "◇",
      title: "Memory recall",
      body: <MemoryBody request={request} />,
    })
    MemoryPermissionRegistry.register("fox_memory_save", saveHandler)
    MemoryPermissionRegistry.register("kilo_memory_save", saveHandler)
    MemoryPermissionRegistry.register("fox_memory_recall", recallHandler)
    MemoryPermissionRegistry.register("kilo_memory_recall", recallHandler)
  }
}
