import { Config, ConfigProvider, Context, Effect, Layer, Option } from "effect"
import { ConfigService } from "@/effect/config-service"

const bool = (name: string) => Config.boolean(name).pipe(Config.withDefault(false))

const positiveInteger = (name: string) =>
  Config.number(name).pipe(
    Config.map((value) => (Number.isInteger(value) && value > 0 ? value : undefined)),
    Config.option,
    Config.map((opt) => Option.getOrElse(opt, () => undefined)),
  )

const experimental = bool("FOX_EXPERIMENTAL")
const enabledByExperimental = (name: string) =>
  Config.all({ experimental, enabled: Config.boolean(name).pipe(Config.option) }).pipe(
    Config.map((flags) => Option.getOrElse(flags.enabled, () => flags.experimental)),
  )

export class Service extends ConfigService.Service<Service>()("@opencode/RuntimeFlags", {
  autoShare: bool("FOX_AUTO_SHARE"),
  pure: bool("FOX_PURE"),
  disableDefaultPlugins: bool("FOX_DISABLE_DEFAULT_PLUGINS"),
  disableChannelDb: bool("FOX_DISABLE_CHANNEL_DB"),
  disableEmbeddedWebUi: bool("FOX_DISABLE_EMBEDDED_WEB_UI"),
  disableExternalSkills: bool("FOX_DISABLE_EXTERNAL_SKILLS"),
  disableSkillShell: bool("FOX_DISABLE_SKILL_SHELL"),
  disableLspDownload: bool("FOX_DISABLE_LSP_DOWNLOAD"),
  skipMigrations: bool("FOX_SKIP_MIGRATIONS"),
  enableExa: Config.all({
    experimental,
    enabled: bool("FOX_ENABLE_EXA"),
    legacy: bool("FOX_EXPERIMENTAL_EXA"),
  }).pipe(Config.map((flags) => flags.experimental || flags.enabled || flags.legacy)),
  enableParallel: Config.all({
    enabled: bool("FOX_ENABLE_PARALLEL"),
    legacy: bool("FOX_EXPERIMENTAL_PARALLEL"),
  }).pipe(Config.map((flags) => flags.enabled || flags.legacy)),
  enableExperimentalModels: bool("FOX_ENABLE_EXPERIMENTAL_MODELS"),
  enableQuestionTool: bool("FOX_ENABLE_QUESTION_TOOL"),
  experimentalScout: enabledByExperimental("FOX_EXPERIMENTAL_SCOUT"),
  experimentalReferences: enabledByExperimental("FOX_EXPERIMENTAL_REFERENCES"),
  experimentalBackgroundSubagents: Config.boolean("FOX_EXPERIMENTAL_BACKGROUND_SUBAGENTS").pipe(
    Config.withDefault(true),
  ),
  experimentalLspTy: bool("FOX_EXPERIMENTAL_LSP_TY"),
  experimentalLspTool: enabledByExperimental("FOX_EXPERIMENTAL_LSP_TOOL"),
  experimentalOxfmt: enabledByExperimental("FOX_EXPERIMENTAL_OXFMT"),
  experimentalPlanMode: enabledByExperimental("FOX_EXPERIMENTAL_PLAN_MODE"),
  experimentalCodeMode: enabledByExperimental("FOX_EXPERIMENTAL_CODE_MODE"),
  experimentalEventSystem: enabledByExperimental("FOX_EXPERIMENTAL_EVENT_SYSTEM"),
  experimentalSessionSwitcher: enabledByExperimental("FOX_EXPERIMENTAL_SESSION_SWITCHER"),
  experimentalSharedAgentBoard: Config.boolean("FOX_EXPERIMENTAL_SHARED_AGENT_BOARD").pipe(Config.withDefault(true)),
  experimentalWorkspaces: enabledByExperimental("FOX_EXPERIMENTAL_WORKSPACES"),
  experimentalIconDiscovery: enabledByExperimental("FOX_EXPERIMENTAL_ICON_DISCOVERY"),
  experimentalMcpApps: enabledByExperimental("FOX_EXPERIMENTAL_MCP_APPS"),
  outputTokenMax: positiveInteger("FOX_EXPERIMENTAL_OUTPUT_TOKEN_MAX"),
  bashDefaultTimeoutMs: positiveInteger("FOX_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS"),
  experimentalNativeLlm: bool("FOX_EXPERIMENTAL_NATIVE_LLM"),
  experimentalWebSockets: bool("FOX_EXPERIMENTAL_WEBSOCKETS"),
  client: Config.string("FOX_CLIENT").pipe(Config.withDefault("cli")),
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
