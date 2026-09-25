import path from "path"
import { languageForExtension, createParser } from "@foxcode/indexing/ast/grammars"

export interface SyntaxCheckResult {
  readonly count: number
  readonly summary: string
  readonly supported: boolean
  readonly errorLines: number[]
}

const parserCache = new Map<string, any>()

async function getOrInitParser(language: string): Promise<any> {
  if (parserCache.has(language)) {
    return parserCache.get(language) ?? undefined
  }
  try {
    const parser = await createParser(language)
    parserCache.set(language, parser ?? null)
    return parser ?? undefined
  } catch {
    parserCache.set(language, null)
    return undefined
  }
}

/**
 * Checks content for syntax errors using Tree-sitter.
 * Fails open (returns count: 0, supported: false) if language grammar is unavailable.
 */
export async function syntaxCheck(content: string, filePath: string): Promise<SyntaxCheckResult> {
  const ext = path.extname(filePath).toLowerCase()
  const language = languageForExtension(ext)
  if (!language) {
    return { count: 0, summary: "", supported: false, errorLines: [] }
  }

  const parser = await getOrInitParser(language)
  if (!parser) {
    return { count: 0, summary: "", supported: false, errorLines: [] }
  }

  try {
    const tree = parser.parse(content)
    if (!tree.rootNode.hasError) {
      return { count: 0, summary: "", supported: true, errorLines: [] }
    }

    let count = 0
    const errorLines: number[] = []
    function walk(node: any) {
      if (node.type === "ERROR" || Boolean(node.isMissing)) {
        count++
        errorLines.push(node.startPosition.row + 1)
      }
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i)
        if (child) walk(child)
      }
    }
    walk(tree.rootNode)

    const uniqueLines = [...new Set(errorLines)].sort((a, b) => a - b)
    const summary = `Syntax error(s) at line(s): ${uniqueLines.join(", ")}`
    return { count, summary, supported: true, errorLines: uniqueLines }
  } catch {
    // Fail open if parsing throws unexpectedly
    return { count: 0, summary: "", supported: false, errorLines: [] }
  }
}
