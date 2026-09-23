export * as Checkpoint from "./checkpoint"

import { makeLocationNode } from "./effect/app-node"
import { Context, Effect, Layer, Schema } from "effect"
import { Snapshot } from "./snapshot"
import { Config } from "./config"
import { FSUtil } from "./fs-util"
import { Location } from "./location"
import { RelativePath } from "./schema"
import { File } from "./file"

export const CheckpointSource = Schema.Literals(["apply-patch", "edit", "manual", "baseline"])
export type CheckpointSource = typeof CheckpointSource.Type

export interface CheckpointInfo {
  readonly id: string
  readonly name?: string
  readonly timestamp: number
  readonly treeId: Snapshot.ID
  readonly files: readonly string[]
  readonly description?: string
  readonly source: CheckpointSource
}

export interface RecordInput {
  readonly name?: string
  readonly description?: string
  readonly files: readonly string[]
  readonly source: CheckpointSource
}

export interface UndoResult {
  readonly success: boolean
  readonly restoredFiles: readonly string[]
  readonly targetCheckpoint?: CheckpointInfo
  readonly message: string
}

export interface RedoResult {
  readonly success: boolean
  readonly restoredFiles: readonly string[]
  readonly targetCheckpoint?: CheckpointInfo
  readonly message: string
}

