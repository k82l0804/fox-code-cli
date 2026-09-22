import { Schema } from "effect"
import * as SchemaPermissionV1 from "@opencode-ai/schema/permission-v1"
import { ID } from "@opencode-ai/schema/permission-v1"

export {
  ID,
  Action,
  Rule,
  Ruleset,
  Request,
  Reply,
  ReplyBody,
  Approval,
  AskInput,
  ReplyInput,
  Event,
} from "@opencode-ai/schema/permission-v1"

export class RejectedError extends Schema.TaggedErrorClass<RejectedError>()("PermissionRejectedError", {}) {
  override get message() {
    return "The user rejected permission to use this specific tool call."
  }
}

export class CorrectedError extends Schema.TaggedErrorClass<CorrectedError>()("PermissionCorrectedError", {
  feedback: Schema.String,
}) {
  override get message() {
    return `The user rejected permission to use this specific tool call with the following feedback: ${this.feedback}`
  }
}

export class DeniedError extends Schema.TaggedErrorClass<DeniedError>()("PermissionDeniedError", {
  ruleset: Schema.Any,
}) {
  override get message() {
    return `The user has specified a rule which prevents you from using this specific tool call. Here are some of the relevant rules ${JSON.stringify(this.ruleset)}`
  }
}

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("Permission.NotFoundError", {
  requestID: ID,
}) {}

export type Error = DeniedError | RejectedError | CorrectedError

export const PermissionV1 = {
  ...SchemaPermissionV1,
  RejectedError,
  CorrectedError,
  DeniedError,
  NotFoundError,
}

export namespace PermissionV1 {
  export type ID = SchemaPermissionV1.ID
  export type Action = SchemaPermissionV1.Action
  export type Rule = SchemaPermissionV1.Rule
  export type Ruleset = SchemaPermissionV1.Ruleset
  export type Request = SchemaPermissionV1.Request
  export type Reply = SchemaPermissionV1.Reply
  export type ReplyBody = SchemaPermissionV1.ReplyBody
  export type Approval = SchemaPermissionV1.Approval
  export type AskInput = SchemaPermissionV1.AskInput
  export type ReplyInput = SchemaPermissionV1.ReplyInput
  export type RejectedError = InstanceType<typeof RejectedError>
  export type CorrectedError = InstanceType<typeof CorrectedError>
  export type DeniedError = InstanceType<typeof DeniedError>
  export type NotFoundError = InstanceType<typeof NotFoundError>
  export type Error = DeniedError | RejectedError | CorrectedError
}

