import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiError, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "@/server/routes/instance/httpapi/middleware/authorization"
import { InstanceContextMiddleware } from "@/server/routes/instance/httpapi/middleware/instance-context"
import {
  WorkspaceRoutingMiddleware,
  WorkspaceRoutingQuery,
  WorkspaceRoutingQueryFields,
} from "@/server/routes/instance/httpapi/middleware/workspace-routing"
import { described } from "@/server/routes/instance/httpapi/groups/metadata"
import { ProviderUsage } from "@opencode-ai/schema/foxcode/provider-usage"
import {
  Failure as AgentManagerFailure,
  Request as AgentManagerRequest,
  RequestID as AgentManagerRequestID,
  Result as AgentManagerResult,
} from "@/foxcode/agent-manager/protocol"
import {
  Failure as NotebookFailure,
  Request as NotebookRequest,
  RequestID as NotebookRequestID,
  Result as NotebookResult,
} from "@/foxcode/notebook/protocol"
import { ModelUsage } from "@/foxcode/session/model-usage"
import { MessageID, SessionID } from "@/session/schema"
import {
  ApiNotFoundError,
  ConflictError,
  InvalidRequestError,
  UnknownError,
} from "@/server/routes/instance/httpapi/errors"
import { BoardStore } from "@/foxcode/board/store"
import { CommandFiles } from "@/foxcode/command-files"
import { Token } from "@opencode-ai/schema/foxcode/session-drain"
import { PendingInfo as WakeupPending } from "@opencode-ai/schema/foxcode/wakeup-event"

const root = "/foxcode"
const Scope = Schema.Literals(["global", "project"])

export const BackgroundJobInfo = Schema.Struct({
  id: Schema.String,
  type: Schema.String,
  title: Schema.optional(Schema.String),
  status: Schema.Literals(["running", "completed", "error", "cancelled"]),
  started_at: Schema.Number,
  completed_at: Schema.optional(Schema.Number),
  error: Schema.optional(Schema.String),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
})

export const BackgroundJobsQuery = Schema.Struct({
  ...WorkspaceRoutingQueryFields,
  sessionID: SessionID,
})

export const RemoveSkillPayload = Schema.Struct({
  location: Schema.String,
})

export const RemoveCommandPayload = Schema.Struct({
  location: Schema.String,
})

export const RemoveAgentPayload = Schema.Struct({
  name: Schema.String,
  scope: Schema.optional(Scope),
})

export const RemoveSnapshotPayload = Schema.Struct({
  worktree: Schema.String,
})

export const TeardownWorktreePayload = Schema.Struct({
  worktree: Schema.String,
})

export const TeardownWorktreeResult = Schema.Struct({
  /** True when a loaded backend instance for the worktree was disposed. */
  disposed: Schema.Boolean,
})

export const ResumeSessionPayload = Schema.Struct({
  messageID: MessageID,
  snapshotInitialization: Schema.optional(Schema.Literal("wait")),
})

export const DrainSessionPayload = Schema.Struct({ token: Token })

export const SessionBoard = BoardStore.SessionBoard
export const SessionBoardQuery = Schema.Struct({
  ...WorkspaceRoutingQueryFields,
  before: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.NumberFromString.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 50 }))),
})
export const ResetSessionBoardPayload = Schema.Struct({
  revision: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
})

export const NotebookReplyPayload = Schema.Struct({ result: NotebookResult })
export const NotebookRejectPayload = Schema.Struct({ error: NotebookFailure })
export const AgentManagerReplyPayload = Schema.Struct({ result: AgentManagerResult })
export const AgentManagerRejectPayload = Schema.Struct({ error: AgentManagerFailure })

