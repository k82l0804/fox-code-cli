import type { IndexingState } from "./status.js"

export interface IndexingConfigInput {
  enabled?: boolean
  embedderProvider?: string
  vectorStoreProvider?: string
  modelId?: string | null
  modelDimension?: number | null
  openAiCompatibleBaseUrl?: string
  openAiCompatibleApiKey?: string
  ollamaBaseUrl?: string
  kiloApiKey?: string
  kiloBaseUrl?: string
  kiloOrganizationId?: string
  openAiApiKey?: string
  searchMinScore?: number
  searchMaxResults?: number
  embeddingBatchSize?: number
  scannerMaxBatchRetries?: number
  fileExtensions?: string[]
}

export interface Payload {
  filePath: string
  fileHash?: string
  codeChunk: string
  startLine: number
  endLine: number
  [key: string]: any
}

export interface VectorStoreSearchResult {
  id: string | number
  score: number
  payload?: Payload | null
}

export type IndexingTelemetryEvent = any

export class CodeIndexManager {
  readonly isFeatureEnabled: boolean = false
  readonly isFeatureConfigured: boolean = false
  readonly onTelemetry = {
    on: (_fn: (data: any) => void) => ({ dispose: () => {} }),
  }
  readonly onProgressUpdate = {
    on: (_fn: () => void) => ({ dispose: () => {} }),
  }

  constructor(
    public readonly directory?: string,
    public readonly root?: string,
    public readonly baselineDirectory?: string,
  ) {}

  static create(...args: any[]): CodeIndexManager {
    return new CodeIndexManager(...args)
  }

  getCurrentStatus(): {
    systemStatus: IndexingState
    message?: string
    processedItems: number
    totalItems: number
    currentItemUnit: string
  } {
    return {
      systemStatus: "Disabled",
      message: "Indexing disabled.",
      processedItems: 0,
      totalItems: 0,
      currentItemUnit: "files",
    }
  }

  async initialize(_config: IndexingConfigInput): Promise<{ requiresRestart: boolean }> {
    return { requiresRestart: false }
  }

  async searchIndex(_query: string, _directoryPrefix?: string): Promise<VectorStoreSearchResult[]> {
    return []
  }

  async dispose(): Promise<void> {}
}
