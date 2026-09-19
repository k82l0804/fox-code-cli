export const FOX_RUN_ID = "FOX_RUN_ID"
export const KILO_RUN_ID = "FOX_RUN_ID"
export const FOX_PROCESS_ROLE = "FOX_PROCESS_ROLE"
export const KILO_PROCESS_ROLE = "FOX_PROCESS_ROLE"

export function ensureRunID() {
  const id = process.env.FOX_RUN_ID ?? process.env.KILO_RUN_ID ?? crypto.randomUUID()
  process.env.FOX_RUN_ID = id
  process.env.KILO_RUN_ID = id
  return id
}

export function ensureProcessRole(fallback: "main" | "worker") {
  const role = process.env.FOX_PROCESS_ROLE ?? process.env.KILO_PROCESS_ROLE ?? fallback
  process.env.FOX_PROCESS_ROLE = role
  process.env.KILO_PROCESS_ROLE = role
  return role
}

export function ensureProcessMetadata(fallback: "main" | "worker") {
  return {
    runID: ensureRunID(),
    processRole: ensureProcessRole(fallback),
  }
}

export function sanitizedProcessEnv(overrides?: Record<string, string>) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  )
  return overrides ? Object.assign(env, overrides) : env
}
