export type FoxEmbeddingModel = {
  id: string
  name: string
  dimension: number
  scoreThreshold: number
  note?: string
}

export type FoxEmbeddingModelCatalog = {
  defaultModel: string
  models: FoxEmbeddingModel[]
  aliases: Record<string, string>
}

export const EMPTY_FOX_EMBEDDING_MODEL_CATALOG: FoxEmbeddingModelCatalog = {
  defaultModel: "text-embedding-3-small",
  models: [
    {
      id: "text-embedding-3-small",
      name: "OpenAI Text Embedding 3 Small",
      dimension: 1536,
      scoreThreshold: 0.7,
    },
  ],
  aliases: {},
}
export const EMPTY_KILO_EMBEDDING_MODEL_CATALOG = EMPTY_FOX_EMBEDDING_MODEL_CATALOG

export async function fetchEmbeddingModelCatalog(_options: unknown = {}): Promise<FoxEmbeddingModelCatalog> {
  return EMPTY_FOX_EMBEDDING_MODEL_CATALOG
}
export const fetchKiloEmbeddingModelCatalog = fetchEmbeddingModelCatalog

export function resolveEmbeddingBaseUrl(_options?: unknown): string {
  return "http://localhost:8000/v1"
}
export const resolveKiloGatewayBaseUrl = resolveEmbeddingBaseUrl

export type { FoxEmbeddingModel as KiloEmbeddingModel, FoxEmbeddingModelCatalog as KiloEmbeddingModelCatalog }
