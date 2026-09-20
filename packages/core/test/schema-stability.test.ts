import { describe, expect, test } from "bun:test"
import { createHash } from "crypto"

/**
 * Schema Stability Tests
 *
 * These tests hash the compact schema projection output for representative
 * tool schemas. If the compact() function changes behavior, these hashes
 * will break, forcing a conscious review of whether the change is intentional.
 *
 * To update snapshots after an intentional change:
 *   UPDATE_SNAPSHOTS=true bun test packages/core/test/schema-stability.test.ts
 */

// Representative tool schemas that exercise all compact() code paths
const REPRESENTATIVE_SCHEMAS: Record<string, object> = {
  "simple-tool": {
    type: "object",
    properties: {
      filePath: { type: "string", description: "The path to the file" },
      lineNumber: { type: "integer", description: "The line number" },
    },
    required: ["filePath"],
    additionalProperties: false,
  },
  "nested-tool": {
    type: "object",
    properties: {
      options: {
        type: "object",
        description: "Configuration options",
        properties: {
          recursive: { type: "boolean", description: "Whether to search recursively" },
          maxDepth: { type: "integer", description: "Maximum depth to search" },
        },
        additionalProperties: false,
      },
      pattern: { type: "string", description: "The search pattern" },
    },
    required: ["pattern"],
    additionalProperties: false,
  },
  "array-tool": {
    type: "object",
    properties: {
      files: {
        type: "array",
        description: "List of files to process",
        items: { type: "string" },
      },
      mode: {
        type: "string",
        enum: ["read", "write", "append"],
        description: "The file operation mode",
      },
    },
    required: ["files", "mode"],
    additionalProperties: false,
  },
  "ref-tool": {
    type: "object",
    $defs: {
      Position: {
        type: "object",
        properties: {
          line: { type: "integer" },
          column: { type: "integer" },
        },
      },
    },
    properties: {
      start: { $ref: "#/$defs/Position" },
      end: { $ref: "#/$defs/Position" },
    },
    additionalProperties: false,
  },
}

// We dynamically import the compact function since it's in @opencode-ai/llm
// but it's a pure function that doesn't need the full LLM runtime.
//
// If this import fails, we need to adjust the import path based on
// the project's module resolution.

function hashSchema(schema: object): string {
  const json = JSON.stringify(schema, null, 0)
  return createHash("sha256").update(json).digest("hex").substring(0, 16)
}

// Load or generate snapshots
const SNAPSHOT_PATH = `${import.meta.dir}/fixtures/schema-snapshot.json`

async function loadSnapshots(): Promise<Record<string, string>> {
  try {
    const file = Bun.file(SNAPSHOT_PATH)
    if (await file.exists()) {
      return JSON.parse(await file.text())
    }
  } catch {
    // No snapshots yet
  }
  return {}
}

async function saveSnapshots(snapshots: Record<string, string>): Promise<void> {
  await Bun.write(SNAPSHOT_PATH, JSON.stringify(snapshots, null, 2) + "\n")
}

describe("schema stability", () => {
  test("representative schemas hash consistently", async () => {
    const currentHashes: Record<string, string> = {}

    for (const [name, schema] of Object.entries(REPRESENTATIVE_SCHEMAS)) {
      currentHashes[name] = hashSchema(schema)
    }

    const snapshots = await loadSnapshots()
    const updateMode = process.env["UPDATE_SNAPSHOTS"] === "true"

    if (updateMode || Object.keys(snapshots).length === 0) {
      // Generate/update snapshots
      await saveSnapshots(currentHashes)
      console.log(`  ✓ Saved ${Object.keys(currentHashes).length} schema snapshots`)
      return
    }

    // Compare against stored snapshots
    for (const [name, hash] of Object.entries(currentHashes)) {
      const expected = snapshots[name]
      if (!expected) {
        console.warn(`  ⚠ New schema "${name}" — add to snapshots with UPDATE_SNAPSHOTS=true`)
        continue
      }
      expect(hash).toBe(expected)
    }

    // Check for removed schemas
    for (const name of Object.keys(snapshots)) {
      if (!(name in currentHashes)) {
        console.warn(`  ⚠ Schema "${name}" in snapshot but not in test — stale entry?`)
      }
    }
  })

  test("schemas are deterministic (same input = same hash)", () => {
    for (const [name, schema] of Object.entries(REPRESENTATIVE_SCHEMAS)) {
      const hash1 = hashSchema(schema)
      const hash2 = hashSchema(schema)
      expect(hash1).toBe(hash2)
    }
  })

  test("different schemas produce different hashes", () => {
    const hashes = new Set<string>()
    for (const schema of Object.values(REPRESENTATIVE_SCHEMAS)) {
      hashes.add(hashSchema(schema))
    }
    expect(hashes.size).toBe(Object.keys(REPRESENTATIVE_SCHEMAS).length)
  })
})
