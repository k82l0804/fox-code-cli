import { Schema } from "effect"
import { Effect } from "effect"
import * as Tool from "./tool"
import DESCRIPTION from "./write.txt"
import { RewriteFileTool } from "./rewrite_file"

export const Parameters = Schema.Struct({
  content: Schema.String.annotate({ description: "The content to write to the file" }),
  filePath: Schema.String.annotate({
    description: "The absolute path to the file to write (must be absolute, not relative)",
  }),
})

export const WriteTool = Tool.define(
  "write",
  Effect.gen(function* () {
    const rewriteInfo = yield* RewriteFileTool
    const rewriteDef = yield* Tool.init(rewriteInfo)

    return {
      description: `@deprecated Use rewrite_file instead.\n${DESCRIPTION}`,
      parameters: Parameters,
      execute: (params: { content: string; filePath: string }, ctx: Tool.Context) =>
        rewriteDef.execute(
          {
            file_path: params.filePath,
            content: params.content,
            create: true,
          },
          ctx,
        ),
    }
  }),
)
