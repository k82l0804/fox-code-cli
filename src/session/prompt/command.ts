import { Schema } from "effect"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { SessionID, MessageID, PartID } from "../schema"

export const bashRegex = /!`([^`]+)`/g
// Match [Image N] as single token, quoted strings, or non-space sequences
export const argsRegex = /(?:\[Image\s+\d+\]|"[^"]*"|'[^']*'|[^\s"']+)/gi
export const placeholderRegex = /\$(\d+)/g
export const quoteTrimRegex = /^["']|["']$/g

export const CommandInput = Schema.Struct({
  messageID: Schema.optional(MessageID),
  sessionID: SessionID,
  agent: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
  arguments: Schema.String,
  command: Schema.String,
  variant: Schema.optional(Schema.String),
  snapshotInitialization: Schema.optional(Schema.Literal("wait")).annotate({
    description: "Wait silently if snapshot initialization is slow instead of asking the user.",
  }),
  parts: Schema.optional(
    Schema.Array(
      Schema.Union([
        Schema.Struct({
          id: Schema.optional(PartID),
          type: Schema.Literal("file"),
          mime: Schema.String,
          filename: Schema.optional(Schema.String),
          url: Schema.String,
          source: Schema.optional(SessionV1.FilePartSource),
        }),
      ]).annotate({ discriminator: "type" }),
    ),
  ),
})
export type CommandInput = Schema.Schema.Type<typeof CommandInput>

export function parseCommandArgs(rawArgs: string): string[] {
  const raw = rawArgs.match(argsRegex) ?? []
  return raw.map((arg) => arg.replace(quoteTrimRegex, ""))
}

export function interpolateCommandTemplate(template: string, args: string[], rawArgs: string): string {
  const placeholders = template.match(placeholderRegex) ?? []
  let last = 0
  for (const item of placeholders) {
    const value = Number(item.slice(1))
    if (value > last) last = value
  }

  const withArgs = template.replaceAll(placeholderRegex, (_, index) => {
    const position = Number(index)
    const argIndex = position - 1
    if (argIndex >= args.length) return ""
    if (position === last) return args.slice(argIndex).join(" ")
    return args[argIndex]
  })
  const usesArgumentsPlaceholder = template.includes("$ARGUMENTS")
  let result = withArgs.replaceAll("$ARGUMENTS", rawArgs)

  if (placeholders.length === 0 && !usesArgumentsPlaceholder && rawArgs.trim()) {
    result = result + "\n\n" + rawArgs
  }

  return result
}
