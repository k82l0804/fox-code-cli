/**
 * Language-specific symbol extraction from Tree-sitter ASTs.
 *
 * Walks the parsed tree to find top-level symbols (functions, classes,
 * interfaces, types, exports) and class-level methods. Returns a flat
 * list of Symbol records for storage in the SQLite cache.
 */
import type { Tree, Node } from "web-tree-sitter"
type SyntaxNode = Node

/** Filter nulls from namedChildren since web-tree-sitter types them as (Node | null)[]. */
function children(node: SyntaxNode | null | undefined): SyntaxNode[] {
  if (!node) return []
  return (node.namedChildren as (Node | null)[]).filter((c): c is Node => c !== null)
}

export interface ExtractedSymbol {
  name: string
  kind: "function" | "class" | "interface" | "type" | "method" | "export" | "variable"
  signature: string
  startLine: number
  endLine: number
  parentName?: string
}

/** Truncate a signature to a single readable line. */
function oneLine(node: SyntaxNode, maxLen = 120): string {
  // Take the first line of the node text, trim, and cap length
  const text = node.text.split("\n")[0].trim()
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text
}

function nameOf(node: SyntaxNode): string {
  return (
    node.childForFieldName("name")?.text ??
    node.childForFieldName("declarator")?.childForFieldName("name")?.text ??
    ""
  )
}

// ─── TypeScript / JavaScript ─────────────────────────────────────────
const TS_TOP_LEVEL: Record<string, ExtractedSymbol["kind"]> = {
  function_declaration: "function",
  generator_function_declaration: "function",
  class_declaration: "class",
  interface_declaration: "interface",
  type_alias_declaration: "type",
  enum_declaration: "type",
  lexical_declaration: "variable",
  variable_declaration: "variable",
  export_statement: "export",
}

function extractTS(tree: Tree): ExtractedSymbol[] {
  const symbols: ExtractedSymbol[] = []

  function visitTopLevel(node: SyntaxNode) {
    const kind = TS_TOP_LEVEL[node.type]
    if (kind) {
      if (kind === "export") {
        // Unwrap export_statement to get the inner declaration
        const inner = children(node).find((c: SyntaxNode) => TS_TOP_LEVEL[c.type])
        if (inner) {
          const innerKind = TS_TOP_LEVEL[inner.type]!
          const name = nameOf(inner)
          if (name && innerKind !== "export") {
            symbols.push({
              name,
              kind: innerKind,
              signature: oneLine(inner),
              startLine: inner.startPosition.row + 1,
              endLine: inner.endPosition.row + 1,
            })
            if (innerKind === "class" || innerKind === "interface") {
              extractMembers(inner, name, symbols)
            }
            return
          }
        }
        // Named export of variables: export const foo = ...
        const decl = children(node).find(
          (c: SyntaxNode) => c.type === "lexical_declaration" || c.type === "variable_declaration",
        )
        if (decl) {
          for (const declarator of children(decl)) {
            if (declarator.type === "variable_declarator") {
              const name = declarator.childForFieldName("name")?.text
              if (name) {
                symbols.push({
                  name,
                  kind: "variable",
                  signature: `export ${oneLine(decl)}`,
                  startLine: decl.startPosition.row + 1,
                  endLine: decl.endPosition.row + 1,
                })
              }
            }
          }
          return
        }
        return
      }

      if (kind === "variable") {
        // Extract individual variable declarators
        for (const declarator of children(node)) {
          if (declarator.type === "variable_declarator") {
            const name = declarator.childForFieldName("name")?.text
            if (name) {
              symbols.push({
                name,
                kind: "variable",
                signature: oneLine(node),
                startLine: node.startPosition.row + 1,
                endLine: node.endPosition.row + 1,
              })
            }
          }
        }
        return
      }

      const name = nameOf(node)
      if (name) {
        symbols.push({
          name,
          kind,
          signature: oneLine(node),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
        })
        if (kind === "class" || kind === "interface") {
          extractMembers(node, name, symbols)
        }
      }
      return
    }
    // Recurse into program-level namespaces/modules
    if (node.type === "program" || node.type === "module") {
      for (const child of children(node)) {
        visitTopLevel(child)
      }
    }
  }

  function extractMembers(classNode: SyntaxNode, className: string, out: ExtractedSymbol[]) {
    const body =
      classNode.childForFieldName("body") ??
      children(classNode).find((c: SyntaxNode) => c.type === "class_body" || c.type === "object_type" || c.type === "interface_body")
    if (!body) return
    for (const member of children(body)) {
      if (
        member.type === "method_definition" ||
        member.type === "method_signature" ||
        member.type === "public_field_definition" ||
        member.type === "property_signature" ||
        member.type === "abstract_method_signature"
      ) {
        const name = nameOf(member)
        if (name) {
          out.push({
            name,
            kind: "method",
            signature: oneLine(member),
            startLine: member.startPosition.row + 1,
            endLine: member.endPosition.row + 1,
            parentName: className,
          })
        }
      }
    }
  }

  for (const child of children(tree.rootNode)) {
    visitTopLevel(child)
  }
  return symbols
}

