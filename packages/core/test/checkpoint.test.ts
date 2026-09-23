import { describe, expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import { Checkpoint, DEFAULT_MAX_CHECKPOINTS } from "../src/checkpoint"
import { Snapshot } from "../src/snapshot"
import { Config } from "../src/config"
import { Location } from "../src/location"
import { Project } from "../src/project"
import { AbsolutePath, RelativePath } from "../src/schema"
import { File } from "../src/file"

describe("Checkpoint.Service", () => {
  // Test harness creating a mock snapshot engine with stateful tree history
  const createTestEnv = (options?: { maxCheckpoints?: number }) => {
    let currentTreeIndex = 1
    const treeFiles = new Map<Snapshot.ID, Map<RelativePath, string>>()
    const restoredMapHistory: Map<RelativePath, Snapshot.ID>[] = []

    let activeTree: Snapshot.ID

    const registerTree = (files: Record<string, string>): Snapshot.ID => {
      const id = Snapshot.ID.make(`tree_${currentTreeIndex++}`)
      const map = new Map<RelativePath, string>()
      for (const [k, v] of Object.entries(files)) {
        map.set(RelativePath.make(k), v)
      }
      treeFiles.set(id, map)
      activeTree = id
      return id
    }

    activeTree = registerTree({ "index.ts": "console.log('init')" })

    const mockSnapshot: Snapshot.Interface = {
      capture: () => Effect.succeed(activeTree),
      files: (input) =>
        Effect.sync(() => {
          const fromMap = treeFiles.get(input.from) ?? new Map()
          const toMap = treeFiles.get(input.to) ?? new Map()
          const changed: RelativePath[] = []
          const allKeys = new Set([...fromMap.keys(), ...toMap.keys()])
          for (const key of allKeys) {
            if (fromMap.get(key) !== toMap.get(key)) {
              changed.push(key)
            }
          }
          return changed
        }),
      diff: (input) =>
        Effect.sync(() => {
          const fromMap = treeFiles.get(input.from) ?? new Map()
          const toMap = treeFiles.get(input.to) ?? new Map()
          const diffs: File.Diff[] = []
          for (const [path, toContent] of toMap.entries()) {
            const fromContent = fromMap.get(path)
            if (fromContent !== toContent) {
              diffs.push({
                path,
                status: "modified",
                additions: 1,
                deletions: 1,
                patch: `--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-${fromContent}\n+${toContent}`,
              })
            }
          }
          return diffs
        }),
      preview: () => Effect.succeed([]),
      restore: (input) =>
        Effect.sync(() => {
          restoredMapHistory.push(new Map(input.files))
          // Simulate restore by updating active tree to match the target
          for (const [path, targetTree] of input.files) {
            const sourceMap = treeFiles.get(targetTree)
            const currentMap = treeFiles.get(activeTree) ?? new Map()
            if (sourceMap && sourceMap.has(path)) {
              currentMap.set(path, sourceMap.get(path)!)
            } else {
              currentMap.delete(path)
            }
          }
        }),
      checkout: () => Effect.void,
    }

    const mockConfig: Config.Interface = {
      entries: () =>
        Effect.succeed(
          options?.maxCheckpoints !== undefined
            ? [
                new Config.Document({
                  type: "document",
                  info: new Config.Info({
                    checkpoints: { max: options.maxCheckpoints },
                  }),
                }),
              ]
            : [],
        ),
    }

    const mockLocation: Location.Interface = {
      directory: AbsolutePath.make("/workspace"),
      project: { id: Project.ID.make("test-proj"), directory: AbsolutePath.make("/workspace") },
    }

    const testLayer = Checkpoint.layer.pipe(
      Layer.provide(Layer.succeed(Snapshot.Service, mockSnapshot)),
      Layer.provide(Layer.succeed(Config.Service, mockConfig)),
      Layer.provide(Layer.succeed(Location.Service, mockLocation)),
    )

    return {
      testLayer,
      registerTree,
      setTree: (id: Snapshot.ID) => {
        activeTree = id
      },
      restoredMapHistory,
    }
  }

  test("captures initial pre-mutation baseline only once", async () => {
    const env = createTestEnv()
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const cp = yield* Checkpoint.Service
        const b1 = yield* cp.ensureBaseline("First baseline")
        const b2 = yield* cp.ensureBaseline("Second baseline attempt")
        const list = yield* cp.list()
        return { b1, b2, list }
      }).pipe(Effect.provide(env.testLayer)),
    )

    expect(result.b1).toBeDefined()
    expect(result.b1?.name).toBe("baseline")
    expect(result.b1?.source).toBe("baseline")
    expect(result.b2?.id).toBe(result.b1?.id)
    expect(result.list.length).toBe(1)
  })

  test("records checkpoints and allows querying by name or id", async () => {
    const env = createTestEnv()
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const cp = yield* Checkpoint.Service
        yield* cp.ensureBaseline()

        env.registerTree({ "index.ts": "console.log('step 1')" })
        const c1 = yield* cp.record({
          name: "step-1",
          description: "first change",
          files: ["index.ts"],
          source: "edit",
        })

        env.registerTree({ "index.ts": "console.log('step 2')", "utils.ts": "export const x = 1;" })
        const c2 = yield* cp.create("step-2", "second change")

        const list = yield* cp.list()
        const byName = yield* cp.get("step-1")
        const byId = yield* cp.get(c2.id)
        const latest = yield* cp.latest()

        return { c1, c2, list, byName, byId, latest }
      }).pipe(Effect.provide(env.testLayer)),
    )

    expect(result.list.length).toBe(3) // baseline, step-1, step-2
    expect(result.byName?.name).toBe("step-1")
    expect(result.byId?.name).toBe("step-2")
    expect(result.latest?.name).toBe("step-2")
  })

  test("enforces bounded FIFO ring buffer capacity (default N=10)", async () => {
    const env = createTestEnv()
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const cp = yield* Checkpoint.Service
        yield* cp.ensureBaseline()

        for (let i = 1; i <= 15; i++) {
          env.registerTree({ "index.ts": `console.log(${i})` })
          yield* cp.record({
            name: `edit-${i}`,
            files: ["index.ts"],
            source: "edit",
          })
        }

        const list = yield* cp.list()
        return { list }
      }).pipe(Effect.provide(env.testLayer)),
    )

    expect(result.list.length).toBe(DEFAULT_MAX_CHECKPOINTS)
    // Oldest checkpoints (baseline through edit-5) should be evicted
    expect(result.list[0].name).toBe("edit-6")
    expect(result.list.at(-1)?.name).toBe("edit-15")
  })

  test("enforces custom configured max capacity", async () => {
    const env = createTestEnv({ maxCheckpoints: 3 })
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const cp = yield* Checkpoint.Service
        for (let i = 1; i <= 5; i++) {
          env.registerTree({ "index.ts": `console.log(${i})` })
          yield* cp.record({
            name: `edit-${i}`,
            files: ["index.ts"],
            source: "edit",
          })
        }
        return yield* cp.list()
      }).pipe(Effect.provide(env.testLayer)),
    )

    expect(result.length).toBe(3)
    expect(result[0].name).toBe("edit-3")
    expect(result[1].name).toBe("edit-4")
    expect(result[2].name).toBe("edit-5")
  })

  test("undo reverts workspace to previous checkpoint with selective file restoration", async () => {
    const env = createTestEnv()
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const cp = yield* Checkpoint.Service
        yield* cp.ensureBaseline()

        // Mutation 1: add file-a
        env.registerTree({ "index.ts": "init", "file-a.ts": "a" })
        yield* cp.record({
          name: "add-a",
          files: ["file-a.ts"],
          source: "apply-patch",
        })

        // Mutation 2: modify file-a and add file-b
        env.registerTree({ "index.ts": "init", "file-a.ts": "a modified", "file-b.ts": "b" })
        yield* cp.record({
          name: "mod-a-add-b",
          files: ["file-a.ts", "file-b.ts"],
          source: "edit",
        })

        // Now undo: should rewind from "mod-a-add-b" back to "add-a"
        const undoRes = yield* cp.undo()
        const currentList = yield* cp.list()

        return { undoRes, currentList }
      }).pipe(Effect.provide(env.testLayer)),
    )

    expect(result.undoRes.success).toBe(true)
    expect(result.undoRes.targetCheckpoint?.name).toBe("add-a")
    // File changed: file-a modified and file-b added. Untouched index.ts should NOT be restored.
    expect(result.undoRes.restoredFiles).toContain("file-a.ts")
    expect(result.undoRes.restoredFiles).toContain("file-b.ts")
    expect(result.undoRes.restoredFiles).not.toContain("index.ts")
    // History should now contain [baseline, add-a]
    expect(result.currentList.length).toBe(2)
  })

  test("undo to named checkpoint and redo stack replay", async () => {
    const env = createTestEnv()
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const cp = yield* Checkpoint.Service
        yield* cp.ensureBaseline()

        env.registerTree({ "index.ts": "step 1" })
        yield* cp.record({ name: "checkpoint-1", files: ["index.ts"], source: "edit" })

        env.registerTree({ "index.ts": "step 2" })
        yield* cp.record({ name: "checkpoint-2", files: ["index.ts"], source: "edit" })

        env.registerTree({ "index.ts": "step 3" })
        yield* cp.record({ name: "checkpoint-3", files: ["index.ts"], source: "edit" })

        // Undo directly back to checkpoint-1
        const undoTarget = yield* cp.undo("checkpoint-1")

        // Redo should restore checkpoint-2
        const redo1 = yield* cp.redo()

        // Redo again should restore checkpoint-3
        const redo2 = yield* cp.redo()

        // Redo when stack empty
        const redoEmpty = yield* cp.redo()

        return { undoTarget, redo1, redo2, redoEmpty }
      }).pipe(Effect.provide(env.testLayer)),
    )

    expect(result.undoTarget.success).toBe(true)
    expect(result.undoTarget.targetCheckpoint?.name).toBe("checkpoint-1")

    expect(result.redo1.success).toBe(true)
    expect(result.redo1.targetCheckpoint?.name).toBe("checkpoint-2")

    expect(result.redo2.success).toBe(true)
    expect(result.redo2.targetCheckpoint?.name).toBe("checkpoint-3")

    expect(result.redoEmpty.success).toBe(false)
    expect(result.redoEmpty.message).toContain("No undone checkpoints")
  })

  test("diff produces structured differences against checkpoint", async () => {
    const env = createTestEnv()
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const cp = yield* Checkpoint.Service
        yield* cp.ensureBaseline()

        env.registerTree({ "index.ts": "original code" })
        yield* cp.create("baseline-snapshot")

        // Mutate current tree
        env.registerTree({ "index.ts": "refactored code" })

        const diffs = yield* cp.diff("baseline-snapshot")
        return { diffs }
      }).pipe(Effect.provide(env.testLayer)),
    )

    expect(result.diffs.length).toBe(1)
    expect(result.diffs[0].path).toBe(RelativePath.make("index.ts"))
    expect(result.diffs[0].patch).toContain("-original code")
    expect(result.diffs[0].patch).toContain("+refactored code")
  })

  test("undo and diff handle error states gracefully", async () => {
    const env = createTestEnv()
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const cp = yield* Checkpoint.Service

        // Undo on empty history
        const emptyUndo = yield* cp.undo()

        // Diff on empty history
        const diffError = yield* cp.diff().pipe(Effect.flip)

        // Undo with invalid name
        yield* cp.ensureBaseline()
        const notFoundUndo = yield* cp.undo("non-existent").pipe(Effect.flip)

        return { emptyUndo, diffError, notFoundUndo }
      }).pipe(Effect.provide(env.testLayer)),
    )

    expect(result.emptyUndo.success).toBe(false)
    expect(result.diffError._tag).toBe("Checkpoint.Error")
    expect(result.diffError.message).toContain("No checkpoints recorded yet")
    expect(result.notFoundUndo._tag).toBe("Checkpoint.Error")
    expect(result.notFoundUndo.message).toContain("Checkpoint not found: non-existent")
  })
})
