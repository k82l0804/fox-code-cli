/**
 * Language extension → Tree-sitter WASM grammar mapping.
 *
 * Lazily loads WASM grammars from the tree-sitter-wasms package.
 * Only loads grammars for languages actually present in the project.
 */
import { Language } from "web-tree-sitter"
import { fileURLToPath } from "url"

const resolveWasm = (asset: string) => {
  if (asset.startsWith("file://")) return fileURLToPath(asset)
  if (asset.startsWith("/") || /^[a-z]:/i.test(asset)) return asset
  const url = new URL(asset, import.meta.url)
  return fileURLToPath(url)
}

const EXTENSION_TO_GRAMMAR: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".hpp": "cpp",
  ".hh": "cpp",
  ".rb": "ruby",
  ".php": "php",
  ".cs": "c_sharp",
  ".swift": "swift",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".lua": "lua",
  ".zig": "zig",
  ".scala": "scala",
  ".dart": "dart",
  ".ex": "elixir",
  ".exs": "elixir",
  ".elm": "elm",
  ".ml": "ocaml",
  ".mli": "ocaml",
}

const grammarCache = new Map<string, Language>()
let parserInitialized = false

async function ensureParserInit() {
  if (parserInitialized) return
  const { Parser } = await import("web-tree-sitter")
  const { default: treeWasm } = await import("web-tree-sitter/tree-sitter.wasm" as string, {
    with: { type: "wasm" },
  })
  const treePath = resolveWasm(treeWasm)
  await Parser.init({ locateFile: () => treePath })
  parserInitialized = true
}

export function languageForExtension(ext: string): string | undefined {
  return EXTENSION_TO_GRAMMAR[ext]
}

export function supportedExtensions(): string[] {
  return Object.keys(EXTENSION_TO_GRAMMAR)
}

export async function loadGrammar(languageName: string): Promise<Language | undefined> {
  const cached = grammarCache.get(languageName)
  if (cached) return cached

  await ensureParserInit()

  try {
    const { default: wasm } = await import(
      `tree-sitter-wasms/out/tree-sitter-${languageName}.wasm` as string,
      { with: { type: "wasm" } }
    )
    const wasmPath = resolveWasm(wasm)
    const language = await Language.load(wasmPath)
    grammarCache.set(languageName, language)
    return language
  } catch {
    return undefined
  }
}

export async function createParser(languageName: string) {
  const language = await loadGrammar(languageName)
  if (!language) return undefined
  const { Parser } = await import("web-tree-sitter")
  const parser = new Parser()
  parser.setLanguage(language)
  return parser
}
