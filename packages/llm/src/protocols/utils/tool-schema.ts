import type { JsonSchema } from "../../schema"
import { isRecord } from "../../utils/record"

const removeNullSchemas = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(removeNullSchemas)
  if (!isRecord(value)) return value
  const fields = Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "anyOf")
      .map(([key, field]) => [key, removeNullSchemas(field)]),
  )
  if (!Array.isArray(value.anyOf)) return fields
  const variants = value.anyOf.filter((variant) => !isRecord(variant) || variant.type !== "null").map(removeNullSchemas)
  if (variants.length === 1 && isRecord(variants[0])) return { ...fields, ...variants[0] }
  return { ...fields, anyOf: variants }
}

const openAI = (schema: JsonSchema): JsonSchema => {
  const variants = Array.isArray(schema.anyOf) ? schema.anyOf.filter(isRecord) : []
  const flattened =
    variants.length === 0
      ? { ...schema, type: "object" }
      : {
          ...Object.fromEntries(Object.entries(schema).filter(([key]) => key !== "anyOf")),
          type: "object",
          properties: variants.reduce(
            (properties, variant) => ({ ...(isRecord(variant.properties) ? variant.properties : {}), ...properties }),
            {},
          ),
          additionalProperties: false,
        }
  const normalized = removeNullSchemas(flattened)
  return isRecord(normalized) ? normalized : { type: "object" }
}

// ---------------------------------------------------------------------------
// 4.1A — Compact schema projection (strip redundant metadata)
// ---------------------------------------------------------------------------

/** Keys that carry no information the model needs for tool-calling. */
const REDUNDANT_KEYS = new Set([
  "$schema",
  "$comment",
  "title",
  "examples",
  "default",
  "additionalProperties",
])

/**
 * Return true when a property description is "self-evident" — it merely
 * restates the parameter name and/or type without adding information.
 *
 * Examples that would be stripped:
 *   - `path` of type `string` with description `"The path"`
 *   - `offset` of type `integer` with description `"The offset"`
 */
const isSelfEvidentDescription = (name: string, desc: string, type?: string): boolean => {
  const lower = desc.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim()
  const lowerName = name.toLowerCase()
  const lowerType = (type ?? "").toLowerCase()
  if (lower === lowerName || lower === `the ${lowerName}`) return true
  if (lower === `${lowerName} ${lowerType}` || lower === `the ${lowerName} ${lowerType}`) return true
  return false
}

/**
 * Recursively strip redundant keys from a JSON Schema object.
 * Collapses single-definition $defs inline and removes self-evident
 * parameter descriptions.
 */
const stripRedundant = (value: unknown, propName?: string): unknown => {
  if (Array.isArray(value)) return value.map((item) => stripRedundant(item))
  if (!isRecord(value)) return value

  const entries: Array<[string, unknown]> = []
  for (const [key, field] of Object.entries(value)) {
    if (REDUNDANT_KEYS.has(key)) continue
    if (key === "description" && propName && typeof field === "string") {
      if (isSelfEvidentDescription(propName, field, value.type as string | undefined)) continue
    }
    entries.push([key, stripRedundant(field, key === "properties" ? undefined : key)])
  }

  const result = Object.fromEntries(entries)

  if (isRecord(result.properties)) {
    const props = result.properties as Record<string, unknown>
    const stripped: Record<string, unknown> = {}
    for (const [name, schema] of Object.entries(props)) {
      stripped[name] = stripRedundant(schema, name)
    }
    result.properties = stripped
  }

  if (isRecord(result.$defs)) {
    const defs = result.$defs as Record<string, unknown>
    const defKeys = Object.keys(defs)
    if (defKeys.length === 1) {
      const singleDef = defs[defKeys[0]!]
      if (isRecord(singleDef)) {
        const ref = `#/$defs/${defKeys[0]}`
        const resolved = inlineRef(result, ref, singleDef)
        if (resolved !== result) return stripRedundant(resolved, propName)
      }
    }
    const strippedDefs: Record<string, unknown> = {}
    for (const [name, schema] of Object.entries(defs)) {
      strippedDefs[name] = stripRedundant(schema, name)
    }
    result.$defs = strippedDefs
  }

  return result
}

/** Inline a single $ref throughout a schema tree. */
const inlineRef = (schema: unknown, ref: string, replacement: unknown): unknown => {
  if (!isRecord(schema)) return schema
  if (schema.$ref === ref) return replacement
  const entries: Array<[string, unknown]> = []
  for (const [key, value] of Object.entries(schema)) {
    if (key === "$defs") continue
    entries.push([key, Array.isArray(value) ? value.map((item) => inlineRef(item, ref, replacement)) : inlineRef(value, ref, replacement)])
  }
  return Object.fromEntries(entries)
}

/**
 * Compact schema projection: applies the standard openAI() flattening
 * then strips redundant metadata. Keeps JSON Schema shape intact —
 * no format change, just metadata removal.
 */
const compact = (schema: JsonSchema): JsonSchema => {
  const base = openAI(schema)
  const stripped = stripRedundant(base)
  return isRecord(stripped) ? stripped : base
}

/** Read the compression flag directly — packages/llm has no dependency on core/flag. */
const compressSchema = (): boolean => {
  const schema = process.env["FOX_EXPERIMENTAL_COMPRESS_SCHEMA"]?.toLowerCase()
  if (schema === "true" || schema === "1") return true
  if (schema === "false" || schema === "0") return false
  const compress = process.env["FOX_EXPERIMENTAL_COMPRESS"]?.toLowerCase()
  if (compress === "true" || compress === "1") return true
  if (compress === "false" || compress === "0") return false
  const master = process.env["FOX_EXPERIMENTAL"]?.toLowerCase()
  return master === "true" || master === "1"
}

/**
 * Auto-select the appropriate projection based on the
 * `FOX_EXPERIMENTAL_COMPRESS_SCHEMA` flag.
 */
const project = (schema: JsonSchema): JsonSchema =>
  compressSchema() ? compact(schema) : openAI(schema)

export const ToolSchemaProjection = {
  openAI,
  compact,
  project,
} as const

