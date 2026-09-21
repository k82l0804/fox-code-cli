import { Layer } from "effect"
import { FetchHttpClient, HttpMiddleware, HttpRouter, HttpServer } from "effect/unstable/http"
import { CorsConfig, isAllowedCorsOrigin, type CorsOptions } from "@opencode-ai/server/cors"
import { compressionLayer } from "@/server/routes/instance/httpapi/middleware/compression"
import { corsVaryFix } from "@/server/routes/instance/httpapi/middleware/cors-vary"
import { errorLayer } from "@/server/routes/instance/httpapi/middleware/error"
import { fenceLayer } from "@/server/routes/instance/httpapi/middleware/fence"
import { EffectFlock } from "@opencode-ai/core/util/effect-flock"
import { AppNodeBuilderV1 } from "@/effect/app-node-builder-v1"
import { FoxViewers } from "@/foxcode/presence/service"
import { agentBuilderHandlers } from "./handlers/agent-builder"
import { backgroundProcessHandlers } from "./handlers/background-process"
import { branchNameHandlers } from "./handlers/branch-name"
import { commitMessageHandlers } from "./handlers/commit-message"
import { configConsoleHandlers } from "./handlers/config-console"
import { enhancePromptHandlers } from "./handlers/enhance-prompt"
import { indexingHandlers } from "./handlers/indexing"
import { instanceReloadHandlers } from "./handlers/instance-reload"
import { foxcodeHandlers, kilocodeHandlers } from "./handlers/foxcode"
import { memoryHandlers } from "./handlers/memory"
import { networkHandlers } from "./handlers/network"
import { remoteHandlers } from "./handlers/remote"
import { sandboxHandlers } from "./handlers/sandbox"
import { sessionImportHandlers } from "./handlers/session-import"
import { suggestionHandlers } from "./handlers/suggestion"

export const provide = Layer.provide([
  agentBuilderHandlers,
  backgroundProcessHandlers,
  branchNameHandlers,
  commitMessageHandlers,
  configConsoleHandlers,
  enhancePromptHandlers,
  indexingHandlers,
  instanceReloadHandlers,
  foxcodeHandlers,
  memoryHandlers,
  networkHandlers,
  remoteHandlers,
  sandboxHandlers,
  sessionImportHandlers,
  suggestionHandlers,
])

export function provideListener(opts?: CorsOptions) {
  const cors = HttpRouter.middleware(
    HttpMiddleware.cors({
      allowedOrigins: (origin) => isAllowedCorsOrigin(origin, opts),
      maxAge: 86_400,
    }),
    { global: true },
  )
  return Layer.provide([
    errorLayer,
    compressionLayer,
    corsVaryFix,
    fenceLayer,
    cors,
    FoxViewers.defaultLayer,
    AppNodeBuilderV1.build(EffectFlock.node),
    FetchHttpClient.layer,
    HttpServer.layerServices,
    Layer.succeed(CorsConfig)(opts),
  ])
}
