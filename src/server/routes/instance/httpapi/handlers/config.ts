import { Config } from "@/config/config"
import { recommend } from "@/foxcode/provider/catalog"
import { Auth } from "@/auth"
import { Option } from "effect"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { ModelV2 } from "@opencode-ai/core/model"
import { filterPromptTrainingModels, nonEmptyProviders } from "@/foxcode/provider/model-filter"
import { Provider } from "@/provider/provider"
import * as InstanceState from "@/effect/instance-state"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"
import { markInstanceForDisposal } from "../lifecycle"

export const configHandlers = HttpApiBuilder.group(InstanceHttpApi, "config", (handlers) =>
  Effect.gen(function* () {
    const providerSvc = yield* Provider.Service
    const configSvc = yield* Config.Service
    const auth = yield* Auth.Service
    const get = Effect.fn("ConfigHttpApi.get")(function* () {
      return yield* configSvc.get()
    })

    const update = Effect.fn("ConfigHttpApi.update")(function* (ctx) {
      yield* configSvc.update(ctx.payload)
      yield* markInstanceForDisposal(yield* InstanceState.context)
      return ctx.payload
    })
    const warnings = Effect.fn("ConfigHttpApi.warnings")(function* () {
      return yield* configSvc.warnings()
    })
    const providers = Effect.fn("ConfigHttpApi.providers")(function* () {
      const config = yield* configSvc.get()
      const providers = filterPromptTrainingModels(
        yield* providerSvc.list(),
        config.hide_prompt_training_models === true,
      )
      const defaults = Provider.defaultModelIDs(nonEmptyProviders(providers))
      if (defaults[ProviderV2.ID.kilo]) {
        const info = yield* auth.get("fox").pipe(Effect.option)
        const model = yield* Effect.promise(() =>
          recommend(
            providers[ProviderV2.ID.kilo].models,
            config.provider?.kilo?.options,
            Option.getOrUndefined(info),
            Option.isSome(info),
          ),
        )
        if (model && providers[ProviderV2.ID.kilo]?.models[model]) defaults[ProviderV2.ID.kilo] = ModelV2.ID.make(model)
      }
      return {
        providers: Object.values(providers).map(Provider.toPublicInfo),
        default: defaults,
      }
    })

    return handlers
      .handle("get", get)
      .handle("update", update)
      .handle("warnings", warnings)
      .handle("providers", providers)
  }),
)