// ─── Python ──────────────────────────────────────────────────────────
function extractPython(tree: Tree): ExtractedSymbol[] {
  const symbols: ExtractedSymbol[] = []

  function visit(node: SyntaxNode, parent?: string) {
    if (node.type === "function_definition" || node.type === "async_function_definition") {
      const name = nameOf(node)
      if (name) {
        symbols.push({
          name,
          kind: parent ? "method" : "function",
          signature: oneLine(node),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          parentName: parent,
        })
      }
      return
    }
    if (node.type === "class_definition") {
      const name = nameOf(node)
      if (name) {
        symbols.push({
          name,
          kind: "class",
          signature: oneLine(node),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
        })
        // Extract methods
        const body = node.childForFieldName("body")
        if (body) {
          for (const child of children(body)) {
            visit(child, name)
          }
        }
      }
      return
    }
    // Top-level assignments as variables
    if (!parent && (node.type === "expression_statement" || node.type === "assignment")) {
      const assignment = node.type === "assignment" ? node : children(node).find((c) => c.type === "assignment")
      if (assignment) {
        const left = assignment.childForFieldName("left")
        if (left?.type === "identifier") {
          symbols.push({
            name: left.text,
            kind: "variable",
            signature: oneLine(assignment),
            startLine: assignment.startPosition.row + 1,
            endLine: assignment.endPosition.row + 1,
          })
        }
      }
      return
    }
    // Only recurse at module level (not into function bodies)
    if (!parent) {
      for (const child of children(node)) {
        visit(child)
      }
    }
  }

  for (const child of children(tree.rootNode)) {
    visit(child)
  }
  return symbols
}

// ─── Go ──────────────────────────────────────────────────────────────
function extractGo(tree: Tree): ExtractedSymbol[] {
  const symbols: ExtractedSymbol[] = []
  const goChildren = children(tree.rootNode)

  for (const child of goChildren) {
    if (!child) continue
    if (child.type === "function_declaration") {
      const name = nameOf(child)
      if (name) {
        symbols.push({
          name,
          kind: "function",
          signature: oneLine(child),
          startLine: child.startPosition.row + 1,
          endLine: child.endPosition.row + 1,
        })
      }
    } else if (child.type === "method_declaration") {
      const name = nameOf(child)
      const receiver = child.childForFieldName("receiver")
      const paramDecl = receiver ? children(receiver).find((c: SyntaxNode) => c.type === "parameter_declaration") : undefined
      const parentName = paramDecl?.childForFieldName("type")?.text?.replace("*", "")
      if (name) {
        symbols.push({
          name,
          kind: "method",
          signature: oneLine(child),
          startLine: child.startPosition.row + 1,
          endLine: child.endPosition.row + 1,
          parentName,
        })
      }
    } else if (child.type === "type_declaration") {
      const specs = children(child)
      for (const spec of specs) {
        if (!spec || spec.type !== "type_spec") continue
        const name = nameOf(spec)
        const typeNode = spec.childForFieldName("type")
        const kind: ExtractedSymbol["kind"] = typeNode?.type === "struct_type" ? "class" : typeNode?.type === "interface_type" ? "interface" : "type"
        if (name) {
          symbols.push({
            name,
            kind,
            signature: oneLine(spec),
            startLine: spec.startPosition.row + 1,
            endLine: spec.endPosition.row + 1,
          })
        }
      }
    }
  }
  return symbols
}

