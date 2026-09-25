/**
 * SQLite schema for AST symbol cache.
 *
 * Tables:
 * - symbol_files: tracks indexed files, their git blob hashes, language, and docstrings
 * - symbols: the extracted symbol definitions
 * - file_imports: file import dependencies for graph queries
 * - symbol_calls: caller-to-callee invocation edges for graph queries
 *
 * Uses bun:sqlite directly (no Effect/Drizzle) for simplicity and
 * zero-dependency operation.
 */
import { Database } from "bun:sqlite"
import * as path from "path"
import * as fs from "fs"

const SCHEMA_VERSION = 2

const CREATE_TABLES = `
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS symbol_files (
    file_path   TEXT PRIMARY KEY,
    blob_hash   TEXT NOT NULL,
    language    TEXT NOT NULL,
    indexed_at  INTEGER NOT NULL,
    symbol_count INTEGER NOT NULL DEFAULT 0,
    docstrings  TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS symbols (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path   TEXT NOT NULL REFERENCES symbol_files(file_path) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    kind        TEXT NOT NULL,
    signature   TEXT NOT NULL,
    start_line  INTEGER NOT NULL,
    end_line    INTEGER NOT NULL,
    parent_name TEXT
  );

  CREATE TABLE IF NOT EXISTS file_imports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path   TEXT NOT NULL REFERENCES symbol_files(file_path) ON DELETE CASCADE,
    import_path TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS symbol_calls (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path   TEXT NOT NULL REFERENCES symbol_files(file_path) ON DELETE CASCADE,
    caller_name TEXT NOT NULL,
    callee_name TEXT NOT NULL,
    line        INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
  CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);
  CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_path);
  CREATE INDEX IF NOT EXISTS idx_file_imports_file ON file_imports(file_path);
  CREATE INDEX IF NOT EXISTS idx_file_imports_path ON file_imports(import_path);
  CREATE INDEX IF NOT EXISTS idx_symbol_calls_caller ON symbol_calls(caller_name);
  CREATE INDEX IF NOT EXISTS idx_symbol_calls_callee ON symbol_calls(callee_name);
`

export interface SymbolRow {
  id: number
  file_path: string
  name: string
  kind: string
  signature: string
  start_line: number
  end_line: number
  parent_name: string | null
}

export interface SymbolFileRow {
  file_path: string
  blob_hash: string
  language: string
  indexed_at: number
  symbol_count: number
  docstrings?: string
}

