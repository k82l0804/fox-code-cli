/**
 * Symbol & Import Graph Queries
 *
 * Provides graph operations over the AST index:
 * - Callers/callees per symbol
 * - Importers per file
 * - Import graph construction & PageRank centrality
 */
import type { AstIndexer } from "@foxcode/indexing/ast/indexer"

export interface CallerInfo {
  filePath: string
  name: string
  line: number
}

export interface CalleeInfo {
  filePath: string
  name: string
  line: number
}

/**
 * Find callers of a given symbol across all indexed files.
 */
export function getCallers(indexer: AstIndexer, symbol: string): CallerInfo[] {
  return indexer.callers(symbol)
}

/**
 * Find callees called by a given symbol across all indexed files.
 */
export function getCallees(indexer: AstIndexer, symbol: string): CalleeInfo[] {
  return indexer.callees(symbol)
}

/**
 * Find files that import the target file.
 */
export function getImporters(indexer: AstIndexer, filePath: string): string[] {
  return indexer.importers(filePath)
}

/**
 * Construct an import graph mapping each file to the files it imports.
 */
export function computeImportGraph(files: string[], indexer: AstIndexer): Map<string, string[]> {
  const graph = new Map<string, string[]>()
  for (const file of files) {
    graph.set(file, [])
  }

  for (const targetFile of files) {
    const importers = indexer.importers(targetFile)
    for (const importer of importers) {
      if (graph.has(importer)) {
        graph.get(importer)!.push(targetFile)
      }
    }
  }

  return graph
}

/**
 * Compute PageRank scores on the import graph.
 * Higher score indicates files that are central dependencies of the project.
 */
export function computePageRank(
  graph: Map<string, string[]>,
  damping = 0.85,
  iterations = 20,
): Map<string, number> {
  const nodes = Array.from(graph.keys())
  const n = nodes.length
  if (n === 0) return new Map()

  const ranks = new Map<string, number>()
  const initialRank = 1 / n
  for (const node of nodes) {
    ranks.set(node, initialRank)
  }

  // Pre-calculate out-degrees and reverse edges (in-edges: who links to node)
  const inEdges = new Map<string, string[]>()
  const outDegree = new Map<string, number>()

  for (const node of nodes) {
    inEdges.set(node, [])
    outDegree.set(node, (graph.get(node) ?? []).length)
  }

  for (const [source, targets] of graph.entries()) {
    for (const target of targets) {
      if (inEdges.has(target)) {
        inEdges.get(target)!.push(source)
      }
    }
  }

  const baseRank = (1 - damping) / n

  for (let iter = 0; iter < iterations; iter++) {
    const newRanks = new Map<string, number>()

    // Account for dangling nodes (out-degree 0)
    let danglingSum = 0
    for (const node of nodes) {
      if (outDegree.get(node) === 0) {
        danglingSum += ranks.get(node)!
      }
    }

    const danglingContribution = (damping * danglingSum) / n

    for (const node of nodes) {
      let incomingRankSum = 0
      const predecessors = inEdges.get(node) ?? []
      for (const pred of predecessors) {
        const outDeg = outDegree.get(pred) ?? 1
        if (outDeg > 0) {
          incomingRankSum += ranks.get(pred)! / outDeg
        }
      }

      newRanks.set(node, baseRank + danglingContribution + damping * incomingRankSum)
    }

    // Update ranks
    for (const [node, r] of newRanks.entries()) {
      ranks.set(node, r)
    }
  }

  return ranks
}

/**
 * Score file centrality combining PageRank and symbol call counts.
 */
export function scoreFileCentrality(
  file: string,
  indexer: AstIndexer,
  pageRanks?: Map<string, number>,
): number {
  const pr = pageRanks?.get(file) ?? 0.01

  // Count incoming imports
  const importers = indexer.importers(file)
  const importWeight = importers.length * 0.1

  return pr + importWeight
}
