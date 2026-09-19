export * from "./gen/types.gen.js"
export type { FileSystemEntry as LocationFileSystemEntry } from "./gen/types.gen.js"

import { createClient as createInternalClient } from "./gen/client/client.gen.js"
import { type Config } from "./gen/client/types.gen.js"
import { FoxClient } from "./gen/sdk.gen.js"
import { wrapClientError } from "../error-interceptor.js"
export { type Config as FoxClientConfig, type Config as KiloClientConfig, FoxClient, FoxClient as KiloClient }

function pick(value: string | null, fallback?: string, encode?: (value: string) => string) {
  if (!value) return
  if (!fallback) return value
  if (value === fallback) return fallback
  if (encode && value === encode(fallback)) return fallback
  return value
}

function rewrite(
  request: Request,
  options?: {
    directory?: string
    workspace?: string
  },
) {
  if (request.method !== "GET" && request.method !== "HEAD") return request

  const directory = pick(request.headers.get("x-fox-directory") ?? request.headers.get("x-kilo-directory"), options?.directory, encodeURIComponent)
  const workspace = pick(request.headers.get("x-opencode-workspace"), options?.workspace)
  if (!directory && !workspace) return request

  const url = new URL(request.url)
  if (directory && !url.searchParams.has("directory")) {
    url.searchParams.set("directory", directory)
  }
  if (workspace && !url.searchParams.has("workspace")) {
    url.searchParams.set("workspace", workspace)
  }

  const next = new Request(url.href, request)
  next.headers.delete("x-fox-directory")
  next.headers.delete("x-kilo-directory")
  next.headers.delete("x-opencode-workspace")
  return next
}

export function createFoxClient(
  config?: Config & { directory?: string; experimental_workspaceID?: string },
) {
  if (!config?.fetch) {
    const customFetch: any = (req: any) => {
      // Pass duplex in the init arg so it survives VS Code's proxy-agent
      // fetch wrapper, which calls originalFetch(request, { ...init, dispatcher })
      // and would otherwise drop duplex from the cloned Request.
      // timeout: false disables Bun's default request timeout for long-running
      // streaming calls (replaces the old req.timeout = false assignment which
      // wouldn't survive the clone triggered by passing an init object).
      return fetch(req, { duplex: "half", timeout: false } as any)
    }
    config = {
      ...config,
      fetch: customFetch,
    }
  }

  if (config?.directory) {
    config.headers = {
      ...config.headers,
      "x-fox-directory": encodeURIComponent(config.directory),
      "x-kilo-directory": encodeURIComponent(config.directory),
    }
  }

  if (config?.experimental_workspaceID) {
    config.headers = {
      ...config.headers,
      "x-opencode-workspace": config.experimental_workspaceID,
    }
  }

  // Node.js/Electron require duplex: "half" when creating Request objects
  // with a body. The option propagates through config → opts → requestInit
  // and is harmless in environments that don't need it (Bun, browsers).
  ;(config as any).duplex = "half"

  const client = createInternalClient(config)
  client.interceptors.request.use((request) =>
    rewrite(request, {
      directory: config?.directory,
      workspace: config?.experimental_workspaceID,
    }),
  )
  client.interceptors.response.use((response) => {
    const contentType = response.headers.get("content-type")
    if (contentType === "text/html")
      throw new Error("Request is not supported by this version of OpenCode Server (Server responded with text/html)")

    return response
  })
  client.interceptors.error.use(wrapClientError)
  return new FoxClient({ client })
}

export const createClient = createFoxClient
export const createKiloClient = createFoxClient
