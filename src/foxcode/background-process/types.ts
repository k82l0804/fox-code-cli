import type { ChildProcess } from "child_process"
import type { InstanceContext } from "@/foxcode/instance"
import type { Flock } from "@opencode-ai/core/util/flock"
import type { ID, Info, StartInput, Status, Lifetime, Ready } from "./schema"

export const MAX_OUTPUT_BYTES = 200 * 1024
export const KILL_MS = 3_000
export const READY_MS = 30_000
export const PUBLISH_MS = 500
export const PORT_START_MS = 500
export const PORT_MS = 5_000
export const PORT_LIMIT_MS = 30_000

export type Probe = "owned" | "gone" | "foreign" | "unknown"

export type Active = {
  ctx: InstanceContext
  info: Info
  proc?: ChildProcess
  start: StartInput
  pattern?: RegExp
  resolve?: (ready: boolean) => void
  notify?: ReturnType<typeof setTimeout>
  poll?: ReturnType<typeof setTimeout>
  watch?: ReturnType<typeof setTimeout>
  retry?: ReturnType<typeof setTimeout>
  scan?: Promise<boolean>
  log?: string
  control?: string
  token?: string
  shared?: Shared
  offset?: number
  file?: string
  saved?: boolean
  saving?: Promise<void>
  disposed?: boolean
}

export type Shared = {
  key: string
  dir: string
  processes: Map<ID, Active>
  adopt?: Promise<void>
  claim?: Promise<boolean>
  lease?: Flock.Lease
}

export type State = {
  ctx: InstanceContext
  dir: string
  processes: Map<ID, Active>
  shared: Shared
}
