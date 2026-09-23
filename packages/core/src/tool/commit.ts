export * as CommitTool from "./commit"

import { Effect, Schema } from "effect"
import { Tool } from "./tool"

export const name = "commit"

export const Input = Schema.Struct({
  message: Schema.optional(Schema.String).annotate({
    description: "Optional commit message. If not provided, one will be generated from the diff.",
  }),
  files: Schema.optional(Schema.Array(Schema.String)).annotate({
    description: "Optional list of specific files to stage. If not provided, all modified tracked files are staged.",
  }),
  amend: Schema.optional(Schema.Boolean).annotate({
    description: "If true, amend the previous commit instead of creating a new one.",
  }),
})
export type Input = typeof Input.Type

export const Output = Schema.Struct({
  hash: Schema.String,
  message: Schema.String,
  filesChanged: Schema.Number,
  insertions: Schema.Number,
  deletions: Schema.Number,
})
export type Output = typeof Output.Type

export const toModelOutput = (output: Output) =>
  `[Commit ${output.hash.slice(0, 7)}] ${output.message}\n${output.filesChanged} file(s) changed, ${output.insertions} insertions(+), ${output.deletions} deletions(-)`

export const toolDefinition = Tool.make({
  description:
    "Commit staged changes with a generated or provided commit message. Automatically stages modified tracked files and generates a conventional commit message from the diff.",
  input: Input,
  output: Output,
  execute: () =>
    Effect.die(new Error("CommitTool in packages/core is a schema descriptor; execution is provided by ApplicationTools/runtime")),
  toModelOutput: ({ output }) => [{ type: "text", text: toModelOutput(output) }],
})
