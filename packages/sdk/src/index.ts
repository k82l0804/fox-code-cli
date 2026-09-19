export * from "./client.js"
export * from "./server.js"

import { createFoxClient } from "./client.js"
import { createFoxServer } from "./server.js"
import type { ServerOptions } from "./server.js"

export async function createKilo(options?: ServerOptions) {
  const server = await createFoxServer({
    ...options,
  })

  const client = createFoxClient({
    baseUrl: server.url,
  })

  return {
    client,
    server,
  }
}