// ─── Rust ────────────────────────────────────────────────────────────
function extractRust(tree: Tree): ExtractedSymbol[] {
  const symbols: ExtractedSymbol[] = []

  function visit(node: SyntaxNode, parent?: string) {
    const type = node.type
    if (type === "function_item") {
      const name = nameOf(node)
      if (name) {
        symbols.push({
          name,
          kind: parent ? "method" : "function",
          signature: oneLine(node),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          parentName: parent,
        })
      }
    } else if (type === "struct_item" || type === "enum_item") {
      const name = nameOf(node)
      if (name) {
        symbols.push({
          name,
          kind: "class",
          signature: oneLine(node),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
        })
      }
    } else if (type === "trait_item") {
      const name = nameOf(node)
      if (name) {
        symbols.push({
          name,
          kind: "interface",
          signature: oneLine(node),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
        })
      }
    } else if (type === "type_item") {
      const name = nameOf(node)
      if (name) {
        symbols.push({
          name,
          kind: "type",
          signature: oneLine(node),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
        })
      }
    } else if (type === "impl_item") {
      const implType = node.childForFieldName("type")?.text
      const body = node.childForFieldName("body")
      if (body && implType) {
        for (const child of children(body)) {
          visit(child, implType)
        }
      }
      return
    }

    // Recurse at module level only
    if (!parent && (type === "source_file" || type === "mod_item")) {
      for (const child of children(node)) {
        visit(child)
      }
    }
  }

  for (const child of children(tree.rootNode)) {
    visit(child)
  }
  return symbols
}

// ─── Generic fallback (C-family and others) ──────────────────────────
function extractGeneric(tree: Tree): ExtractedSymbol[] {
  const symbols: ExtractedSymbol[] = []
  const FUNCTION_TYPES = new Set([
    "function_definition",
    "function_declaration",
    "method_declaration",
    "method_definition",
    "constructor_declaration",
  ])
  const CLASS_TYPES = new Set([
    "class_declaration",
    "class_definition",
    "struct_specifier",
    "struct_declaration",
    "interface_declaration",
  ])

  function visit(node: SyntaxNode, parent?: string) {
    if (FUNCTION_TYPES.has(node.type)) {
      const name = nameOf(node)
      if (name) {
        symbols.push({
          name,
          kind: parent ? "method" : "function",
          signature: oneLine(node),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          parentName: parent,
        })
      }
      return
    }
    if (CLASS_TYPES.has(node.type)) {
      const name = nameOf(node)
      if (name) {
        symbols.push({
          name,
          kind: "class",
          signature: oneLine(node),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
        })
        const body = node.childForFieldName("body") ?? children(node).find((c: SyntaxNode) => c.type.includes("body"))
        if (body) {
          for (const child of children(body)) {
            visit(child, name)
          }
        }
      }
      return
    }
    // Recurse at module level
    if (!parent) {
      for (const child of children(node)) {
        visit(child)
      }
    }
  }

  for (const child of children(tree.rootNode)) {
    visit(child)
  }
  return symbols
}

// ─── Dispatcher ──────────────────────────────────────────────────────
const EXTRACTORS: Record<string, (tree: Tree) => ExtractedSymbol[]> = {
  typescript: extractTS,
  tsx: extractTS,
  javascript: extractTS,
  python: extractPython,
  go: extractGo,
  rust: extractRust,
}

export function extractSymbols(tree: Tree, language: string): ExtractedSymbol[] {
  const extractor = EXTRACTORS[language] ?? extractGeneric
  return extractor(tree)
}

export interface ExtractedFileGraph {
  symbols: ExtractedSymbol[]
  imports: string[]
  calls: Array<{ callerName: string; calleeName: string; line: number }>
  comments: string[]
}

