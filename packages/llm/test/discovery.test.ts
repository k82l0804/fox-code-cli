import { describe, expect, test, beforeEach } from "bun:test"
import { discoverModelLimits, parseModelLimits } from "../src/discovery"
import { clearCache } from "../src/discovery-cache"

describe("parseModelLimits", () => {
  test("parses OpenAI format with context_window", () => {
    const result = parseModelLimits({ context_window: 128000 })
    expect(result).toEqual({ context: 128000, output: undefined })
  })

  test("parses Anthropic format with max_tokens and max_output_tokens", () => {
    const result = parseModelLimits({ max_tokens: 200000, max_output_tokens: 4096 })
    expect(result).toEqual({ context: 200000, output: 4096 })
  })

  test("parses Google format with inputTokenLimit", () => {
    const result = parseModelLimits({ inputTokenLimit: 1048576 })
    expect(result).toEqual({ context: 1048576, output: undefined })
  })

  test("parses Google format with input and output token limits", () => {
    const result = parseModelLimits({ inputTokenLimit: 1000000, outputTokenLimit: 8192 })
    expect(result).toEqual({ context: 1000000, output: 8192 })
  })

  test("parses vLLM / LiteLLM max_context_length", () => {
    const result = parseModelLimits({ max_context_length: 65536 })
    expect(result).toEqual({ context: 65536, output: undefined })
  })

  test("unwraps data property wrapper", () => {
    const result = parseModelLimits({ data: { context_window: 32768, max_output_tokens: 2048 } })
    expect(result).toEqual({ context: 32768, output: 2048 })
  })

  test("returns undefined for empty/unrecognized object", () => {
    expect(parseModelLimits({})).toBeUndefined()
    expect(parseModelLimits(null)).toBeUndefined()
    expect(parseModelLimits("not an object")).toBeUndefined()
  })
})

describe("discoverModelLimits", () => {
  beforeEach(() => {
    clearCache()
  })

  test("parses OpenAI format via HTTP", async () => {
    using server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url)
        if (url.pathname === "/models/gpt-4o") {
          return Response.json({ id: "gpt-4o", context_window: 128000 })
        }
        return new Response("Not Found", { status: 404 })
      },
    })

    const baseUrl = `http://localhost:${server.port}`
    const result = await discoverModelLimits(baseUrl, "gpt-4o")

    expect(result).toEqual({
      context: 128000,
      output: undefined,
      source: "api",
    })
  })

  test("parses Anthropic format via HTTP", async () => {
    using server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url)
        if (url.pathname === "/models/claude-3-5-sonnet") {
          return Response.json({
            id: "claude-3-5-sonnet",
            max_tokens: 200000,
            max_output_tokens: 4096,
          })
        }
        return new Response("Not Found", { status: 404 })
      },
    })

    const baseUrl = `http://localhost:${server.port}`
    const result = await discoverModelLimits(baseUrl, "claude-3-5-sonnet")

    expect(result).toEqual({
      context: 200000,
      output: 4096,
      source: "api",
    })
  })

  test("parses Google format via HTTP", async () => {
    using server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url)
        if (url.pathname === "/models/gemini-2.5-pro") {
          return Response.json({
            id: "gemini-2.5-pro",
            inputTokenLimit: 1048576,
          })
        }
        return new Response("Not Found", { status: 404 })
      },
    })

    const baseUrl = `http://localhost:${server.port}`
    const result = await discoverModelLimits(baseUrl, "gemini-2.5-pro")

    expect(result).toEqual({
      context: 1048576,
      output: undefined,
      source: "api",
    })
  })

  test("falls back on 404", async () => {
    using server = Bun.serve({
      port: 0,
      fetch() {
        return new Response("Not Found", { status: 404 })
      },
    })

    const baseUrl = `http://localhost:${server.port}`
    const staticLimits = { context: 32000, output: 4096 }
    const result = await discoverModelLimits(baseUrl, "unknown-model", undefined, staticLimits)

    expect(result).toEqual({
      context: 32000,
      output: 4096,
      source: "static",
    })
  })

  test("falls back on timeout", async () => {
    using server = Bun.serve({
      port: 0,
      async fetch() {
        // Sleep longer than the 50ms timeout
        await new Promise((resolve) => setTimeout(resolve, 200))
        return Response.json({ context_window: 128000 })
      },
    })

    const baseUrl = `http://localhost:${server.port}`
    const staticLimits = { context: 16000 }
    // Pass short timeoutMs (50ms) to verify timeout fallback quickly
    const result = await discoverModelLimits(baseUrl, "slow-model", undefined, staticLimits, 50)

    expect(result).toEqual({
      context: 16000,
      output: undefined,
      source: "static",
    })
  })

  test("caches results (only 1 HTTP request)", async () => {
    let requestCount = 0
    using server = Bun.serve({
      port: 0,
      fetch() {
        requestCount++
        return Response.json({ context_window: 64000 })
      },
    })

    const baseUrl = `http://localhost:${server.port}`
    const first = await discoverModelLimits(baseUrl, "cached-model")
    const second = await discoverModelLimits(baseUrl, "cached-model")

    expect(first.context).toBe(64000)
    expect(second.context).toBe(64000)
    expect(requestCount).toBe(1)
  })

  test("no cache cross-talk between different models", async () => {
    let requestCount = 0
    using server = Bun.serve({
      port: 0,
      fetch(req) {
        requestCount++
        const url = new URL(req.url)
        if (url.pathname.endsWith("model-a")) {
          return Response.json({ context_window: 32000 })
        }
        return Response.json({ context_window: 64000 })
      },
    })

    const baseUrl = `http://localhost:${server.port}`
    const a = await discoverModelLimits(baseUrl, "model-a")
    const b = await discoverModelLimits(baseUrl, "model-b")

    expect(a.context).toBe(32000)
    expect(b.context).toBe(64000)
    expect(requestCount).toBe(2)
  })

  test("sends Authorization header when apiKey provided", async () => {
    let receivedAuth = ""
    using server = Bun.serve({
      port: 0,
      fetch(req) {
        receivedAuth = req.headers.get("authorization") ?? ""
        return Response.json({ context_window: 128000 })
      },
    })

    const baseUrl = `http://localhost:${server.port}`
    await discoverModelLimits(baseUrl, "auth-model", "secret-key-123")

    expect(receivedAuth).toBe("Bearer secret-key-123")
  })
})
