import { Schema } from "effect"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { ModelV2 } from "@opencode-ai/core/model"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { zod } from "@opencode-ai/core/effect-zod"
import { withStatics } from "@opencode-ai/core/schema"
import { SessionID, MessageID } from "../schema"
import { MessageV2 } from "../message-v2"

export const ModelRef = Schema.Struct({
  providerID: ProviderV2.ID,
  modelID: ModelV2.ID,
})

export const PromptInput = Schema.Struct({
  sessionID: SessionID,
  messageID: Schema.optional(MessageID),
  model: Schema.optional(ModelRef),
  agent: Schema.optional(Schema.String),
  noReply: Schema.optional(Schema.Boolean),
  tools: Schema.optional(Schema.Record(Schema.String, Schema.Boolean)).annotate({
    description:
      "@deprecated tools and permissions have been merged, you can set permissions on the session itself now",
  }),
  format: Schema.optional(SessionV1.Format),
  system: Schema.optional(Schema.String),
  variant: Schema.optional(Schema.String),
  snapshotInitialization: Schema.optional(Schema.Literal("wait")).annotate({
    description: "Wait silently if snapshot initialization is slow instead of asking the user.",
  }),
  editorContext: Schema.optional(MessageV2.EditorContext),
  parts: Schema.Array(
    Schema.Union([
      SessionV1.TextPartInput,
      SessionV1.FilePartInput,
      SessionV1.AgentPartInput,
      SessionV1.SubtaskPartInput,
    ]).annotate({ discriminator: "type" }),
  ),
}).pipe(withStatics((s) => ({ zod: zod(s) })))

// `z.discriminatedUnion` erases the discriminated members' shapes back to
// `{}` when walked from the generic `z.ZodType` input. Restore the precise
// `parts` type from the exported Schema input types so callers see a proper
// tagged union.
type PartInputUnion =
  | MessageV2.TextPartInput
  | MessageV2.FilePartInput
  | MessageV2.AgentPartInput
  | MessageV2.SubtaskPartInput

export type PromptInput = Omit<Schema.Schema.Type<typeof PromptInput>, "parts" | "editorContext"> & {
  parts: PartInputUnion[]
  editorContext?: MessageV2.EditorContext
}

export class LoopInput extends Schema.Class<LoopInput>("SessionPrompt.LoopInput")({
  sessionID: SessionID,
  resume: Schema.optional(MessageID),
  snapshotInitialization: Schema.optional(Schema.Literal("wait")),
}) {
  static readonly zod = zod(this)
}

export const ShellInput = Schema.Struct({
  sessionID: SessionID,
  messageID: Schema.optional(MessageID),
  agent: Schema.String,
  model: Schema.optional(ModelRef),
  command: Schema.String,
})
export type ShellInput = Schema.Schema.Type<typeof ShellInput>
