import { BackgroundProcess } from "@/foxcode/background-process"
import { SessionID } from "@/session/schema"
import { Effect } from "effect"

export namespace FoxTaskBackgroundProcess {
  export function finish(sessionID: SessionID) {
    return Effect.promise(() => BackgroundProcess.stopSession(sessionID)).pipe(Effect.ignore)
  }
}

export { FoxTaskBackgroundProcess as KiloTaskBackgroundProcess }
