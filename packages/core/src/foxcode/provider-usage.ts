export * as ProviderUsage from "./provider-usage"

import { Context, Effect, Layer } from "effect"
import { makeLocationNode } from "../effect/app-node"
import { ProviderUsage as Contract } from "@opencode-ai/schema/foxcode/provider-usage"

export interface Interface {
  readonly get: () => Effect.Effect<Contract.Info>
  readonly refresh: () => Effect.Effect<Contract.Info>
}

export class Service extends Context.Service<Service, Interface>()("@foxcode/ProviderUsage") {}


export { Contract as Schema }

const empty: Contract.Info = { items: [], generatedAt: new Date(0).toISOString() }

const layer = Layer.succeed(
  Service,
  Service.of({
    get: () => Effect.succeed(empty),
    refresh: () => Effect.succeed(empty),
  }),
)

export const node = makeLocationNode({ service: Service, layer, deps: [] })
