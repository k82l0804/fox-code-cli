// mock_server.ts — Chaos API for Challenge 2
// Simulates transient production failures: 429 -> Malformed JSON -> 200 OK

const PORT = parseInt(process.env.CHAOS_PORT || "4099", 10)
let callCount = 0

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url)

    if (url.pathname === "/reset") {
      callCount = 0
      return new Response(JSON.stringify({ message: "Reset call count to 0" }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    if (url.pathname === "/state") {
      return new Response(JSON.stringify({ callCount }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    if (url.pathname === "/deploy") {
      callCount++
      console.log(`[Chaos API] Request #${callCount} received (${req.method})`)

      if (callCount === 1) {
        // First try: 429 Rate limit
        console.log(`[Chaos API] Returning 429 Too Many Requests (Retry-After: 2)`)
        return new Response(
          JSON.stringify({
            error: "Too Many Requests",
            message: "Deployment queue busy. Please back off.",
            retry_after_seconds: 2,
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "2",
            },
          },
        )
      }

      if (callCount === 2) {
        // Second try: Corrupted / truncated JSON string
        console.log(`[Chaos API] Returning 200 with intentionally corrupted JSON`)
        return new Response(
          '{"status": "deploying", "build_id": "bld_88219", "corrupted_chunk": <UNEXPECTED_TOKEN_ERROR>}',
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        )
      }

      // Third try: 200 OK with valid completed response
      console.log(`[Chaos API] Returning 200 OK — Deployment Complete!`)
      return new Response(
        JSON.stringify({
          status: "completed",
          release_id: "rel_v2.1.0",
          healthy: true,
          deployed_at: new Date().toISOString(),
          message: "Release rel_v2.1.0 deployed successfully to production.",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
    }

    return new Response("Not Found", { status: 404 })
  },
})

console.log(`[Chaos API] Listening on http://127.0.0.1:${PORT}`)
