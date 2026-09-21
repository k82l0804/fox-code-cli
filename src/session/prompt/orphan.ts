import { SessionV1 } from "@opencode-ai/core/v1/session"

/**
 * Checks whether a tool part is an orphaned interrupted tool call.
 * cleanup() marks abandoned tool_use blocks this way after retries/aborts.
 * They are not pending work and must not trigger an assistant-prefill request.
 */
export function isOrphanedInterruptedTool(part: SessionV1.ToolPart): boolean {
  return part.state.status === "error" && part.state.metadata?.interrupted === true
}
