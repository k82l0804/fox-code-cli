import { createFoxClient, type Event, type FoxClient } from "@foxcode/sdk/v2"
import z from "zod"
import { setTimeout } from "node:timers/promises"
import { promisify } from "node:util"

const connections = new WeakMap<FoxClient, NonNullable<Parameters<typeof createFoxClient>[0]>>()
const capability = z.union([
  z.object({
    paths: z.object({
      "/foxcode/session/{sessionID}/drain": z.object({
        post: z.object({ operationId: z.literal("foxcode.drainSession") }),
      }),
    }),
  }),
  z.object({
    paths: z.object({
      "/kilocode/session/{sessionID}/drain": z.object({
        post: z.object({ operationId: z.literal("kilocode.drainSession") }),
      }),
    }),
  }),
])

export namespace FoxRunDrain {
  export function client(config: NonNullable<Parameters<typeof createFoxClient>[0]>) {
    const sdk = createFoxClient(config)
    connections.set(sdk, config)
    return sdk
  }

  export function scope(sdk: FoxClient, directory: string, signal?: AbortSignal) {
    const config = connections.get(sdk)
    if (!config) throw new Error("Missing headless server transport")
    return client({ ...config, directory, signal: signal ?? config.signal })
  }

  export async function check(sdk: FoxClient, signal: AbortSignal) {
    const config = connections.get(sdk)
    if (!config?.baseUrl) throw new Error("Missing headless server transport")
    const headers = new Headers()
    if (config.headers instanceof Headers) config.headers.forEach((value, name) => headers.set(name, value))
    else if (Array.isArray(config.headers)) for (const [name, value] of config.headers) headers.set(name, value)
    else
      for (const [name, value] of Object.entries(config.headers ?? {})) {
        if (typeof value === "string") headers.set(name, value)
        else if (value != null) throw new Error("Unsupported server header value")
      }
    const request = new Request(`${config.baseUrl.replace(/\/$/, "")}/doc`, { headers, signal })
    const response = await (config.fetch ?? globalThis.fetch)(request)
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Server rejected access (HTTP ${response.status}); check server authentication and permissions`)
    }
    if (!response.ok && response.status !== 404) {
      throw new Error(`Server capability check failed (HTTP ${response.status})`)
    }
    if (!response.ok || !response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      throw new Error("Server does not support session draining; upgrade or restart the server")
    }
    const body: unknown = await response.json().catch(() => {
      throw new Error("Server returned invalid capability JSON")
    })
    if (!capability.safeParse(body).success) {
      throw new Error("Server does not support session draining; upgrade or restart the server")
    }
  }

  export function create(sessionID: string) {
    const token = crypto.randomUUID()
    const abort = new AbortController()
    const connected = Promise.withResolvers<void>()
    const acknowledged = Promise.withResolvers<void>()
    const failure = Promise.withResolvers<Error>()
    let closing = false
    let drained = false
    const race = <A extends Promise<unknown>>(work: A) =>
      Promise.race([
        work,
        failure.promise.then((error): never => {
          throw error
        }),
      ])
    return {
      token,
      signal: abort.signal,
      race,
      ready: () => race(connected.promise),
      pause: (ms: number) => setTimeout(ms, undefined, { signal: abort.signal }),
      event(event: Event) {
        if (event.type === "server.connected") connected.resolve()
        if (
          (event.type === "session.drain.interrupted" ||
            (event.type === "session.turn.close" && event.properties.reason === "interrupted")) &&
          event.properties.sessionID === sessionID
        ) {
          failure.resolve(new Error("Session interrupted before completion"))
        }
        if (
          event.type !== "session.drained" ||
          event.properties.sessionID !== sessionID ||
          event.properties.token !== token
        )
          return false
        drained = true
        acknowledged.resolve()
        return true
      },
      end(error?: unknown) {
        if (closing || (drained && !error)) return
        failure.resolve(error instanceof Error ? error : new Error("Session event stream ended before completion"))
      },
      async wait(sdk: FoxClient, directory?: string) {
        const drainClient: any = (sdk as any).foxcode ?? (sdk as any).kilocode
        let result = await race(drainClient.drainSession({ sessionID, directory, token }, { signal: abort.signal }))
        if ((result.error || result.data !== true) && (sdk as any).client) {
          result = await race(
            (sdk as any).client.post({
              url: "/foxcode/session/{sessionID}/drain",
              path: { sessionID },
              query: { directory },
              body: { token },
              headers: { "Content-Type": "application/json" },
              signal: abort.signal,
            }),
          )
        }
        if (result.error || result.data !== true) {
          throw new Error("Server did not acknowledge session completion")
        }
        await race(acknowledged.promise)
      },
      close() {
        closing = true
        abort.abort()
      },
    }
  }

  export async function flush(
    streams: readonly { write(chunk: string, callback: (error?: Error | null) => void): unknown }[] = [
      process.stdout,
      process.stderr,
    ],
  ) {
    await Promise.all(
      streams.map((stream) =>
        promisify(stream.write.bind(stream))("").catch((error: unknown) => {
          if (
            error instanceof Error &&
            "code" in error &&
            (error.code === "EPIPE" || error.code === "ERR_STREAM_DESTROYED")
          )
            return
          throw error
        }),
      ),
    )
  }
}

export { FoxRunDrain as KiloRunDrain }
