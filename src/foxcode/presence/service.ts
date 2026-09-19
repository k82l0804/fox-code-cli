import { Context, Effect, Layer } from "effect"

export type ViewerSnapshot = any

export namespace FoxViewers {
  export interface Interface {
    readonly update: (snapshot: ViewerSnapshot) => Effect.Effect<void>
    readonly invalidateAuth: () => Effect.Effect<void>
  }

  export class Service extends Context.Service<Service, Interface>()("@foxcode/FoxViewers") {}

  export const layer = Layer.succeed(Service, {
    update: () => Effect.void,
    invalidateAuth: () => Effect.void,
  })

  export const defaultLayer = layer
}

export { FoxViewers as KiloViewers }
