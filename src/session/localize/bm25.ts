/**
 * BM25 Text Scoring over Code Identifiers + Docstrings
 *
 * Implements Okapi BM25 ranking across:
 * - File paths
 * - Exported symbol names and signatures
 * - Docstrings and comments
 *
 * Meets the key requirement: "sliding window carry-over" matches rate_limiter.ts
 * even if the filename does not contain "sliding window".
 */
import type { AstIndexer } from "@foxcode/indexing/ast/indexer"

export interface BM25Doc {
  file: string
  tokens: string[]
  length: number
}

export interface BM25Match {
  file: string
  score: number
}

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "has", "he", "in", "is", "it", "its", "of", "on", "that", "the",
  "to", "was", "were", "will", "with", "this", "but", "they", "have",
])

/**
 * Tokenize code text, identifier names, and natural language comments.
 * Splits camelCase, snake_case, kebab-case, path separators, and punctuation.
 */
export function tokenizeCodeText(text: string): string[] {
  if (!text) return []

  // Split camelCase transitions: rateLimiter -> rate Limiter
  const expanded = text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9_]/g, " ")
    .toLowerCase()

  const rawTokens = expanded.split(/\s+/)
  const tokens: string[] = []

  for (const raw of rawTokens) {
    const t = raw.replace(/^_+|_+$/g, "")
    if (t.length > 1 && !STOP_WORDS.has(t)) {
      tokens.push(t)
    }
  }

  return tokens
}

export class BM25Index {
  private docs: BM25Doc[] = []
  private avgdl = 0
  private docFrequencies = new Map<string, number>()
  private idf = new Map<string, number>()
  private k1: number
  private b: number

  constructor(k1 = 1.2, b = 0.75) {
    this.k1 = k1
    this.b = b
  }

  /**
   * Add a document to the index corpus.
   */
  addDocument(file: string, textParts: string[]) {
    // Collect all tokens from text parts
    const tokens: string[] = []
    for (const part of textParts) {
      tokens.push(...tokenizeCodeText(part))
    }

    const doc: BM25Doc = {
      file,
      tokens,
      length: tokens.length,
    }

    this.docs.push(doc)
  }

  /**
   * Finalize the index calculations (IDF and average doc length).
   */
  build() {
    const n = this.docs.length
    if (n === 0) {
      this.avgdl = 0
      return
    }

    let totalLength = 0
    this.docFrequencies.clear()
    this.idf.clear()

    for (const doc of this.docs) {
      totalLength += doc.length
      const uniqueTokens = new Set(doc.tokens)
      for (const token of uniqueTokens) {
        this.docFrequencies.set(token, (this.docFrequencies.get(token) ?? 0) + 1)
      }
    }

    this.avgdl = totalLength / n

    // Compute Robertson-Spärck Jones IDF with smoothing
    for (const [token, df] of this.docFrequencies.entries()) {
      const idfScore = Math.log(1 + (n - df + 0.5) / (df + 0.5))
      this.idf.set(token, Math.max(0, idfScore))
    }
  }

  /**
   * Score all documents against a query string.
   */
  score(query: string): BM25Match[] {
    const queryTokens = tokenizeCodeText(query)
    if (queryTokens.length === 0 || this.docs.length === 0) {
      return []
    }

    const matches: BM25Match[] = []

    for (const doc of this.docs) {
      if (doc.length === 0) continue

      // Compute term frequencies in this document
      const tfMap = new Map<string, number>()
      for (const t of doc.tokens) {
        tfMap.set(t, (tfMap.get(t) ?? 0) + 1)
      }

      let score = 0
      for (const q of queryTokens) {
        const tf = tfMap.get(q) ?? 0
        if (tf === 0) continue

        const idfVal = this.idf.get(q) ?? 0
        const numerator = tf * (this.k1 + 1)
        const denominator = tf + this.k1 * (1 - this.b + this.b * (doc.length / (this.avgdl || 1)))

        score += idfVal * (numerator / denominator)
      }

      if (score > 0) {
        matches.push({ file: doc.file, score })
      }
    }

    return matches.sort((a, b) => b.score - a.score)
  }

  /**
   * Get top K scoring documents.
   */
  topK(query: string, k = 5): BM25Match[] {
    return this.score(query).slice(0, k)
  }

  get documentCount(): number {
    return this.docs.length
  }
}

/**
 * Build a BM25 index from an AstIndexer instance.
 * Indexes file paths, symbol names/signatures, and docstrings/comments.
 */
export function buildIndexFromIndexer(
  indexer: AstIndexer,
  fallbackFiles: string[] = [],
): BM25Index {
  const index = new BM25Index()
  const corpus = indexer.getCorpus()

  if (corpus.length > 0) {
    for (const entry of corpus) {
      const parts = [
        entry.filePath,
        ...entry.symbols.map((s) => `${s.name} ${s.signature}`),
        entry.docstrings,
      ]
      index.addDocument(entry.filePath, parts)
    }
  } else if (fallbackFiles.length > 0) {
    for (const file of fallbackFiles) {
      index.addDocument(file, [file])
    }
  }

  index.build()
  return index
}