export class CheckpointError extends Schema.TaggedErrorClass<CheckpointError>()("Checkpoint.Error", {
  operation: Schema.Literals(["record", "create", "undo", "redo", "diff", "restore"]),
  message: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {}

export const DEFAULT_MAX_CHECKPOINTS = 10

export interface Interface {
  /**
   * Record a new checkpoint after a file mutation.
   * If no baseline exists, one is automatically captured first.
   */
  readonly record: (input: RecordInput) => Effect.Effect<CheckpointInfo | undefined>

  /**
   * Explicitly create a named checkpoint of the current working tree.
   */
  readonly create: (name: string, description?: string) => Effect.Effect<CheckpointInfo, CheckpointError>

  /**
   * Ensure a pre-mutation baseline exists before any changes are written.
   */
  readonly ensureBaseline: (description?: string) => Effect.Effect<CheckpointInfo | undefined>

  /**
   * List all stored checkpoints in chronological order.
   */
  readonly list: () => Effect.Effect<readonly CheckpointInfo[]>

  /**
   * Find a checkpoint by its unique ID or user-assigned name.
   */
  readonly get: (idOrName: string) => Effect.Effect<CheckpointInfo | undefined>

  /**
   * Get the most recent checkpoint.
   */
  readonly latest: () => Effect.Effect<CheckpointInfo | undefined>

  /**
   * Revert workspace files to a checkpoint (default: previous checkpoint).
   * Restores only files that changed between target checkpoint and current workspace.
   */
  readonly undo: (idOrName?: string) => Effect.Effect<UndoResult, CheckpointError>

  /**
   * Re-apply previously undone checkpoint.
   */
  readonly redo: () => Effect.Effect<RedoResult, CheckpointError>

  /**
   * Show structured file diffs between a checkpoint (default: latest) and current workspace.
   */
  readonly diff: (idOrName?: string) => Effect.Effect<readonly File.Diff[], CheckpointError>

  /**
   * Clear checkpoint history and redo stack.
   */
  readonly clear: () => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/Checkpoint") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const snapshot = yield* Snapshot.Service
    const config = yield* Config.Service
    const location = yield* Location.Service

    const history: CheckpointInfo[] = []
    const redoStack: CheckpointInfo[] = []
    let seq = 0

    const nextId = () => {
      seq += 1
      return `chk_${Date.now()}_${seq}`
    }

    const getMaxCheckpoints = Effect.fnUntraced(function* () {
      const entries = yield* config.entries()
      const cfg = Config.latest(entries, "checkpoints") as { max?: number } | undefined
      return typeof cfg?.max === "number" && cfg.max > 0 ? cfg.max : DEFAULT_MAX_CHECKPOINTS
    })

    const ensureBaseline = Effect.fn("Checkpoint.ensureBaseline")(function* (description = "Initial working state") {
      if (history.length > 0) return history[0]

      const tree = yield* snapshot.capture()
      if (!tree) return undefined

      const baseline: CheckpointInfo = {
        id: nextId(),
        name: "baseline",
        timestamp: Date.now(),
        treeId: tree,
        files: [],
        description,
        source: "baseline",
      }

      history.push(baseline)
      return baseline
    })

    const record = Effect.fn("Checkpoint.record")(function* (input: RecordInput) {
      // Clear redo stack on any new mutation
      redoStack.length = 0

      // Capture tree
      const tree = yield* snapshot.capture()
      if (!tree) return undefined

      const max = yield* getMaxCheckpoints()
      const checkpoint: CheckpointInfo = {
        id: nextId(),
        name: input.name,
        timestamp: Date.now(),
        treeId: tree,
        files: input.files,
        description: input.description,
        source: input.source,
      }

      history.push(checkpoint)

      // Evict oldest if exceeding capacity
      while (history.length > max) {
        history.shift()
      }

      return checkpoint
    })

    const create = Effect.fn("Checkpoint.create")(function* (name: string, description?: string) {
      redoStack.length = 0
      const tree = yield* snapshot.capture()
      if (!tree) {
        return yield* new CheckpointError({
          operation: "create",
          message: "Failed to capture tree for checkpoint: snapshots disabled or unavailable",
        })
      }

      const max = yield* getMaxCheckpoints()
      const checkpoint: CheckpointInfo = {
        id: nextId(),
        name,
        timestamp: Date.now(),
        treeId: tree,
        files: [],
        description: description ?? `Manual checkpoint: ${name}`,
        source: "manual",
      }

      history.push(checkpoint)
      while (history.length > max) {
        history.shift()
      }

      return checkpoint
    })

    const list = Effect.fn("Checkpoint.list")(function* () {
      return [...history]
    })

    const get = Effect.fn("Checkpoint.get")(function* (idOrName: string) {
      return history.find((c) => c.id === idOrName || c.name === idOrName)
    })

    const latest = Effect.fn("Checkpoint.latest")(function* () {
      return history.at(-1)
    })

    const restoreToTree = (targetTree: Snapshot.ID) =>
      Effect.gen(function* () {
        const currentTree = yield* snapshot.capture()
        if (!currentTree) {
          return yield* new CheckpointError({
            operation: "restore",
            message: "Cannot determine current workspace state",
          })
        }

        // Compare target tree to current tree to find all changed/added/deleted files
        const diffFiles = yield* snapshot
          .files({ from: targetTree, to: currentTree })
          .pipe(Effect.mapError((cause) => new CheckpointError({ operation: "restore", message: cause.message, cause })))

        if (diffFiles.length === 0) {
          return [] as string[]
        }

        const restoreMap = new Map<RelativePath, Snapshot.ID>()
        for (const file of diffFiles) {
          restoreMap.set(file, targetTree)
        }

        yield* snapshot
          .restore({ files: restoreMap })
          .pipe(Effect.mapError((cause) => new CheckpointError({ operation: "restore", message: cause.message, cause })))

        return diffFiles.map(String)
      })

    const undo = Effect.fn("Checkpoint.undo")(function* (idOrName?: string) {
      if (history.length === 0) {
        return {
          success: false,
          restoredFiles: [],
          message: "No checkpoints available to undo.",
        } satisfies UndoResult
      }

      let targetIndex: number
      if (idOrName) {
        targetIndex = history.findIndex((c) => c.id === idOrName || c.name === idOrName)
        if (targetIndex < 0) {
          return yield* new CheckpointError({
            operation: "undo",
            message: `Checkpoint not found: ${idOrName}`,
          })
        }
      } else {
        // Default: rewind to the checkpoint immediately before the current latest
        if (history.length < 2) {
          // If only 1 checkpoint exists, it's either the baseline or single edit.
          // If it's a baseline, we're already at baseline.
          const only = history[0]!
          if (only.source === "baseline") {
            const restored = yield* restoreToTree(only.treeId)
            return {
              success: true,
              restoredFiles: restored,
              targetCheckpoint: only,
              message: `Reverted workspace back to baseline (${only.id}).`,
            }
          }
          return {
            success: false,
            restoredFiles: [],
            message: "Already at the earliest checkpoint.",
          }
        }
        targetIndex = history.length - 2
      }

      const target = history[targetIndex]!
      const popped = history.splice(targetIndex + 1)
      redoStack.push(...popped.reverse())

      const restoredFiles = yield* restoreToTree(target.treeId)

      return {
        success: true,
        restoredFiles,
        targetCheckpoint: target,
        message: `Successfully rewound workspace to checkpoint "${target.name ?? target.id}" (${restoredFiles.length} file(s) restored).`,
      } satisfies UndoResult
    })

    const redo = Effect.fn("Checkpoint.redo")(function* () {
      if (redoStack.length === 0) {
        return {
          success: false,
          restoredFiles: [],
          message: "No undone checkpoints to redo.",
        } satisfies RedoResult
      }

      const target = redoStack.pop()!
      history.push(target)

      const restoredFiles = yield* restoreToTree(target.treeId)

      return {
        success: true,
        restoredFiles,
        targetCheckpoint: target,
        message: `Restored workspace to checkpoint "${target.name ?? target.id}" (${restoredFiles.length} file(s) updated).`,
      } satisfies RedoResult
    })

    const diff = Effect.fn("Checkpoint.diff")(function* (idOrName?: string) {
      const target = idOrName
        ? history.find((c) => c.id === idOrName || c.name === idOrName)
        : history.at(-1)

      if (!target) {
        return yield* new CheckpointError({
          operation: "diff",
          message: idOrName ? `Checkpoint not found: ${idOrName}` : "No checkpoints recorded yet",
        })
      }

      const currentTree = yield* snapshot.capture()
      if (!currentTree) {
        return yield* new CheckpointError({
          operation: "diff",
          message: "Cannot capture current workspace snapshot for diff",
        })
      }

      return yield* snapshot
        .diff({ from: target.treeId, to: currentTree })
        .pipe(Effect.mapError((cause) => new CheckpointError({ operation: "diff", message: cause.message, cause })))
    })

    const clear = Effect.fn("Checkpoint.clear")(function* () {
      history.length = 0
      redoStack.length = 0
    })

    return Service.of({
      record,
      create,
      ensureBaseline,
      list,
      get,
      latest,
      undo,
      redo,
      diff,
      clear,
    })
  }),
)

export const locationLayer = layer.pipe(Layer.provideMerge(Snapshot.locationLayer))

export const node = makeLocationNode({
  service: Service,
  layer,
  deps: [Snapshot.node, Config.node, FSUtil.node, Location.node],
})
