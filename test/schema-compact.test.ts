/**
 * Unit tests for ToolSchemaProjection.compact() — schema minification (4.1A)
 */
import { describe, test, expect } from "bun:test"
import { ToolSchemaProjection } from "@opencode-ai/llm/protocols/utils/tool-schema"

describe("ToolSchemaProjection.compact", () => {
  test("strips $schema, title, examples, $comment, additionalProperties", () => {
    const schema = {
      type: "object" as const,
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "ReadInput",
      $comment: "Auto-generated",
      examples: [{ path: "foo.ts" }],
      properties: {
        path: { type: "string" as const, description: "File path to read" },
      },
      required: ["path"],
      additionalProperties: false,
    }
    const result = ToolSchemaProjection.compact(schema)
    expect(result).not.toHaveProperty("$schema")
    expect(result).not.toHaveProperty("title")
    expect(result).not.toHaveProperty("$comment")
    expect(result).not.toHaveProperty("examples")
    expect(result).not.toHaveProperty("additionalProperties")
    // Keeps essential schema shape
    expect(result).toHaveProperty("type", "object")
    expect(result).toHaveProperty("required")
    expect((result as any).properties.path.description).toBe("File path to read")
  })

  test("strips self-evident descriptions", () => {
    const schema = {
      type: "object" as const,
      properties: {
        path: { type: "string" as const, description: "The path" },
        offset: { type: "integer" as const, description: "The offset" },
        query: { type: "string" as const, description: "Search query to find matching files" },
      },
    }
    const result = ToolSchemaProjection.compact(schema)
    const props = (result as any).properties
    // "The path" is self-evident for a parameter named "path"
    expect(props.path).not.toHaveProperty("description")
    // "The offset" is self-evident for "offset"
    expect(props.offset).not.toHaveProperty("description")
    // "Search query to find matching files" is NOT self-evident
    expect(props.query.description).toBe("Search query to find matching files")
  })

  test("preserves valid JSON Schema structure for OpenAI compatibility", () => {
    const schema = {
      anyOf: [
        {
          type: "object" as const,
          properties: {
            file_path: { type: "string" as const, description: "Path to file" },
          },
          required: ["file_path"],
        },
      ],
    }
    const result = ToolSchemaProjection.compact(schema)
    expect(result).toHaveProperty("type", "object")
    expect((result as any).properties).toHaveProperty("file_path")
  })

  test("inlines single $defs", () => {
    const schema = {
      type: "object" as const,
      $defs: {
        FileRef: {
          type: "object" as const,
          properties: {
            path: { type: "string" as const },
          },
        },
      },
      properties: {
        file: { $ref: "#/$defs/FileRef" },
      },
    }
    const result = ToolSchemaProjection.compact(schema)
    expect(result).not.toHaveProperty("$defs")
    const props = (result as any).properties
    expect(props.file).toHaveProperty("type", "object")
    expect(props.file.properties).toHaveProperty("path")
  })

  test("openAI() still works for non-compact mode", () => {
    const schema = {
      anyOf: [
        {
          type: "object" as const,
          properties: { a: { type: "string" as const } },
        },
      ],
    }
    const result = ToolSchemaProjection.openAI(schema)
    expect(result).toHaveProperty("type", "object")
    expect(result).toHaveProperty("additionalProperties", false)
  })
})
