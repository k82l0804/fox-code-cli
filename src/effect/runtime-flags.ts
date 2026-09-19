import { Config, ConfigProvider, Context, Effect, Layer, Option } from "effect"
import { ConfigService } from "@/effect/config-service"

const bool = (foxName: string, legacyName?: string) => {
  if (!legacyName) return Config.boolean(foxName).pipe(Config.withDefault(false))
  return Config.all({
    fox: Config.boolean(foxName).pipe(Config.option),
    legacy: Config.boolean(legacyName).pipe(Config.option),
  }).pipe(
    Config.map((flags) => Option.getOrElse(flags.fox, () => Option.getOrElse(flags.legacy, () => false))),
  )
}

const positiveInteger = (foxName: string, legacyName?: string) => {
  const parse = (name: string) =>
    Config.number(name).pipe(
      Config.map((value) => (Number.isInteger(value) && value > 0 ? value : undefined)),
      Config.option,
    )
  if (!legacyName) {
    return parse(foxName).pipe(
      Config.map((opt) => Option.getOrElse(opt, () => undefined)),
    )
  }
  return Config.all({
    fox: parse(foxName),
    legacy: parse(legacyName),
  }).pipe(
    Config.map((flags) => Option.getOrElse(flags.fox, () => Option.getOrElse(flags.legacy, () => undefined))),
  )
}

const experimental = bool("FOX_EXPERIMENTAL", "KILO_EXPERIMENTAL")
const enabledByExperimental = (foxName: string, legacyName?: string) => {
  const enabled = legacyName
    ? Config.all({
        fox: Config.boolean(foxName).pipe(Config.option),
        legacy: Config.boolean(legacyName).pipe(Config.option),
      }).pipe(
        Config.map((flags) => Option.orElse(flags.fox, () => flags.legacy)),
      )
    : Config.boolean(foxName).pipe(Config.option)
  return Config.all({ experimental, enabled }).pipe(
    Config.map((flags) => Option.getOrElse(flags.enabled, () => flags.experimental)),
  )
}

