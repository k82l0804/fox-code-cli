import type { MessageV2 } from "@/session/message-v2"

export namespace FoxPartLifecycle {
  export const key = "foxcode.lifecycle"
export const legacyKey = "kilocode.lifecycle"

  export function transient(part: MessageV2.Part) {
    return part.type === "text" && part.metadata?.[key] === "transient"
  }
}

export { FoxPartLifecycle as KiloPartLifecycle }
