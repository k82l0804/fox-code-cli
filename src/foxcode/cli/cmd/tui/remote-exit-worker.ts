import { RemoteExitRpc } from "@/foxcode/cli/cmd/tui/remote-exit-rpc"

export function createWorkerRemoteExit(emit: (event: string, data: undefined) => void) {
  let unregister: (() => void) | undefined

  const gone = () => {
    unregister?.()
    unregister = undefined
  }

  return {
    ready() {
      // Fox CLI is local-only; remote exit signalling is not supported.
      // The emit call is kept so TUI cleanup still fires on local exit.
      gone()
      unregister = () => {
        emit(RemoteExitRpc.Event, undefined)
      }
    },
    gone,
    shutdown: gone,
  }
}
