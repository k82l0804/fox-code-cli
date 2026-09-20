import { Layer } from "effect"

export function resource(): { serviceName: string; serviceVersion: string; attributes: Record<string, string> } {
  return {
    serviceName: "fox",
    serviceVersion: "0.1.0",
    attributes: {},
  }
}

export function loggers() {
  return []
}

/**
 * Returns an Effect tracing layer backed by the OTLP/HTTP exporter.
 *
 * Disabled by default. Enable with either:
 *   - `FOX_TRACING=1` (uses default endpoint http://localhost:4318/v1/traces)
 *   - `OTEL_EXPORTER_OTLP_ENDPOINT=http://host:port` (standard OpenTelemetry env var)
 *
 * When enabled, every Effect.fn() span in the codebase is exported to the
 * configured OTLP endpoint (e.g. Jaeger at http://localhost:4318).
 *
 * Quick start with Jaeger:
 *   docker run -d --name jaeger \
 *     -p 16686:16686 \
 *     -p 4318:4318 \
 *     jaegertracing/jaeger:2 \
 *     --set receivers.otlp.protocols.http.endpoint=0.0.0.0:4318
 *
 *   FOX_TRACING=1 fox
 *   # Open http://localhost:16686 → Service: fox
 */
import fs from "node:fs"
import path from "node:path"
import os from "node:os"

function loadTracingConfig(): { enabled: boolean; endpoint?: string } {
  if (process.env.FOX_TRACING === "1" || process.env.KILO_TRACING === "1") {
    return { enabled: true }
  }
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) {
    return { enabled: true }
  }

  // Check config files in priority order: cwd -> ~/.config/fox
  const candidates = [
    path.join(process.cwd(), "fox.jsonc"),
    path.join(process.cwd(), "fox.json"),
    path.join(process.cwd(), ".fox", "fox.jsonc"),
    path.join(process.cwd(), ".fox", "fox.json"),
    path.join(os.homedir(), ".config", "fox", "fox.jsonc"),
    path.join(os.homedir(), ".config", "fox", "fox.json"),
  ]

  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, "utf8")
        const cleaned = raw.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")
        const parsed = JSON.parse(cleaned)
        if (parsed.tracing === true) {
          return { enabled: true }
        }
        if (parsed.tracing && typeof parsed.tracing === "object" && parsed.tracing.enabled !== false) {
          return {
            enabled: true,
            endpoint: typeof parsed.tracing.endpoint === "string" ? parsed.tracing.endpoint : undefined,
          }
        }
      }
    } catch {
      // Proceed to next candidate on parse error
    }
  }

  return { enabled: false }
}

export async function tracingLayer() {
  const cfg = loadTracingConfig()
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  const tracesEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT

  if (!cfg.enabled && !otlpEndpoint && !tracesEndpoint) {
    return Layer.empty
  }

  // Resolve the traces URL.
  // Priority: tracesEndpoint > otlpEndpoint > config file endpoint > default
  const baseUrl = tracesEndpoint
    ?? (otlpEndpoint ? `${otlpEndpoint.replace(/\/+$/, "")}/v1/traces` : undefined)
    ?? cfg.endpoint
    ?? "http://localhost:4318/v1/traces"

  const { OtlpTracer, OtlpSerialization } = await import("effect/unstable/observability")
  const { FetchHttpClient } = await import("effect/unstable/http")

  return OtlpTracer.layer({
    url: baseUrl,
    resource: resource(),
    exportInterval: "2 seconds",
    maxBatchSize: 256,
  }).pipe(
    Layer.provide(OtlpSerialization.layerJson),
    Layer.provide(FetchHttpClient.layer),
  )
}

export * as Otlp from "./otlp"
