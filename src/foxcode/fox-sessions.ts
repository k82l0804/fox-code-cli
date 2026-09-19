/**
 * Fox CLI: no-op sessions service.
 *
 * Fox CLI is local-only. The cloud session sync (kilo-sessions) has been removed.
 * This stub keeps the Effect service graph intact so callers do not need to be
 * restructured — every method is a permanent no-op.
 */
import { Context, Effect, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"

export namespace FoxSessions {
  export interface Interface {
    readonly init: () => Effect.Effect<void, never>
    readonly sendAgentNotification: (
      sessionID: string,
      input: { id: string; message: string },
    ) => Effect.Effect<{ ok: true } | { ok: false; reason: string }, never>
    readonly reportSessionTitle: (
      sessionID: string,
      title: string,
      opts: { generated: boolean },
    ) => Effect.Effect<{ ok: true } | { ok: false; reason: string }, never>
  }

  export class Service extends Context.Service<Service, Interface>()("@foxcode/FoxSessions") {}

  const noop: Interface = {
    init: () => Effect.void,
    sendAgentNotification: () => Effect.succeed({ ok: false, reason: "not_connected" } as const),
    reportSessionTitle: () => Effect.succeed({ ok: false, reason: "not_connected" } as const),
  }

  export const layer = Layer.succeed(Service, noop)
  export const defaultLayer = layer
  export const testLayer = layer

  /** LayerNode — used in bootstrap and registry layer composition. */
  export const node = LayerNode.make({ service: Service, layer, deps: [] })

  // Static methods used by CLI commands — all no-ops in local-only mode.
  export async function enableRemote(): Promise<void> {
    console.warn("Fox CLI: remote sessions are not supported in local-only mode.")
  }

  export function disableRemote(): void {}

  export function remoteStatus(): { enabled: boolean; connected: boolean } {
    return { enabled: false, connected: false }
  }

  export function setInstanceAdvertisement(_ad: unknown): void {}

  export async function drainIngestForShutdown(): Promise<void> {}

  /** No-op: Fox CLI does not share sessions to the cloud. */
  export async function share(_id: string): Promise<void> {}

  /** No-op: Fox CLI does not unshare sessions from the cloud. */
  export async function unshare(_id: string): Promise<void> {}

  /** No-op: Fox CLI does not remove sessions from the cloud. */
  export async function remove(_id: string): Promise<void> {}

  /** No-op: Fox CLI has no attached-session concept (cloud feature). */
  export function setAttachedSessions(_ids: readonly string[]): void {}
}

export { FoxSessions as KiloSessions }
