import { Schema } from "effect"
import z from "zod"

export const DEFAULT_VECTOR_STORE = "lancedb"

export { isFileExtension, normalizeFileExtensions, parseFileExtensions } from "./file-extensions.js"

const providers = [
  "fox",
  "ollama",
  "openai-compatible",
] as const

const stores = ["lancedb", "qdrant"] as const

export const IndexingConfig = z
  .object({
    enabled: z.boolean().optional(),
    provider: z.enum(providers).optional(),
    model: z.string().nullable().optional(),
    dimension: z.number().int().positive().nullable().optional(),
    vectorStore: z.enum(stores).optional(),
    kilo: z.object({ apiKey: z.string().optional(), baseUrl: z.string().optional(), organizationId: z.string().optional() }).optional(),
    ollama: z.object({ baseUrl: z.string().optional() }).optional(),
    "openai-compatible": z.object({ baseUrl: z.string().optional(), apiKey: z.string().optional() }).optional(),
    searchMinScore: z.number().min(0).max(1).optional(),
    searchMaxResults: z.number().int().positive().optional(),
    embeddingBatchSize: z.number().int().positive().optional(),
    scannerMaxBatchRetries: z.number().int().positive().optional(),
    fileExtensions: z.array(z.string()).optional(),
  })
  .optional()

export type IndexingConfig = z.infer<typeof IndexingConfig>

const Provider = Schema.Literals(providers)
const Store = Schema.Literals(stores)

export const IndexingSchema = Schema.Struct({
  enabled: Schema.optional(Schema.Boolean),
  provider: Schema.optional(Provider),
  model: Schema.optional(Schema.NullOr(Schema.String)),
  dimension: Schema.optional(Schema.NullOr(Schema.Number)),
  vectorStore: Schema.optional(Store),
  fileExtensions: Schema.optional(Schema.Array(Schema.String)),
})

export function toIndexingConfigInput(cfg: any): any {
  return {
    enabled: cfg?.enabled ?? false,
    embedderProvider: cfg?.provider ?? "openai-compatible",
    vectorStoreProvider: cfg?.vectorStore ?? DEFAULT_VECTOR_STORE,
    modelId: cfg?.model ?? undefined,
    modelDimension: cfg?.dimension ?? undefined,
    openAiCompatibleBaseUrl: cfg?.["openai-compatible"]?.baseUrl,
    openAiCompatibleApiKey: cfg?.["openai-compatible"]?.apiKey,
    ollamaBaseUrl: cfg?.ollama?.baseUrl,
  }
}