export class SymbolDatabase {
  private db: Database

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    this.db = new Database(dbPath, { create: true })
    this.db.run("PRAGMA journal_mode = WAL")
    this.db.run("PRAGMA foreign_keys = ON")
    this.init()
  }

  private init() {
    const versionRow = this.db
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'")
      .get() as { name: string } | null
    if (!versionRow) {
      this.db.exec(CREATE_TABLES)
      this.db.run("INSERT INTO schema_version (version) VALUES (?)", [SCHEMA_VERSION])
      return
    }
    const current = this.db.query("SELECT version FROM schema_version LIMIT 1").get() as
      | { version: number }
      | null
    if (!current || current.version < SCHEMA_VERSION) {
      this.db.exec("DROP TABLE IF EXISTS symbol_calls")
      this.db.exec("DROP TABLE IF EXISTS file_imports")
      this.db.exec("DROP TABLE IF EXISTS symbols")
      this.db.exec("DROP TABLE IF EXISTS symbol_files")
      this.db.exec("DROP TABLE IF EXISTS schema_version")
      this.db.exec(CREATE_TABLES)
      this.db.run("INSERT INTO schema_version (version) VALUES (?)", [SCHEMA_VERSION])
    }
  }

  getFileHash(filePath: string): string | undefined {
    const row = this.db.query("SELECT blob_hash FROM symbol_files WHERE file_path = ?").get(filePath) as
      | { blob_hash: string }
      | null
    return row?.blob_hash
  }

  upsertFile(filePath: string, blobHash: string, language: string, symbolCount: number, docstrings = "") {
    this.db.run(
      `INSERT OR REPLACE INTO symbol_files (file_path, blob_hash, language, indexed_at, symbol_count, docstrings)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [filePath, blobHash, language, Date.now(), symbolCount, docstrings],
    )
  }

  deleteFileData(filePath: string) {
    this.db.run("DELETE FROM symbols WHERE file_path = ?", [filePath])
    this.db.run("DELETE FROM file_imports WHERE file_path = ?", [filePath])
    this.db.run("DELETE FROM symbol_calls WHERE file_path = ?", [filePath])
  }

  deleteFileSymbols(filePath: string) {
    this.deleteFileData(filePath)
  }

  insertSymbols(
    symbols: Array<{
      filePath: string
      name: string
      kind: string
      signature: string
      startLine: number
      endLine: number
      parentName?: string
    }>,
  ) {
    const stmt = this.db.prepare(
      `INSERT INTO symbols (file_path, name, kind, signature, start_line, end_line, parent_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    const tx = this.db.transaction(() => {
      for (const s of symbols) {
        stmt.run(s.filePath, s.name, s.kind, s.signature, s.startLine, s.endLine, s.parentName ?? null)
      }
    })
    tx()
  }

  insertImports(filePath: string, imports: string[]) {
    if (imports.length === 0) return
    const stmt = this.db.prepare("INSERT INTO file_imports (file_path, import_path) VALUES (?, ?)")
    const tx = this.db.transaction(() => {
      for (const imp of imports) {
        stmt.run(filePath, imp)
      }
    })
    tx()
  }

  insertCalls(filePath: string, calls: Array<{ callerName: string; calleeName: string; line: number }>) {
    if (calls.length === 0) return
    const stmt = this.db.prepare(
      "INSERT INTO symbol_calls (file_path, caller_name, callee_name, line) VALUES (?, ?, ?, ?)",
    )
    const tx = this.db.transaction(() => {
      for (const c of calls) {
        stmt.run(filePath, c.callerName, c.calleeName, c.line)
      }
    })
    tx()
  }

  getCallers(symbol: string): Array<{ filePath: string; name: string; line: number }> {
    const rows = this.db
      .query("SELECT file_path, caller_name, line FROM symbol_calls WHERE callee_name = ? ORDER BY file_path, line")
      .all(symbol) as Array<{ file_path: string; caller_name: string; line: number }>
    return rows.map((r) => ({
      filePath: r.file_path,
      name: r.caller_name,
      line: r.line,
    }))
  }

  getCallees(symbol: string): Array<{ filePath: string; name: string; line: number }> {
    const rows = this.db
      .query("SELECT file_path, callee_name, line FROM symbol_calls WHERE caller_name = ? ORDER BY file_path, line")
      .all(symbol) as Array<{ file_path: string; callee_name: string; line: number }>
    return rows.map((r) => ({
      filePath: r.file_path,
      name: r.callee_name,
      line: r.line,
    }))
  }

  getImporters(filePath: string): string[] {
    const rows = this.db
      .query("SELECT DISTINCT file_path, import_path FROM file_imports")
      .all() as Array<{ file_path: string; import_path: string }>

    const targetExt = path.extname(filePath)
    const targetBase = path.basename(filePath, targetExt)
    const targetNoExt = targetExt ? filePath.slice(0, filePath.length - targetExt.length) : filePath

    const importingFiles = new Set<string>()

    for (const r of rows) {
      if (r.file_path === filePath) continue
      const imp = r.import_path
      const impExt = path.extname(imp)
      const impBase = path.basename(imp, impExt)
      const impNoExt = impExt ? imp.slice(0, imp.length - impExt.length) : imp

      if (imp.startsWith("./") || imp.startsWith("../")) {
        const fromDir = path.dirname(r.file_path)
        const resolved = path.normalize(path.join(fromDir, impNoExt))
        if (resolved === targetNoExt || targetNoExt.endsWith(resolved) || resolved.endsWith(targetNoExt)) {
          importingFiles.add(r.file_path)
        }
      } else if (imp.startsWith("@/")) {
        const aliasTarget = impNoExt.slice(2)
        if (targetNoExt.endsWith(aliasTarget) || targetNoExt === `src/${aliasTarget}`) {
          importingFiles.add(r.file_path)
        }
      } else {
        if (impBase === targetBase || targetNoExt.endsWith(impNoExt) || targetNoExt.endsWith(`/${impNoExt}`)) {
          importingFiles.add(r.file_path)
        }
      }
    }

    return Array.from(importingFiles)
  }

  lookupSymbols(query: string, opts?: { kind?: string; directory?: string; limit?: number }): SymbolRow[] {
    const conditions: string[] = []
    const params: unknown[] = []

    if (query.includes("%") || query.includes("_")) {
      conditions.push("s.name LIKE ?")
      params.push(query)
    } else {
      conditions.push("s.name LIKE ?")
      params.push(`%${query}%`)
    }
    if (opts?.kind) {
      conditions.push("s.kind = ?")
      params.push(opts.kind)
    }
    if (opts?.directory) {
      conditions.push("s.file_path LIKE ?")
      params.push(`${opts.directory}%`)
    }

    const limit = opts?.limit ?? 50
    const sql = `SELECT s.* FROM symbols s WHERE ${conditions.join(" AND ")} ORDER BY
      CASE WHEN s.name = ? THEN 0 WHEN s.name LIKE ? THEN 1 ELSE 2 END,
      s.file_path, s.start_line
      LIMIT ?`
    params.push(query, `${query}%`, limit)
    return this.db.query(sql).all(...(params as any[])) as SymbolRow[]
  }

  repoMap(opts?: { directory?: string }): Array<{ file_path: string; language: string; symbols: SymbolRow[] }> {
    const fileCondition = opts?.directory ? "WHERE sf.file_path LIKE ?" : ""
    const fileParams = opts?.directory ? [`${opts.directory}%`] : []
    const files = this.db
      .query(`SELECT * FROM symbol_files sf ${fileCondition} ORDER BY sf.file_path`)
      .all(...fileParams) as SymbolFileRow[]

    return files.map((file) => ({
      file_path: file.file_path,
      language: file.language,
      symbols: this.db
        .query("SELECT * FROM symbols WHERE file_path = ? ORDER BY start_line")
        .all(file.file_path) as SymbolRow[],
    }))
  }

  getAllCorpusEntries(): Array<{
    filePath: string
    symbols: SymbolRow[]
    docstrings: string
  }> {
    const files = this.db.query("SELECT file_path, docstrings FROM symbol_files").all() as Array<{
      file_path: string
      docstrings: string | null
    }>
    return files.map((f) => ({
      filePath: f.file_path,
      docstrings: f.docstrings ?? "",
      symbols: this.db
        .query("SELECT * FROM symbols WHERE file_path = ? ORDER BY start_line")
        .all(f.file_path) as SymbolRow[],
    }))
  }

  removeStaleFiles(currentFiles: Set<string>) {
    const indexed = this.db.query("SELECT file_path FROM symbol_files").all() as Array<{ file_path: string }>
    const stale = indexed.filter((row) => !currentFiles.has(row.file_path))
    if (stale.length === 0) return
    const tx = this.db.transaction(() => {
      for (const row of stale) {
        this.db.run("DELETE FROM symbols WHERE file_path = ?", [row.file_path])
        this.db.run("DELETE FROM file_imports WHERE file_path = ?", [row.file_path])
        this.db.run("DELETE FROM symbol_calls WHERE file_path = ?", [row.file_path])
        this.db.run("DELETE FROM symbol_files WHERE file_path = ?", [row.file_path])
      }
    })
    tx()
  }

  stats(): { files: number; symbols: number } {
    const files = (this.db.query("SELECT COUNT(*) as count FROM symbol_files").get() as { count: number }).count
    const symbols = (this.db.query("SELECT COUNT(*) as count FROM symbols").get() as { count: number }).count
    return { files, symbols }
  }

  close() {
    this.db.close()
  }
}
