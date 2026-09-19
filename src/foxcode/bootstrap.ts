import { Cause, Context, Effect, Layer } from "effect"
import { EffectBridge } from "@/effect/bridge"
import { FoxSessions } from "@/foxcode/fox-sessions"
import * as Log from "@opencode-ai/core/util/log"
import { Global } from "@opencode-ai/core/global"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import path from "node:path"
import { Bus } from "@/bus"
import { Provider } from "@/provider/provider"
import { Session } from "@/session/session"
import { SessionSummary } from "@/session/summary"
import { SessionExport } from "@/foxcode/session-export"
import { createWorkspaceProvider } from "@/foxcode/session-export/workspace-provider"
import { Instance } from "@/foxcode/instance"
import { InstanceRef } from "@/effect/instance-ref"
import { MemoryLifecycle } from "@/foxcode/memory/turn"
import { MemoryService } from "@foxcode/memory/effect/service"
import { MemoryEvents } from "@/foxcode/memory/events"
import { installMemoryRuntime } from "@/foxcode/memory/runtime"
import { FoxToolRegistry } from "@/foxcode/tool/registry"
import { Wakeup } from "@/foxcode/wakeup"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { FoxWatcher, KilocodeWatcher } from "@/foxcode/watcher"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
const log = Log.create({ service: "foxcode-bootstrap" })

export namespace FoxBootstrap {
  export interface Interface {
    readonly init: () => Effect.Effect<void, unknown>
  }

  export class Service extends Context.Service<Service, Interface>()("@foxcode/Bootstrap") {}

  export const layer = Layer.effect(
    Service,
    Effect.gen(function* () {
      // Bind the package memory effect layer to opencode (paths, instance binder, logger, event sink).
      installMemoryRuntime()
      const kilo = yield* FoxSessions.Service
      const bus = yield* Bus.Service
      const sessions = yield* Session.Service
      const summary = yield* SessionSummary.Service
      const provider = yield* Provider.Service
      const memory = yield* MemoryService.Service
      const watcher = yield* FoxWatcher.Service
      const wake = yield* Wakeup.Service

      const init = Effect.fn("FoxBootstrap.init")(function* () {
        yield* watcher.init()
        yield* kilo.init()
        yield* MemoryLifecycle.subscribe({ bus, sessions, summary, provider, memory })
        // Invalidate enabled cache on every memory state mutation (properties.directory holds the memory root).
        yield* bus.subscribeCallback(MemoryEvents.Status, (evt) =>
          FoxToolRegistry.invalidateMemoryEnabled(evt.properties.directory),
        )
        yield* bus.subscribeCallback(MemoryEvents.Updated, (evt) =>
          FoxToolRegistry.invalidateMemoryEnabled(evt.properties.directory),
        )
        // Re-arm this directory's persisted wakeups on every instance start: overdue ones
        // fire immediately, the rest get their timers. A failure must not block bootstrap.
        const inst = yield* InstanceRef
        if (inst) {
          yield* wake.adopt(inst.directory).pipe(
            Effect.catchCause((cause) =>
              Effect.sync(() => log.warn("wakeup adopt failed", { err: Cause.squash(cause) })),
            ),
          )
        }
        // Session export bootstrap.
        yield* Effect.gen(function* () {
          if (!SessionExport.enabled) return
          const anon = yield* EffectBridge.fromPromise(() => Promise.resolve("local-machine-id"))
          SessionExport.init({
            agentVersion: InstallationVersion,
            anonId: anon,
            dbPath: path.join(Global.Path.data, "session-export.db"),
            workspaceKey: Instance.directory,
            subscribeAll: (cb: any) => Bus.subscribeAll(cb),
            snapshotProvider: createWorkspaceProvider({
              root: Instance.directory,
              statePath: path.join(Global.Path.data, "session-export-workspace.json"),
            }),
          })
        }).pipe(
          Effect.catchCause((cause) =>
            Effect.sync(() => log.warn("session export bootstrap failed", { err: Cause.squash(cause) })),
          ),
        )
        if (process.env["FOX_PLATFORM"] !== "vscode") {
          yield* EffectBridge.fromPromise(() =>
            import("@/foxcode/indexing").then((mod) => mod.FoxIndexing.init()),
          ).pipe(
            Effect.catchCause((cause) =>
              Effect.sync(() => log.warn("indexing bootstrap failed", { err: Cause.squash(cause) })),
            ),
            Effect.forkDetach,
          )
        }
      })

      return Service.of({ init })
    }),
  )

  export const defaultLayer = layer.pipe(
    Layer.provide([
      FoxSessions.defaultLayer,
      Session.defaultLayer,
      AppNodeBuilder.build(SessionSummary.node),
      AppNodeBuilder.build(Provider.node),
      MemoryService.layer,
      Bus.defaultLayer,
      KilocodeWatcher.defaultLayer,
      AppNodeBuilder.build(Wakeup.node),
    ]),
  )

  const memory = LayerNode.make({ service: MemoryService.Service, layer: MemoryService.layer, deps: [] })
  const watcher = LayerNode.make({ service: FoxWatcher.Service, layer: KilocodeWatcher.defaultLayer, deps: [] })
  export const node = LayerNode.suspend(() =>
    LayerNode.make({
      service: Service,
      layer,
      deps: [
        FoxSessions.node,
        Session.node,
        SessionSummary.node,
        Provider.node,
        memory,
        Bus.node,
        watcher,
        Wakeup.node,
      ],
    }),
  )
}

export { FoxBootstrap as KilocodeBootstrap }
