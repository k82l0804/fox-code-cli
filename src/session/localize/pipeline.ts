/**
 * Localization Pipeline Orchestrator (Phase 2E Task 2E-3)
 *
 * Coordinates BM25 text scoring, symbol/import graph centrality, and RRF fusion
 * to locate the most relevant code spans for a task before the LLM generates its first completion.
 */
import { execSync } from "child_process"
import type { AstIndexer } from "@foxcode/indexing/ast/indexer"
import { isCodeChangeTask } from "../control-plane"
import { buildIndexFromIndexer } from "./bm25"
import { computeImportGraph, computePageRank, scoreFileCentrality } from "./graph"
import { fuseRRF, extractSpansForFiles, type LocalizedSpan } from "./ranker"

export interface LocalizeResult {
  spans: LocalizedSpan[]
  partial: boolean
}

function gitListFiles(projectDir: string): string[] {
  try {
    const out = execSync("GIT_TERMINAL_PROMPT=0 git ls-files", {
      cwd: projectDir,
      encoding: "utf-8",
      timeout: 5_000,
      stdio: ["ignore", "pipe", "ignore"],
    })
    return out.split("\n").map((f) => f.trim()).filter(Boolean)
  } catch {
    return []
  }
}

/**
 * Localize relevant code spans for a task.
 *
 * 1. Checks if the task is a code-change task. Non-code-change tasks return empty immediately.
 * 2. Checks index warmth. If cold, kicks off background scanning and returns best-effort matches marked partial.
 * 3. Runs BM25 retrieval over identifiers and docstrings.
 * 4. Computes graph centrality over the import and symbol graph.
 * 5. Fuses rankings using RRF and extracts function/class spans.
 */
export function localize(task: string, indexer: AstIndexer, projectDir: string): LocalizeResult {
  // Only run on code-change tasks
  if (!isCodeChangeTask(task, true, true)) {
    return { spans: [], partial: false }
  }

  const stats = indexer.stats()
  const isCold = stats.files === 0

  // Cold-index: kick off background scan without blocking current turn
  if (isCold && !indexer.isScanning) {
    try {
      void indexer.scan().catch(() => {})
    } catch {
      // Background scan start error ignored
    }
  }

  // Get files either from warm index or git fallback
  const corpus = indexer.getCorpus()
  const fallbackFiles = isCold ? gitListFiles(projectDir) : []
  const allFiles = corpus.length > 0 ? corpus.map((c) => c.filePath) : fallbackFiles

  if (allFiles.length === 0) {
    return { spans: [], partial: isCold }
  }

  // 1. BM25 text scoring over identifiers + docstrings
  const bm25Index = buildIndexFromIndexer(indexer, fallbackFiles)
  const bm25Matches = bm25Index.score(task)

  // 2. Graph centrality scoring
  const importGraph = computeImportGraph(allFiles, indexer)
  const pageRanks = computePageRank(importGraph)
  const centralityScores = new Map<string, number>()

  for (const file of allFiles) {
    centralityScores.set(file, scoreFileCentrality(file, indexer, pageRanks))
  }

  // 3. RRF fusion
  const ranked = fuseRRF(bm25Matches, centralityScores)

  // 4. Function-level span extraction for top files (top 5)
  const spans = extractSpansForFiles(ranked, indexer, task, 5)

  return {
    spans,
    partial: isCold || indexer.isScanning,
  }
}
