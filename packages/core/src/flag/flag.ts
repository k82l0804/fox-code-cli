import { Config } from "effect"
import { InstallationChannel } from "../installation/version"

export function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

function falsy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "false" || value === "0"
}

const UNSTABLE_CHANNELS = new Set(["dev", "beta", "local"])
function unstableDefault(key: string) {
  return truthy(key) || (!falsy(key) && UNSTABLE_CHANNELS.has(InstallationChannel))
}

function number(key: string) {
  const value = process.env[key]
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

const FOX_EXPERIMENTAL = truthy("FOX_EXPERIMENTAL") || truthy("KILO_EXPERIMENTAL")

const copy =
  process.env["FOX_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"] ??
  process.env["KILO_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]
const fff = process.env["FOX_DISABLE_FFF"] ?? process.env["KILO_DISABLE_FFF"]

function enabledByExperimental(key: string, legacyKey?: string) {
  if (process.env[key] !== undefined) return truthy(key)
  if (legacyKey && process.env[legacyKey] !== undefined) return truthy(legacyKey)
  return truthy("FOX_EXPERIMENTAL") || truthy("KILO_EXPERIMENTAL")
}

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  OTEL_EXPORTER_OTLP_HEADERS: process.env["OTEL_EXPORTER_OTLP_HEADERS"],

  FOX_AUTO_SHARE: truthy("FOX_AUTO_SHARE") || truthy("KILO_AUTO_SHARE"),
  FOX_AUTO_HEAP_SNAPSHOT: truthy("FOX_AUTO_HEAP_SNAPSHOT") || truthy("KILO_AUTO_HEAP_SNAPSHOT"),
  FOX_GIT_BASH_PATH: process.env["FOX_GIT_BASH_PATH"] ?? process.env["KILO_GIT_BASH_PATH"],
  FOX_CONFIG: process.env["FOX_CONFIG"] ?? process.env["KILO_CONFIG"],
  FOX_CONFIG_CONTENT: process.env["FOX_CONFIG_CONTENT"] ?? process.env["KILO_CONFIG_CONTENT"],
  FOX_DISABLE_AUTOUPDATE: truthy("FOX_DISABLE_AUTOUPDATE") || truthy("KILO_DISABLE_AUTOUPDATE"),
  FOX_ALWAYS_NOTIFY_UPDATE: truthy("FOX_ALWAYS_NOTIFY_UPDATE") || truthy("KILO_ALWAYS_NOTIFY_UPDATE"),
  FOX_DISABLE_PRUNE: truthy("FOX_DISABLE_PRUNE") || truthy("KILO_DISABLE_PRUNE"),
  FOX_DISABLE_TERMINAL_TITLE: truthy("FOX_DISABLE_TERMINAL_TITLE") || truthy("KILO_DISABLE_TERMINAL_TITLE"),
  FOX_SHOW_TTFD: truthy("FOX_SHOW_TTFD") || truthy("KILO_SHOW_TTFD"),
  FOX_DISABLE_DEFAULT_PLUGINS: truthy("FOX_DISABLE_DEFAULT_PLUGINS") || truthy("KILO_DISABLE_DEFAULT_PLUGINS"),
  FOX_DISABLE_LSP_DOWNLOAD: truthy("FOX_DISABLE_LSP_DOWNLOAD") || truthy("KILO_DISABLE_LSP_DOWNLOAD"),
  FOX_ENABLE_EXPERIMENTAL_MODELS:
    truthy("FOX_ENABLE_EXPERIMENTAL_MODELS") || truthy("KILO_ENABLE_EXPERIMENTAL_MODELS"),
  FOX_DISABLE_AUTOCOMPACT: truthy("FOX_DISABLE_AUTOCOMPACT") || truthy("KILO_DISABLE_AUTOCOMPACT"),
  FOX_DISABLE_MODELS_FETCH: truthy("FOX_DISABLE_MODELS_FETCH") || truthy("KILO_DISABLE_MODELS_FETCH"),
  FOX_DISABLE_MOUSE: truthy("FOX_DISABLE_MOUSE") || truthy("KILO_DISABLE_MOUSE"),
  FOX_DISABLE_EXTERNAL_SKILLS: truthy("FOX_DISABLE_EXTERNAL_SKILLS") || truthy("KILO_DISABLE_EXTERNAL_SKILLS"),
  FOX_EXPERIMENTAL_CUSTOMIZE_SKILL: unstableDefault("FOX_EXPERIMENTAL_CUSTOMIZE_SKILL"),
  FOX_FAKE_VCS: process.env["FOX_FAKE_VCS"] ?? process.env["KILO_FAKE_VCS"],
  FOX_SERVER_PASSWORD: process.env["FOX_SERVER_PASSWORD"] ?? process.env["KILO_SERVER_PASSWORD"],
  FOX_SERVER_USERNAME: process.env["FOX_SERVER_USERNAME"] ?? process.env["KILO_SERVER_USERNAME"],
  FOX_ENABLE_QUESTION_TOOL: truthy("FOX_ENABLE_QUESTION_TOOL") || truthy("KILO_ENABLE_QUESTION_TOOL"),

  FOX_EXPERIMENTAL,

  // -- Lossless Token Compression --
  FOX_EXPERIMENTAL_COMPRESS: enabledByExperimental("FOX_EXPERIMENTAL_COMPRESS"),
  FOX_EXPERIMENTAL_COMPRESS_PATHS: enabledByExperimental("FOX_EXPERIMENTAL_COMPRESS_PATHS", "FOX_EXPERIMENTAL_COMPRESS"),
  FOX_EXPERIMENTAL_COMPRESS_SCHEMA: enabledByExperimental("FOX_EXPERIMENTAL_COMPRESS_SCHEMA", "FOX_EXPERIMENTAL_COMPRESS"),
  FOX_EXPERIMENTAL_COMPRESS_DIFF: enabledByExperimental("FOX_EXPERIMENTAL_COMPRESS_DIFF", "FOX_EXPERIMENTAL_COMPRESS"),
  FOX_EXPERIMENTAL_COMPRESS_DATA: enabledByExperimental("FOX_EXPERIMENTAL_COMPRESS_DATA", "FOX_EXPERIMENTAL_COMPRESS"),
  FOX_EXPERIMENTAL_COMPRESS_SUPERSEDE: enabledByExperimental("FOX_EXPERIMENTAL_COMPRESS_SUPERSEDE", "FOX_EXPERIMENTAL_COMPRESS"),
  FOX_EXPERIMENTAL_COMPRESS_GIT: enabledByExperimental("FOX_EXPERIMENTAL_COMPRESS_GIT", "FOX_EXPERIMENTAL_COMPRESS"),
  FOX_EXPERIMENTAL_COMPRESS_DIFF_CONTEXT:
    number("FOX_EXPERIMENTAL_COMPRESS_DIFF_CONTEXT") ?? 1,

  FOX_EXPERIMENTAL_FILEWATCHER: Config.boolean("FOX_EXPERIMENTAL_FILEWATCHER").pipe(Config.withDefault(false)),

  FOX_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("FOX_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),

  FOX_EXPERIMENTAL_ICON_DISCOVERY:
    FOX_EXPERIMENTAL ||
    truthy("FOX_EXPERIMENTAL_ICON_DISCOVERY") ||
    truthy("KILO_EXPERIMENTAL_ICON_DISCOVERY"),

  FOX_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthy(copy),

  FOX_ENABLE_EXA:
    truthy("FOX_ENABLE_EXA") ||
    truthy("KILO_ENABLE_EXA") ||
    FOX_EXPERIMENTAL ||
    truthy("FOX_EXPERIMENTAL_EXA") ||
    truthy("KILO_EXPERIMENTAL_EXA"),

  FOX_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS:
    number("FOX_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS") ?? number("KILO_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS"),

  FOX_EXPERIMENTAL_OUTPUT_TOKEN_MAX:
    number("FOX_EXPERIMENTAL_OUTPUT_TOKEN_MAX") ?? number("KILO_EXPERIMENTAL_OUTPUT_TOKEN_MAX"),

  FOX_EXPERIMENTAL_OXFMT: FOX_EXPERIMENTAL || truthy("FOX_EXPERIMENTAL_OXFMT") || truthy("KILO_EXPERIMENTAL_OXFMT"),

  FOX_EXPERIMENTAL_LSP_TY: truthy("FOX_EXPERIMENTAL_LSP_TY") || truthy("KILO_EXPERIMENTAL_LSP_TY"),

  FOX_EXPERIMENTAL_LSP_TOOL:
    FOX_EXPERIMENTAL || truthy("FOX_EXPERIMENTAL_LSP_TOOL") || truthy("KILO_EXPERIMENTAL_LSP_TOOL"),

  FOX_EXPERIMENTAL_PLAN_MODE:
    FOX_EXPERIMENTAL || truthy("FOX_EXPERIMENTAL_PLAN_MODE") || truthy("KILO_EXPERIMENTAL_PLAN_MODE"),

  FOX_EXPERIMENTAL_SCOUT: FOX_EXPERIMENTAL || truthy("FOX_EXPERIMENTAL_SCOUT") || truthy("KILO_EXPERIMENTAL_SCOUT"),

  FOX_EXPERIMENTAL_MARKDOWN: !falsy("FOX_EXPERIMENTAL_MARKDOWN") && !falsy("KILO_EXPERIMENTAL_MARKDOWN"),

  FOX_ENABLE_PARALLEL:
    truthy("FOX_ENABLE_PARALLEL") ||
    truthy("KILO_ENABLE_PARALLEL") ||
    truthy("FOX_EXPERIMENTAL_PARALLEL") ||
    truthy("KILO_EXPERIMENTAL_PARALLEL"),

  FOX_MODELS_URL: process.env["FOX_MODELS_URL"] ?? process.env["KILO_MODELS_URL"],

  FOX_MODELS_PATH: process.env["FOX_MODELS_PATH"] ?? process.env["KILO_MODELS_PATH"],

  FOX_DISABLE_EMBEDDED_WEB_UI: truthy("FOX_DISABLE_EMBEDDED_WEB_UI") || truthy("KILO_DISABLE_EMBEDDED_WEB_UI"),

  FOX_DB: process.env["FOX_DB"] ?? process.env["KILO_DB"],

  FOX_DISABLE_CHANNEL_DB: truthy("FOX_DISABLE_CHANNEL_DB") || truthy("KILO_DISABLE_CHANNEL_DB"),

  FOX_SKIP_MIGRATIONS: truthy("FOX_SKIP_MIGRATIONS") || truthy("KILO_SKIP_MIGRATIONS"),

  FOX_STRICT_CONFIG_DEPS: truthy("FOX_STRICT_CONFIG_DEPS") || truthy("KILO_STRICT_CONFIG_DEPS"),

  FOX_WORKSPACE_ID: process.env["FOX_WORKSPACE_ID"] ?? process.env["KILO_WORKSPACE_ID"],

  FOX_EXPERIMENTAL_WORKSPACES: enabledByExperimental("FOX_EXPERIMENTAL_WORKSPACES", "KILO_EXPERIMENTAL_WORKSPACES"),

  FOX_EXPERIMENTAL_EVENT_SYSTEM:
    FOX_EXPERIMENTAL || truthy("FOX_EXPERIMENTAL_EVENT_SYSTEM") || truthy("KILO_EXPERIMENTAL_EVENT_SYSTEM"),

  FOX_EXPERIMENTAL_SESSION_SWITCHING:
    FOX_EXPERIMENTAL ||
    truthy("FOX_EXPERIMENTAL_SESSION_SWITCHING") ||
    truthy("KILO_EXPERIMENTAL_SESSION_SWITCHING"),

  FOX_EXPERIMENTAL_SESSION_SWITCHER: enabledByExperimental(
    "FOX_EXPERIMENTAL_SESSION_SWITCHER",
    "KILO_EXPERIMENTAL_SESSION_SWITCHER",
  ),

  FOX_DISABLE_FFF: fff === undefined ? process.platform === "win32" : truthy(fff),

  get FOX_DISABLE_PROJECT_CONFIG() {
    return truthy("FOX_DISABLE_PROJECT_CONFIG") || truthy("KILO_DISABLE_PROJECT_CONFIG")
  },
  get FOX_EXPERIMENTAL_REFERENCES() {
    return enabledByExperimental("FOX_EXPERIMENTAL_REFERENCES", "KILO_EXPERIMENTAL_REFERENCES")
  },
  get FOX_TUI_CONFIG() {
    return process.env["FOX_TUI_CONFIG"] ?? process.env["KILO_TUI_CONFIG"]
  },
  get FOX_CONFIG_DIR() {
    return process.env["FOX_CONFIG_DIR"] ?? process.env["KILO_CONFIG_DIR"]
  },
  get FOX_PURE() {
    return truthy("FOX_PURE") || truthy("KILO_PURE")
  },
  get FOX_PERMISSION() {
    return process.env["FOX_PERMISSION"] ?? process.env["KILO_PERMISSION"]
  },
  get FOX_PLUGIN_META_FILE() {
    return process.env["FOX_PLUGIN_META_FILE"] ?? process.env["KILO_PLUGIN_META_FILE"]
  },
  /** FOX_CLIENT identifies the hosting environment: "cli" | "vscode" | "jetbrains".
   * Falls back to KILO_CLIENT for backward compatibility with existing launcher scripts. */
  get FOX_CLIENT() {
    return process.env["FOX_CLIENT"] ?? process.env["KILO_CLIENT"] ?? "cli"
  },
  get FOX_SESSION_RETRY_LIMIT() {
    return number("FOX_SESSION_RETRY_LIMIT") ?? number("KILO_SESSION_RETRY_LIMIT")
  },
}