export class Service extends ConfigService.Service<Service>()("@opencode/RuntimeFlags", {
  autoShare: bool("FOX_AUTO_SHARE", "KILO_AUTO_SHARE"),
  pure: bool("FOX_PURE", "KILO_PURE"),
  disableDefaultPlugins: bool("FOX_DISABLE_DEFAULT_PLUGINS", "KILO_DISABLE_DEFAULT_PLUGINS"),
  disableChannelDb: bool("FOX_DISABLE_CHANNEL_DB", "KILO_DISABLE_CHANNEL_DB"),
  disableEmbeddedWebUi: bool("FOX_DISABLE_EMBEDDED_WEB_UI", "KILO_DISABLE_EMBEDDED_WEB_UI"),
  disableExternalSkills: bool("FOX_DISABLE_EXTERNAL_SKILLS", "KILO_DISABLE_EXTERNAL_SKILLS"),
  disableSkillShell: bool("FOX_DISABLE_SKILL_SHELL", "KILO_DISABLE_SKILL_SHELL"),
  disableLspDownload: bool("FOX_DISABLE_LSP_DOWNLOAD", "KILO_DISABLE_LSP_DOWNLOAD"),
  skipMigrations: bool("FOX_SKIP_MIGRATIONS", "KILO_SKIP_MIGRATIONS"),
  enableExa: Config.all({
    experimental,
    enabled: bool("FOX_ENABLE_EXA", "KILO_ENABLE_EXA"),
    legacy: bool("FOX_EXPERIMENTAL_EXA", "KILO_EXPERIMENTAL_EXA"),
  }).pipe(Config.map((flags) => flags.experimental || flags.enabled || flags.legacy)),
  enableParallel: Config.all({
    enabled: bool("FOX_ENABLE_PARALLEL", "KILO_ENABLE_PARALLEL"),
    legacy: bool("FOX_EXPERIMENTAL_PARALLEL", "KILO_EXPERIMENTAL_PARALLEL"),
  }).pipe(Config.map((flags) => flags.enabled || flags.legacy)),
  enableExperimentalModels: bool("FOX_ENABLE_EXPERIMENTAL_MODELS", "KILO_ENABLE_EXPERIMENTAL_MODELS"),
  enableQuestionTool: bool("FOX_ENABLE_QUESTION_TOOL", "KILO_ENABLE_QUESTION_TOOL"),
  experimentalScout: enabledByExperimental("FOX_EXPERIMENTAL_SCOUT", "KILO_EXPERIMENTAL_SCOUT"),
  experimentalReferences: enabledByExperimental("FOX_EXPERIMENTAL_REFERENCES", "KILO_EXPERIMENTAL_REFERENCES"),
  experimentalBackgroundSubagents: Config.all({
    fox: Config.boolean("FOX_EXPERIMENTAL_BACKGROUND_SUBAGENTS").pipe(Config.option),
    kilo: Config.boolean("KILO_EXPERIMENTAL_BACKGROUND_SUBAGENTS").pipe(Config.option),
  }).pipe(
    Config.map((flags) => Option.getOrElse(flags.fox, () => Option.getOrElse(flags.kilo, () => true))),
  ),
  experimentalLspTy: bool("FOX_EXPERIMENTAL_LSP_TY", "KILO_EXPERIMENTAL_LSP_TY"),
  experimentalLspTool: enabledByExperimental("FOX_EXPERIMENTAL_LSP_TOOL", "KILO_EXPERIMENTAL_LSP_TOOL"),
  experimentalOxfmt: enabledByExperimental("FOX_EXPERIMENTAL_OXFMT", "KILO_EXPERIMENTAL_OXFMT"),
  experimentalPlanMode: enabledByExperimental("FOX_EXPERIMENTAL_PLAN_MODE", "KILO_EXPERIMENTAL_PLAN_MODE"),
  experimentalCodeMode: enabledByExperimental("FOX_EXPERIMENTAL_CODE_MODE", "KILO_EXPERIMENTAL_CODE_MODE"),
  experimentalEventSystem: enabledByExperimental("FOX_EXPERIMENTAL_EVENT_SYSTEM", "KILO_EXPERIMENTAL_EVENT_SYSTEM"),
  experimentalSessionSwitcher: enabledByExperimental("FOX_EXPERIMENTAL_SESSION_SWITCHER", "KILO_EXPERIMENTAL_SESSION_SWITCHER"),
  experimentalSharedAgentBoard: Config.all({
    fox: Config.boolean("FOX_EXPERIMENTAL_SHARED_AGENT_BOARD").pipe(Config.option),
    kilo: Config.boolean("KILO_EXPERIMENTAL_SHARED_AGENT_BOARD").pipe(Config.option),
  }).pipe(
    Config.map((flags) => Option.getOrElse(flags.fox, () => Option.getOrElse(flags.kilo, () => true))),
  ),
  experimentalWorkspaces: enabledByExperimental("FOX_EXPERIMENTAL_WORKSPACES", "KILO_EXPERIMENTAL_WORKSPACES"),
  experimentalIconDiscovery: enabledByExperimental("FOX_EXPERIMENTAL_ICON_DISCOVERY", "KILO_EXPERIMENTAL_ICON_DISCOVERY"),
  experimentalMcpApps: enabledByExperimental("FOX_EXPERIMENTAL_MCP_APPS", "KILO_EXPERIMENTAL_MCP_APPS"),
  outputTokenMax: positiveInteger("FOX_EXPERIMENTAL_OUTPUT_TOKEN_MAX", "KILO_EXPERIMENTAL_OUTPUT_TOKEN_MAX"),
  bashDefaultTimeoutMs: positiveInteger("FOX_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS", "KILO_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS"),
  experimentalNativeLlm: bool("FOX_EXPERIMENTAL_NATIVE_LLM", "KILO_EXPERIMENTAL_NATIVE_LLM"),
  experimentalWebSockets: bool("FOX_EXPERIMENTAL_WEBSOCKETS", "KILO_EXPERIMENTAL_WEBSOCKETS"),
  client: Config.all({
    fox: Config.string("FOX_CLIENT").pipe(Config.option),
    kilo: Config.string("KILO_CLIENT").pipe(Config.option),
  }).pipe(
    Config.map((flags) => Option.getOrElse(flags.fox, () => Option.getOrElse(flags.kilo, () => "cli"))),
  ),
}) {}

export type Info = Context.Service.Shape<typeof Service>

const emptyConfigLayer = Service.layer.pipe(
  Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
  Layer.orDie,
)

export const layer = (overrides: Partial<Info> = {}) =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const flags = yield* Service
      return Service.of({ ...flags, ...overrides })
    }),
  ).pipe(Layer.provide(emptyConfigLayer))

export const node = LayerNode.make({ service: Service, layer: Service.layer.pipe(Layer.orDie), deps: [] })

export * as RuntimeFlags from "./runtime-flags"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
