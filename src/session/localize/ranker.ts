/**
 * RRF Fusion & Function-Level Span Ranking
 *
 * Combines BM25 text relevance and Graph Centrality via Reciprocal Rank Fusion (RRF).
 * Extracts function/class-level spans from the top-K files using the AST index.
 */
import type { AstIndexer } from "@foxcode/indexing/ast/indexer"
import { tokenizeCodeText } from "./bm25"

export interface RankedFile {
  file: string
  rrfScore: number
  bm25Score: number
  centralityScore: number
}

export interface LocalizedSpan {
  file: string
  spanStart: number
  spanEnd: number
  score: number
  reason: string
}

/**
 * Fuse BM25 text scores and Graph Centrality scores using Reciprocal Rank Fusion.
 *
 * RRF(d) = sum(1 / (k + rank_i(d)))
 * Default k = 60 (standard IR constant).
 */
export function fuseRRF(
  bm25Matches: Array<{ file: string; score: number }>,
  centralityScores: Map<string, number>,
  k = 60,
): RankedFile[] {
  // Map of file -> BM25 rank (1-indexed) and raw score
  const bm25Ranks = new Map<string, { rank: number; score: number }>()
  bm25Matches
    .slice()
    .sort((a, b) => b.score - a.score)
    .forEach((match, idx) => {
      bm25Ranks.set(match.file, { rank: idx + 1, score: match.score })
    })

  // Map of file -> Centrality rank (1-indexed) and raw score
  const centralityRanks = new Map<string, { rank: number; score: number }>()
  Array.from(centralityScores.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([file, score], idx) => {
      centralityRanks.set(file, { rank: idx + 1, score })
    })

  // Collect all unique files from both signals
  const allFiles = new Set([...bm25Ranks.keys(), ...centralityRanks.keys()])
  const ranked: RankedFile[] = []

  for (const file of allFiles) {
    const b = bm25Ranks.get(file)
    const c = centralityRanks.get(file)

    const rrfBm25 = b ? 1 / (k + b.rank) : 0
    const rrfCentrality = c ? 1 / (k + c.rank) : 0

    const rrfScore = rrfBm25 + rrfCentrality
    ranked.push({
      file,
      rrfScore,
      bm25Score: b?.score ?? 0,
      centralityScore: c?.score ?? 0,
    })
  }

  return ranked.sort((a, b) => b.rrfScore - a.rrfScore)
}

/**
 * Extract AST function/class-level spans for the top ranked files.
 */
export function extractSpansForFiles(
  rankedFiles: RankedFile[],
  indexer: AstIndexer,
  task: string,
  maxSpans = 5,
): LocalizedSpan[] {
  const queryTokens = new Set(tokenizeCodeText(task))
  const spans: LocalizedSpan[] = []

  for (const ranked of rankedFiles) {
    if (spans.length >= maxSpans) break

    // Retrieve symbols for this file from the indexer
    const symbols = indexer.database
      ? indexer.database.lookupSymbols("", { directory: ranked.file, limit: 100 })
      : []

    // Filter to symbols in this exact file
    const fileSymbols = symbols.filter((s) => s.file_path === ranked.file)

    if (fileSymbols.length > 0) {
      // Score each symbol by keyword overlap with task
      let bestSymbol = fileSymbols[0]
      let bestScore = -1
      let bestMatches: string[] = []

      for (const sym of fileSymbols) {
        const symTokens = tokenizeCodeText(`${sym.name} ${sym.signature}`)
        const matched = symTokens.filter((t) => queryTokens.has(t))
        const score = matched.length

        if (score > bestScore) {
          bestScore = score
          bestSymbol = sym
          bestMatches = matched
        }
      }

      const reason =
        bestMatches.length > 0
          ? `Symbol '${bestSymbol.name}' (${bestSymbol.kind}) matched [${bestMatches.join(", ")}]`
          : `High centrality (${ranked.centralityScore.toFixed(2)}) + text match (${ranked.bm25Score.toFixed(2)})`

      spans.push({
        file: ranked.file,
        spanStart: bestSymbol.start_line,
        spanEnd: Math.max(bestSymbol.end_line, bestSymbol.start_line),
        score: ranked.rrfScore,
        reason,
      })
    } else {
      // Fallback span if file has no symbols indexed
      spans.push({
        file: ranked.file,
        spanStart: 1,
        spanEnd: 50,
        score: ranked.rrfScore,
        reason: `RRF match (score: ${ranked.rrfScore.toFixed(4)})`,
      })
    }
  }

  return spans
}