function cleanImportPath(raw: string): string {
  return raw.replace(/^['"`]/, "").replace(/['"`]$/, "").trim()
}

export function extractGraphAndSymbols(
  tree: Tree,
  language: string,
  content?: string,
): ExtractedFileGraph {
  const symbols = extractSymbols(tree, language)
  const imports: string[] = []
  const calls: Array<{ callerName: string; calleeName: string; line: number }> = []
  const comments: string[] = []

  // 1. Extract comments from AST
  function walkComments(node: SyntaxNode) {
    if (node.type.includes("comment")) {
      comments.push(node.text)
    }
    for (const child of children(node)) {
      walkComments(child)
    }
  }
  walkComments(tree.rootNode)

  // 2. Extract imports from AST
  function walkImports(node: SyntaxNode) {
    if (node.type === "import_statement" || node.type === "export_statement") {
      const source = node.childForFieldName("source")
      if (source) {
        const cleaned = cleanImportPath(source.text)
        if (cleaned) imports.push(cleaned)
      } else {
        // Fallback: look for string literal child
        for (const child of children(node)) {
          if (child.type === "string" || child.type === "string_fragment") {
            const cleaned = cleanImportPath(child.text)
            if (cleaned) imports.push(cleaned)
          }
        }
      }
    } else if (node.type === "import_from_statement") {
      const moduleName = node.childForFieldName("module_name")?.text
      if (moduleName) imports.push(cleanImportPath(moduleName))
    } else if (node.type === "call_expression") {
      const fn = node.childForFieldName("function")?.text
      if (fn === "require" || fn === "import") {
        const args = node.childForFieldName("arguments")
        if (args) {
          const firstArg = children(args)[0]
          if (firstArg) {
            const cleaned = cleanImportPath(firstArg.text)
            if (cleaned) imports.push(cleaned)
          }
        }
      }
    }
    for (const child of children(node)) {
      walkImports(child)
    }
  }
  walkImports(tree.rootNode)

  // 3. Extract calls from AST
  function walkCalls(node: SyntaxNode, currentCaller?: string) {
    let nextCaller = currentCaller
    if (
      node.type === "function_declaration" ||
      node.type === "function_definition" ||
      node.type === "generator_function_declaration" ||
      node.type === "method_definition"
    ) {
      const name = nameOf(node)
      if (name) nextCaller = name
    } else if (node.type === "variable_declarator") {
      const name = node.childForFieldName("name")?.text
      const init = node.childForFieldName("value")
      if (name && init && (init.type === "arrow_function" || init.type === "function_expression")) {
        nextCaller = name
      }
    }

    if (node.type === "call_expression" || node.type === "call") {
      const fnNode = node.childForFieldName("function")
      let calleeName: string | undefined
      if (fnNode) {
        if (fnNode.type === "identifier") {
          calleeName = fnNode.text
        } else if (fnNode.type === "member_expression" || fnNode.type === "attribute") {
          calleeName = fnNode.childForFieldName("property")?.text ?? fnNode.childForFieldName("attribute")?.text
        }
      }
      if (calleeName && nextCaller) {
        calls.push({
          callerName: nextCaller,
          calleeName,
          line: node.startPosition.row + 1,
        })
      }
    }

    for (const child of children(node)) {
      walkCalls(child, nextCaller)
    }
  }
  walkCalls(tree.rootNode)

  // 4. Content regex fallbacks for imports & comments if content is provided
  if (content) {
    if (imports.length === 0) {
      const importRegex = /(?:import\s+(?:[\w*\s{},$]+from\s+)?|require\s*\(\s*)['"]([^'"]+)['"]/g
      let match: RegExpExecArray | null
      while ((match = importRegex.exec(content)) !== null) {
        if (match[1]) imports.push(match[1])
      }
    }

    if (comments.length === 0) {
      const commentRegex = /\/\/(.*)$|\/\*([\s\S]*?)\*\/|#(.*)$/gm
      let match: RegExpExecArray | null
      while ((match = commentRegex.exec(content)) !== null) {
        const comment = (match[1] || match[2] || match[3] || "").trim()
        if (comment) comments.push(comment)
      }
    }
  }

  return {
    symbols,
    imports: Array.from(new Set(imports)),
    calls,
    comments,
  }
}

