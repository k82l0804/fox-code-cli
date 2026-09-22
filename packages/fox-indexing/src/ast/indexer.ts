/**
 * Core AST indexing engine.
 *
 * Manages the lifecycle of the symbol cache:
 * - Scans the project using `git ls-files -s` to get file hashes
 * - Compares hashes against the SQLite symbol cache
 * - Parses only changed files using Tree-sitter WASM grammars
 * - Provides query APIs for `lookup_symbols` and `fetch_repo_map` tools
 *
 * Enabled by default — no external dependencies required.
 * Per-project DBs stored at `~/.local/state/fox/ast-cache/<project-hash>.db`
 */
import * as path from "path"
import * as crypto from "crypto"
import { execSync } from "child_process"
import { SymbolDatabase, type SymbolRow } from "./schema"
import { languageForExtension, createParser, supportedExtensions } from "./grammars"
import { extractSymbols, type ExtractedSymbol } from "./extractor"


export interface ScanResult {
  total: number
  indexed: number
  skipped: number
  errors: number
  durationMs: number
}

export interface SymbolResult {
  filePath: string
  name: string
  kind: string
  signature: string
  line: number
  endLine: number
  parentName?: string
}

export interface RepoMapEntry {
  filePath: string
  language: string
  symbols: Array<{
    name: string
    kind: string
    signature: string
    line: number
  }>
}

/** Hash a project directory to create a unique, stable DB filename. */
function projectHash(directory: string): string {
  return crypto.createHash("sha256").update(directory).digest("hex").slice(0, 16)
}

/** Get the AST cache DB path for a project. */
function dbPath(stateDir: string, projectDir: string): string {
  return path.join(stateDir, "ast-cache", `${projectHash(projectDir)}.db`)
}

/** Parse `git ls-files -s` output to get file paths and their blob hashes. */
function gitListFiles(directory: string): Array<{ filePath: string; blobHash: string }> {
  try {
    const output = execSync("GIT_TERMINAL_PROMPT=0 git ls-files -s", {
      cwd: directory,
      encoding: "utf-8",
      timeout: 10_000,
      maxBuffer: 50 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    })
    const result: Array<{ filePath: string; blobHash: string }> = []
    for (const line of output.split("\n")) {
      if (!line) continue
      // Format: <mode> <hash> <stage>\t<path>
      const tabIdx = line.indexOf("\t")
      if (tabIdx === -1) continue
      const filePath = line.slice(tabIdx + 1)
      const parts = line.slice(0, tabIdx).split(" ")
      const blobHash = parts[1]
      if (blobHash && filePath) {
        result.push({ filePath, blobHash })
      }
    }
    return result
  } catch {
    return []
  }
}

