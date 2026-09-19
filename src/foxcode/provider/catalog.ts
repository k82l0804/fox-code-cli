import type { Auth } from "@/auth"

type Options = { kilocodeOrganizationId?: string; baseURL?: string; apiKey?: string; kilocodeToken?: string }

export function token(options: Options | undefined, info: Auth.Info | undefined) {
  if (process.env.FOX_API_KEY) return process.env.FOX_API_KEY
  if (process.env.KILO_API_KEY) return process.env.KILO_API_KEY
  if (info?.type === "oauth") return info.access
  if (info?.type === "api") return info.key
  if (options?.kilocodeToken != null) return options.kilocodeToken
  return options?.apiKey || undefined
}

export function organization(options: Options | undefined, info: Auth.Info | undefined) {
  return (
    process.env.FOX_ORG_ID ||
    process.env.KILO_ORG_ID ||
    (info?.type === "oauth" ? info.accountId : undefined) ||
    options?.kilocodeOrganizationId
  )
}

export function compatible(_options: { baseURL?: string; kilocodeToken?: string; kilocodeOrganizationId?: string }) {
  return true
}

export async function recommend(
  models: Readonly<Record<string, unknown>>,
  _options: Options | undefined,
  _info: Auth.Info | undefined,
  _known = true,
) {
  return Object.keys(models).at(0)
}
