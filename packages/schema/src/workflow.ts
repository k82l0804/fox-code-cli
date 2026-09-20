import { Schema } from "effect"

export const Workflow = Schema.Literals(["swe", "data", "research", "shell", "none", "auto"]).annotate({
  identifier: "Agent.Workflow",
  description: "The operational domain and token compression profile for this agent",
})
export type Workflow = typeof Workflow.Type

export const WORKFLOWS = ["swe", "data", "research", "shell", "none", "auto"] as const