export const FoxPaths = {
  heapSnapshot: `${root}/heap/snapshot`,
  commandFiles: `${root}/command/files`,
  removeCommand: `${root}/command/remove`,
  removeSkill: `${root}/skill/remove`,
  removeAgent: `${root}/agent/remove`,
  removeSnapshot: `${root}/snapshot/remove`,
  teardownWorktree: `${root}/worktree/teardown`,
  prepareSnapshot: `${root}/snapshot/prepare`,
  providerUsage: `${root}/provider-usage`,
  providerUsageRefresh: `${root}/provider-usage/refresh`,
  notebookList: `${root}/notebook`,
  notebookReply: `${root}/notebook/:requestID/reply`,
  notebookReject: `${root}/notebook/:requestID/reject`,
  agentManagerList: `${root}/agent-manager`,
  agentManagerReply: `${root}/agent-manager/:requestID/reply`,
  agentManagerReject: `${root}/agent-manager/:requestID/reject`,
  sessionModelUsage: `/session/:sessionID/model-usage`,
  resumeSession: `${root}/session/:sessionID/resume`,
  drainSession: `${root}/session/:sessionID/drain`,
  sessionBoard: `${root}/session/:sessionID/board`,
  resetSessionBoard: `${root}/session/:sessionID/board/reset`,
  backgroundJobs: `${root}/background-jobs`,
  backgroundJobCancel: `${root}/background-jobs/:jobID/cancel`,
  backgroundJobPromote: `${root}/background-jobs/:jobID/promote`,
  wakeups: `${root}/wakeups`,
} as const

