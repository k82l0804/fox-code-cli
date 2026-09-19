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

export async function tracingLayer() {
  return Layer.empty
}

export * as Otlp from "./otlp"
