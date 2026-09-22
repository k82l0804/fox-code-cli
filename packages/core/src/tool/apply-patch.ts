export * as ApplyPatchTool from "./apply-patch"

import { ToolFailure } from "@opencode-ai/llm"
import { FileDiff } from "@opencode-ai/schema/file-diff"
import { createTwoFilesPatch, diffLines } from "diff"
import { Effect, Layer, Schema } from "effect"
import { makeLocationNode } from "../effect/app-node"
import { FileMutation } from "../file-mutation"
import { FSUtil } from "../fs-util"
import { Location } from "../location"
import { LocationMutation } from "../location-mutation"
import { Patch } from "../patch"
import { PermissionV2 } from "../permission"
import { ToolOutputStore } from "../tool-output-store"
import { ToolRegistry } from "./registry"
import { Tool } from "./tool"
import { Tools } from "./tools"
import { ToolOutputCompressor } from "./compress"
import { Flag } from "../flag/flag"
import { TransactionConfidence } from "../transaction-confidence"

export const name = "apply_patch"

export const Input = Schema.Struct({
  patchText: Schema.String.annotate({
    description: "The full patch text describing add, update, and delete operations",
  }),
})

export const Applied = Schema.Struct({
  type: Schema.Literals(["add", "update", "delete"]),
  resource: Schema.String,
  target: Schema.String,
})

export const ConfidenceOutput = Schema.Struct({
  overall: Schema.Number,
  recommendation: Schema.Literals(["apply", "review", "reject"]),
})

export const Output = Schema.Struct({
  applied: Schema.Array(Applied),
  files: Schema.Array(FileDiff.Info),
  confidence: Schema.optional(ConfidenceOutput),
})
export type Output = typeof Output.Type
const compact = (output: Output): Output => {
  if (Buffer.byteLength(JSON.stringify(output), "utf-8") <= ToolOutputStore.MAX_BYTES) return output
  return {
    ...output,
    files: output.files.map((file) => ({
      additions: file.additions,
      deletions: file.deletions,
      ...(file.file === undefined ? {} : { file: file.file }),
      ...(file.status === undefined ? {} : { status: file.status }),
    })),
  }
}
export const toModelOutput = (output: Output) =>
  [
    "Applied patch atomically:",
    ...output.applied.map(
      (item) => `${item.type === "add" ? "A" : item.type === "delete" ? "D" : "M"} ${item.resource}`,
    ),
    ...(output.confidence
      ? [`Confidence: ${(output.confidence.overall * 100).toFixed(0)}% (${output.confidence.recommendation})`]
      : []),
  ].join("\n")

type Prepared =
  | (Extract<Patch.Hunk, { readonly type: "add" | "delete" }> & {
      readonly target: LocationMutation.Target
      readonly before: string
      readonly after: string
    })
  | (Extract<Patch.Hunk, { readonly type: "update" }> & {
      readonly target: LocationMutation.Target
      readonly source: Uint8Array
      readonly content: string
      readonly before: string
      readonly after: string
      readonly confidence: TransactionConfidence.HunkConfidence[]
    })

