import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "@/server/routes/instance/httpapi/api"

// Fox CLI: remote sessions are not supported in local-only mode.
// These handlers return a permanently-disabled status.
export const remoteHandlers = HttpApiBuilder.group(InstanceHttpApi, "remote", (handlers) =>
  Effect.gen(function* () {
    const noopStatus = { enabled: false, connected: false }

    const enable = Effect.fn("RemoteHttpApi.enable")(function* () {
      return noopStatus
    })

    const disable = Effect.fn("RemoteHttpApi.disable")(function* () {
      return noopStatus
    })

    const status = Effect.fn("RemoteHttpApi.status")(function* () {
      return noopStatus
    })

    return handlers.handle("enable", enable).handle("disable", disable).handle("status", status)
  }),
)
