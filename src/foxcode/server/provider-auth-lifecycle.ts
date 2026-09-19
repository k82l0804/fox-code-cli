import { InstanceStore } from "@/project/instance-store"
import { ModelCache } from "@/provider/model-cache"
import { FoxViewers } from "@/foxcode/presence/service"
import { Effect } from "effect"

export const disposeAllInstancesAfterProviderAuthCallback = Effect.fn(
  "FoxServer.disposeAllInstancesAfterProviderAuthCallback",
)(function* () {
  const store = yield* InstanceStore.Service
  yield* store.disposeAll()
})
export const invalidatePresence = Effect.fn("FoxServer.invalidatePresence")(function* () {
  const viewers = yield* FoxViewers.Service
  yield* viewers.invalidateAuth()
})
export const invalidateAfterProviderAuthChange = Effect.fn("FoxServer.invalidateAfterProviderAuthChange")(function* (
  providerID: string,
) {
  const cache = yield* ModelCache.Service
  yield* cache.clear(providerID)
  yield* disposeAllInstancesAfterProviderAuthCallback()
})