const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const tools = yield* Tools.Service
    const mutation = yield* LocationMutation.Service
    const location = yield* Location.Service
    const files = yield* FileMutation.Service
    const fs = yield* FSUtil.Service
    const permission = yield* PermissionV2.Service

    yield* tools
      .register({
        [name]: Tool.withPermission(
          Tool.make({
            description:
              "Apply one patch containing add, update, and delete file operations. All operations are validated in a dry-run phase before any files are modified. If validation passes, changes are applied atomically — either all succeed or all are rolled back. Moves are not supported yet.",
            input: Input,
            output: Output,
            structured: Output,
            toStructuredOutput: ({ output }) => compact(output),
            toModelOutput: ({ output }) => [{ type: "text", text: ToolOutputCompressor.process(
              toModelOutput(output),
              { workspaceRoot: location.directory, toolName: name },
            ) }],
            execute: (input, context) => {
              return Effect.gen(function* () {
                const source = {
                  type: "tool" as const,
                  messageID: context.assistantMessageID,
                  callID: context.toolCallID,
                }
                if (!input.patchText.trim()) return yield* new ToolFailure({ message: "patchText is required" })
                const hunks = yield* Effect.try({
                  try: () => Patch.parse(input.patchText),
                  catch: (cause) => new ToolFailure({ message: `apply_patch verification failed: ${String(cause)}` }),
                })
                if (hunks.length === 0) return yield* new ToolFailure({ message: "patch rejected: empty patch" })
                const move = hunks.find((hunk) => hunk.type === "update" && hunk.movePath !== undefined)
                if (move) return yield* new ToolFailure({ message: "apply_patch moves are not supported yet" })

                // ─── Phase 1: Resolve & Approve ──────────────────────────────
                const targets: Array<{ readonly hunk: Patch.Hunk; readonly target: LocationMutation.Target }> = []
                for (const hunk of hunks)
                  targets.push({ hunk, target: yield* mutation.resolve({ path: hunk.path, kind: "file" }) })
                const externalDirectories = new Map<string, LocationMutation.ExternalDirectoryAuthorization>()
                for (const { target } of targets) {
                  const external = target.externalDirectory
                  if (external) externalDirectories.set(external.resource, external)
                }
                for (const external of externalDirectories.values()) {
                  yield* permission.assert({
                    ...LocationMutation.externalDirectoryPermission(external),
                    sessionID: context.sessionID,
                    agent: context.agent,
                    source,
                  })
                }
                yield* permission.assert({
                  action: "edit",
                  resources: [...new Set(targets.map(({ target }) => target.resource))],
                  save: ["*"],
                  sessionID: context.sessionID,
                  agent: context.agent,
                  source,
                })

                // ─── Phase 2: Dry-Run (prepare + confidence) ─────────────────
                const prepared: Prepared[] = []
                const allConfidence: TransactionConfidence.HunkConfidence[] = []
                const fail = (path: string) =>
                  new ToolFailure({ message: `Unable to apply patch at ${path}` })

                for (const { hunk, target } of targets) {
                  yield* Effect.gen(function* () {
                    if (hunk.type === "add") {
                      prepared.push({
                        ...hunk,
                        target,
                        before: "",
                        after:
                          hunk.contents.endsWith("\n") || hunk.contents === "" ? hunk.contents : `${hunk.contents}\n`,
                      })
                      // Add operations are always exact confidence
                      allConfidence.push(
                        TransactionConfidence.scoreHunk(hunk.path, allConfidence.length, "exact", 0),
                      )
                      return
                    }
                    if ((yield* fs.stat(target.canonical)).type !== "File") yield* fail(hunk.path)
                    const sourceBytes = yield* fs.readFile(target.canonical)
                    const original = new TextDecoder("utf-8", { ignoreBOM: true }).decode(sourceBytes)
                    const before = original.replace(/^\uFEFF/, "")
                    if (hunk.type === "delete") {
                      prepared.push({ ...hunk, target, before, after: "" })
                      // Delete operations are always exact confidence
                      allConfidence.push(
                        TransactionConfidence.scoreHunk(hunk.path, allConfidence.length, "exact", 0),
                      )
                      return
                    }
                    // Update: use deriveWithConfidence for dry-run + confidence scoring
                    const result = Patch.deriveWithConfidence(hunk.path, hunk.chunks, original)
                    allConfidence.push(...result.confidence)
                    prepared.push({
                      ...hunk,
                      target,
                      source: sourceBytes,
                      content: Patch.joinBom(result.update.content, result.update.bom),
                      before,
                      after: result.update.content,
                      confidence: result.confidence,
                    })
                  }).pipe(Effect.mapError(() => fail(hunk.path)))
                }

                // ─── Phase 2b: Confidence Gate ───────────────────────────────
                const confidence = TransactionConfidence.aggregate(allConfidence)
                if (confidence.recommendation === "reject") {
                  const lowHunks = confidence.hunks
                    .filter((h) => h.score < 0.7)
                    .map((h) => `  ${h.path} hunk#${h.hunkIndex}: ${(h.score * 100).toFixed(0)}% (${h.matchTier})`)
                  return yield* new ToolFailure({
                    message: [
                      `Patch rejected: confidence too low (${(confidence.overall * 100).toFixed(0)}%)`,
                      "Low-confidence hunks:",
                      ...lowHunks,
                      "Please re-read the affected files and provide more context in the patch.",
                    ].join("\n"),
                  })
                }

                // ─── Phase 3: Atomic Apply (with transaction) ────────────────
                const tx = files.createTransaction()
                const applied: Array<typeof Applied.Type> = []
                const patchFiles = prepared.map(patchFile)

                const applyAll = Effect.gen(function* () {
                  for (const change of prepared) {
                    if (change.type === "add") {
                      const result = yield* files.createTransactional(tx, {
                        target: change.target,
                        content:
                          change.contents.endsWith("\n") || change.contents === ""
                            ? change.contents
                            : `${change.contents}\n`,
                      })
                      applied.push({ type: change.type, resource: result.resource, target: result.target })
                      continue
                    }
                    if (change.type === "delete") {
                      const result = yield* files.removeTransactional(tx, { target: change.target })
                      applied.push({ type: change.type, resource: result.resource, target: result.target })
                      continue
                    }
                    const result = yield* files.writeIfUnchangedTransactional(tx, {
                      target: change.target,
                      expected: change.source,
                      content: change.content,
                    })
                    applied.push({ type: change.type, resource: result.resource, target: result.target })
                  }
                })

                yield* applyAll.pipe(
                  Effect.tapError(() =>
                    // Rollback all changes on any failure
                    tx.rollback(fs).pipe(Effect.catch(() => Effect.void)),
                  ),
                  Effect.mapError(() => new ToolFailure({
                    message: "Patch failed; no changes applied. All files remain in their original state. To recover: re-read the target file(s) and construct a fresh patch from their current (unchanged) content.",
                  })),
                )

                // Commit the transaction (clears journal)
                tx.commit()

                return {
                  applied,
                  files: patchFiles,
                  confidence: {
                    overall: confidence.overall,
                    recommendation: confidence.recommendation,
                  },
                } satisfies Output
              }).pipe(Effect.mapError((error) => (error instanceof ToolFailure ? error : new ToolFailure({ message: "patch failed" }))))
            },
          }),
          "edit",
        ),
      })
      .pipe(Effect.orDie)
  }),
)

export const node = makeLocationNode({
  name: "tool/apply-patch",
  layer,
  deps: [ToolRegistry.node, LocationMutation.node, FileMutation.node, FSUtil.node, PermissionV2.node, Location.node],
})

function patchFile(change: Prepared): typeof FileDiff.Info.Type {
  const counts = diffLines(change.before, change.after).reduce(
    (result, item) => ({
      additions: result.additions + (item.added ? (item.count ?? 0) : 0),
      deletions: result.deletions + (item.removed ? (item.count ?? 0) : 0),
    }),
    { additions: 0, deletions: 0 },
  )
  return {
    file: change.target.resource,
    patch: createTwoFilesPatch(
      change.target.resource, change.target.resource, change.before, change.after,
      undefined, undefined, Flag.FOX_EXPERIMENTAL_COMPRESS_DIFF
        ? { context: Flag.FOX_EXPERIMENTAL_COMPRESS_DIFF_CONTEXT }
        : undefined,
    ),
    status: change.type === "add" ? "added" : change.type === "delete" ? "deleted" : "modified",
    ...counts,
  }
}