export const FoxcodeApi = HttpApi.make("foxcode")
  .add(
    HttpApiGroup.make("foxcode")
      .add(
        HttpApiEndpoint.post("resumeSession", FoxPaths.resumeSession, {
          params: { sessionID: SessionID },
          query: WorkspaceRoutingQuery,
          payload: ResumeSessionPayload,
          success: described(Schema.Boolean, "Session continuation accepted"),
          error: [ApiNotFoundError, InvalidRequestError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.resumeSession",
            summary: "Resume an interrupted session",
            description:
              "Resume the specified unfinished assistant turn without adding a user message. Active, completed, reverted, and blocked sessions cannot be resumed.",
          }),
        ),
        HttpApiEndpoint.post("drainSession", FoxPaths.drainSession, {
          params: { sessionID: SessionID },
          query: WorkspaceRoutingQuery,
          payload: DrainSessionPayload,
          success: described(Schema.Boolean, "Session work drained"),
          error: ApiNotFoundError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.drainSession",
            summary: "Wait for session completion",
            description:
              "Wait for active session work and background result delivery, then publish the matching drain acknowledgment.",
          }),
        ),
        HttpApiEndpoint.get("sessionBoard", FoxPaths.sessionBoard, {
          params: { sessionID: SessionID },
          query: SessionBoardQuery,
          success: described(SessionBoard, "Shared board snapshot"),
          error: [ApiNotFoundError, InvalidRequestError, ConflictError, UnknownError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.sessionBoard",
            summary: "Observe a session's shared board",
            description: "Read stored board messages without changing the board.",
          }),
        ),
        HttpApiEndpoint.post("resetSessionBoard", FoxPaths.resetSessionBoard, {
          params: { sessionID: SessionID },
          query: WorkspaceRoutingQuery,
          payload: ResetSessionBoardPayload,
          success: described(SessionBoard, "Shared board after reset"),
          error: [ApiNotFoundError, InvalidRequestError, ConflictError, UnknownError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.resetSessionBoard",
            summary: "Clear a session's shared board",
            description: "Clear visible messages without changing conversations or running tasks.",
          }),
        ),
        HttpApiEndpoint.post("heapSnapshot", FoxPaths.heapSnapshot, {
          query: WorkspaceRoutingQuery,
          success: described(Schema.String, "Heap snapshot file path"),
          error: HttpApiError.BadRequest,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.heap.snapshot",
            summary: "Write heap snapshot",
            description: "Write a heap snapshot for the CLI process to the log directory.",
          }),
        ),
        HttpApiEndpoint.get("commandFiles", FoxPaths.commandFiles, {
          query: WorkspaceRoutingQuery,
          success: described(Schema.Array(CommandFiles.Info), "Command files"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.commandFiles",
            summary: "List command files",
            description: "List commands with editable file locations for settings clients.",
          }),
        ),
        HttpApiEndpoint.post("removeCommand", FoxPaths.removeCommand, {
          query: WorkspaceRoutingQuery,
          payload: RemoveCommandPayload,
          success: described(Schema.Boolean, "Command removed"),
          error: HttpApiError.BadRequest,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.removeCommand",
            summary: "Remove a command",
            description: "Remove a command by deleting its markdown file from disk and clearing it from cache.",
          }),
        ),
        HttpApiEndpoint.post("removeSkill", FoxPaths.removeSkill, {
          query: WorkspaceRoutingQuery,
          payload: RemoveSkillPayload,
          success: described(Schema.Boolean, "Skill removed"),
          error: HttpApiError.BadRequest,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.removeSkill",
            summary: "Remove a skill",
            description: "Remove a skill by deleting its manifest from disk and clearing it from cache.",
          }),
        ),
        HttpApiEndpoint.post("removeAgent", FoxPaths.removeAgent, {
          query: WorkspaceRoutingQuery,
          payload: RemoveAgentPayload,
          success: described(Schema.Boolean, "Agent removed"),
          error: HttpApiError.BadRequest,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.removeAgent",
            summary: "Remove a custom agent",
            description:
              "Remove a custom (non-native) agent from one writable configuration scope, or every writable scope when omitted, and dispose cached instance state.",
          }),
        ),
        HttpApiEndpoint.post("removeSnapshot", FoxPaths.removeSnapshot, {
          query: WorkspaceRoutingQuery,
          payload: RemoveSnapshotPayload,
          success: described(Schema.Boolean, "Snapshot repository removed"),
          error: HttpApiError.BadRequest,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.removeSnapshot",
            summary: "Remove a snapshot repository",
            description: "Remove the snapshot repository for an already deleted Agent Manager worktree.",
          }),
        ),
        HttpApiEndpoint.post("teardownWorktree", FoxPaths.teardownWorktree, {
          query: WorkspaceRoutingQuery,
          payload: TeardownWorktreePayload,
          success: described(TeardownWorktreeResult, "Worktree backend teardown result"),
          error: HttpApiError.BadRequest,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.teardownWorktree",
            summary: "Tear down backend state for a managed worktree",
            description:
              "Kill the PTYs rooted in an Agent Manager worktree and dispose its backend instance when one is loaded, without booting an instance for the directory.",
          }),
        ),
        HttpApiEndpoint.post("prepareSnapshot", FoxPaths.prepareSnapshot, {
          query: WorkspaceRoutingQuery,
          success: described(
            Schema.Struct({ prepared: Schema.Boolean, durationMs: Schema.Number }),
            "Snapshot repository preparation result",
          ),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.snapshot.prepare",
            summary: "Prepare a snapshot repository",
            description:
              "Initialize and seed snapshots for the routed directory without creating a session or tracking ref.",
          }),
        ),
        HttpApiEndpoint.get("providerUsage", FoxPaths.providerUsage, {
          query: WorkspaceRoutingQuery,
          success: described(ProviderUsage.Info, "Current provider usage"),
          error: HttpApiError.ServiceUnavailable,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.providerUsage.get",
            summary: "Get provider usage",
            description: "Get cache-aware, secret-free provider plan usage and personal billing status.",
          }),
        ),
        HttpApiEndpoint.post("providerUsageRefresh", FoxPaths.providerUsageRefresh, {
          query: WorkspaceRoutingQuery,
          success: described(ProviderUsage.Info, "Refreshed provider usage"),
          error: HttpApiError.ServiceUnavailable,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.providerUsage.refresh",
            summary: "Refresh provider usage",
            description: "Refresh provider plan usage while coalescing concurrent source requests.",
          }),
        ),
        HttpApiEndpoint.get("notebookList", FoxPaths.notebookList, {
          query: WorkspaceRoutingQuery,
          success: described(Schema.Array(NotebookRequest), "Pending notebook host requests"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.notebook.list",
            summary: "List pending notebook requests",
            description: "List pending native notebook requests for the routed workspace.",
          }),
        ),
        HttpApiEndpoint.post("notebookReply", FoxPaths.notebookReply, {
          params: { requestID: NotebookRequestID },
          query: WorkspaceRoutingQuery,
          payload: NotebookReplyPayload,
          success: described(Schema.Boolean, "Notebook reply accepted"),
          error: [HttpApiError.BadRequest, HttpApiError.NotFound],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.notebook.reply",
            summary: "Reply to a notebook request",
            description: "Complete a pending native notebook request with a structured result.",
          }),
        ),
        HttpApiEndpoint.post("notebookReject", FoxPaths.notebookReject, {
          params: { requestID: NotebookRequestID },
          query: WorkspaceRoutingQuery,
          payload: NotebookRejectPayload,
          success: described(Schema.Boolean, "Notebook rejection accepted"),
          error: HttpApiError.NotFound,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.notebook.reject",
            summary: "Reject a notebook request",
            description: "Complete a pending native notebook request with a structured host error.",
          }),
        ),
        HttpApiEndpoint.get("agentManagerList", FoxPaths.agentManagerList, {
          query: WorkspaceRoutingQuery,
          success: described(Schema.Array(AgentManagerRequest), "Pending Agent Manager host requests"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.agentManager.list",
            summary: "List pending Agent Manager requests",
            description: "List pending native Agent Manager orchestration requests for the routed workspace.",
          }),
        ),
        HttpApiEndpoint.post("agentManagerReply", FoxPaths.agentManagerReply, {
          params: { requestID: AgentManagerRequestID },
          query: WorkspaceRoutingQuery,
          payload: AgentManagerReplyPayload,
          success: described(Schema.Boolean, "Agent Manager reply accepted"),
          error: [HttpApiError.BadRequest, HttpApiError.NotFound],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.agentManager.reply",
            summary: "Reply to an Agent Manager request",
            description: "Complete a pending Agent Manager orchestration request with a structured result.",
          }),
        ),
        HttpApiEndpoint.post("agentManagerReject", FoxPaths.agentManagerReject, {
          params: { requestID: AgentManagerRequestID },
          query: WorkspaceRoutingQuery,
          payload: AgentManagerRejectPayload,
          success: described(Schema.Boolean, "Agent Manager rejection accepted"),
          error: HttpApiError.NotFound,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.agentManager.reject",
            summary: "Reject an Agent Manager request",
            description: "Complete a pending Agent Manager orchestration request with a structured host error.",
          }),
        ),
        HttpApiEndpoint.get("sessionModelUsage", FoxPaths.sessionModelUsage, {
          params: { sessionID: SessionID },
          query: WorkspaceRoutingQuery,
          success: described(ModelUsage.Info, "Model usage for a session tree"),
          error: HttpApiError.NotFound,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.sessionModelUsage",
            summary: "Get session model usage",
            description: "Get token usage and direct cost by model for the complete top-level session tree.",
          }),
        ),
        HttpApiEndpoint.get("backgroundJobs", FoxPaths.backgroundJobs, {
          query: BackgroundJobsQuery,
          success: described(Schema.Array(BackgroundJobInfo), "Background jobs"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.backgroundJobs",
            summary: "List background jobs",
            description: "List background subagent jobs owned by one parent session.",
          }),
        ),
        HttpApiEndpoint.post("backgroundJobCancel", FoxPaths.backgroundJobCancel, {
          params: { jobID: Schema.String },
          query: WorkspaceRoutingQuery,
          success: described(Schema.Boolean, "Background job cancelled"),
          error: HttpApiError.NotFound,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.backgroundJob.cancel",
            summary: "Cancel background job",
            description: "Cancel one background subagent job and its session tree.",
          }),
        ),
        HttpApiEndpoint.post("backgroundJobPromote", FoxPaths.backgroundJobPromote, {
          params: { jobID: Schema.String },
          query: WorkspaceRoutingQuery,
          success: described(Schema.Boolean, "Background job promoted"),
          error: HttpApiError.NotFound,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.backgroundJob.promote",
            summary: "Promote background job",
            description: "Continue one foreground subagent in the background.",
          }),
        ),
        HttpApiEndpoint.get("wakeups", FoxPaths.wakeups, {
          query: WorkspaceRoutingQuery,
          success: described(Schema.Array(WakeupPending), "Pending wakeups for the routed directory"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "foxcode.wakeups",
            summary: "List pending wakeups",
            description:
              "List the sessions that hold scheduled wakeups in the routed directory, with each session's pending count.",
          }),
        ),
      )
      .annotateMerge(
        OpenApi.annotations({
          title: "foxcode",
          description: "Fox-specific routes.",
        }),
      )
      .middleware(InstanceContextMiddleware)
      .middleware(WorkspaceRoutingMiddleware)
      .middleware(Authorization),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "fox HttpApi",
      version: "0.0.1",
      description: "Fox HttpApi surface.",
    }),
  )

export { FoxcodeApi as KilocodeApi }