/** Per-language parser cache — one parser instance per language. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parsers = new Map<string, any>()

async function getParser(language: string): Promise<any> {
  if (parsers.has(language)) {
    const cached = parsers.get(language)
    return cached ?? undefined
  }
  try {
    const parser = await createParser(language)
    parsers.set(language, parser ?? null)
    return parser ?? undefined
  } catch {
    parsers.set(language, null)
    return undefined
  }
}

export class AstIndexer {
  private db: SymbolDatabase
  private directory: string
  private scanning = false
  private scanPromise: Promise<ScanResult> | null = null

  private constructor(db: SymbolDatabase, directory: string) {
    this.db = db
    this.directory = directory
  }

  static create(directory: string, stateDir: string): AstIndexer {
    const db = new SymbolDatabase(dbPath(stateDir, directory))
    return new AstIndexer(db, directory)
  }

  /** Whether a scan is currently in progress. */
  get isScanning(): boolean {
    return this.scanning
  }

  /** Get index stats. */
  stats(): { files: number; symbols: number } {
    return this.db.stats()
  }

  /**
   * Scan the project, indexing only changed files.
   * Returns immediately if a scan is already in progress.
   */
  async scan(): Promise<ScanResult> {
    if (this.scanPromise) return this.scanPromise
    this.scanning = true
    this.scanPromise = this.doScan()
    try {
      return await this.scanPromise
    } finally {
      this.scanning = false
      this.scanPromise = null
    }
  }

  private async doScan(): Promise<ScanResult> {
    const start = Date.now()
    const files = gitListFiles(this.directory)
    const supported = new Set(supportedExtensions())
    let indexed = 0
    let skipped = 0
    let errors = 0

    // Filter to supported file extensions
    const indexable = files.filter((f) => {
      const ext = path.extname(f.filePath)
      return supported.has(ext)
    })

    // Track current files for stale cleanup
    const currentFiles = new Set(indexable.map((f) => f.filePath))
    this.db.removeStaleFiles(currentFiles)

    for (const file of indexable) {
      const existingHash = this.db.getFileHash(file.filePath)
      if (existingHash === file.blobHash) {
        skipped++
        continue
      }

      const ext = path.extname(file.filePath)
      const language = languageForExtension(ext)
      if (!language) {
        skipped++
        continue
      }

      try {
        const parser = await getParser(language)
        if (!parser) {
          skipped++
          continue
        }

        const fullPath = path.join(this.directory, file.filePath)
        let content: string
        try {
          content = await Bun.file(fullPath).text()
        } catch {
          // File might have been deleted since git ls-files
          skipped++
          continue
        }

        const tree = parser.parse(content)
        const symbols = extractSymbols(tree, language)
        tree.delete()

        // Update the database atomically
        this.db.deleteFileSymbols(file.filePath)
        this.db.upsertFile(file.filePath, file.blobHash, language, symbols.length)
        if (symbols.length > 0) {
          this.db.insertSymbols(
            symbols.map((s) => ({
              filePath: file.filePath,
              name: s.name,
              kind: s.kind,
              signature: s.signature,
              startLine: s.startLine,
              endLine: s.endLine,
              parentName: s.parentName,
            })),
          )
        }
        indexed++
      } catch {
        errors++
      }
    }

    return {
      total: indexable.length,
      indexed,
      skipped,
      errors,
      durationMs: Date.now() - start,
    }
  }

  /**
   * Look up symbols by name pattern.
   * Supports exact match, prefix match, and substring match.
   */
  lookupSymbols(
    query: string,
    opts?: { kind?: string; directory?: string; limit?: number },
  ): SymbolResult[] {
    const rows = this.db.lookupSymbols(query, opts)
    return rows.map(rowToResult)
  }

  /**
   * Generate a hierarchical repo map showing file→symbol structure.
   */
  repoMap(opts?: { directory?: string; depth?: number }): string {
    const entries = this.db.repoMap({ directory: opts?.directory })
    if (entries.length === 0) {
      return "No indexed files found." + (this.scanning ? " Index scan is in progress." : "")
    }

    const depth = opts?.depth ?? 3
    const lines: string[] = []

    for (const entry of entries) {
      // Apply depth filter
      const segments = entry.file_path.split("/")
      if (segments.length > depth + 1) continue

      if (entry.symbols.length === 0) {
        lines.push(`📄 ${entry.file_path}`)
        continue
      }

      lines.push(`📄 ${entry.file_path} (${entry.language})`)
      for (const sym of entry.symbols) {
        const indent = sym.parent_name ? "    " : "  "
        const kindIcon = kindToIcon(sym.kind)
        const parent = sym.parent_name ? ` [${sym.parent_name}]` : ""
        lines.push(`${indent}${kindIcon} ${sym.name}${parent} L${sym.start_line}`)
      }
    }

    return lines.join("\n")
  }

  dispose() {
    this.db.close()
  }
}

function rowToResult(row: SymbolRow): SymbolResult {
  return {
    filePath: row.file_path,
    name: row.name,
    kind: row.kind,
    signature: row.signature,
    line: row.start_line,
    endLine: row.end_line,
    parentName: row.parent_name ?? undefined,
  }
}

function kindToIcon(kind: string): string {
  switch (kind) {
    case "function":
      return "ƒ"
    case "class":
      return "◆"
    case "interface":
      return "◇"
    case "type":
      return "τ"
    case "method":
      return "→"
    case "export":
      return "⬡"
    case "variable":
      return "•"
    default:
      return "·"
  }
}
