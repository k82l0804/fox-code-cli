export interface OpenAICompatibleProfile {
  readonly provider: string
  readonly baseURL: string
}

export const profiles = {} as const satisfies Record<string, OpenAICompatibleProfile>

export const byProvider: Record<string, OpenAICompatibleProfile> = {}
