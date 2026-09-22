/**
 * SQLite schema for AST symbol cache.
 *
 * Two tables:
 * - symbol_files: tracks indexed files and their git blob hashes
 * - symbols: the extracted symbol definitions
 *
 * Uses bun:sqlite directly (no Effect/Drizzle) for simplicity and
 * zero-dependency operation.
 */
import { Database } from "bun:sqlite"
import * as path from "path"
import * as fs from "fs"

const SCHEMA_VERSION = 1

const CREATE_TABLES = `
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS symbol_files (
    file_path   TEXT PRIMARY KEY,
    blob_hash   TEXT NOT NULL,
    language    TEXT NOT NULL,
    indexed_at  INTEGER NOT NULL,
    symbol_count INTEGER NOT NULL DEFAULT 0
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

  CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
  CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);
  CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_path);
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

  upsertFile(filePath: string, blobHash: string, language: string, symbolCount: number) {
    this.db.run(
      `INSERT OR REPLACE INTO symbol_files (file_path, blob_hash, language, indexed_at, symbol_count)
       VALUES (?, ?, ?, ?, ?)`,
      [filePath, blobHash, language, Date.now(), symbolCount],
    )
  }

  deleteFileSymbols(filePath: string) {
    this.db.run("DELETE FROM symbols WHERE file_path = ?", [filePath])
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

  removeStaleFiles(currentFiles: Set<string>) {
    const indexed = this.db.query("SELECT file_path FROM symbol_files").all() as Array<{ file_path: string }>
    const stale = indexed.filter((row) => !currentFiles.has(row.file_path))
    if (stale.length === 0) return
    const tx = this.db.transaction(() => {
      for (const row of stale) {
        this.db.run("DELETE FROM symbols WHERE file_path = ?", [row.file_path])
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
