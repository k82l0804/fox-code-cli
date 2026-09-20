import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Context, Effect, Layer } from "effect"

import { InstanceState } from "@/effect/instance-state"

import PROMPT_DEFAULT from "./prompt/default.txt"
import PROMPT_DEFAULT_COMPACT from "./prompt/default-compact.txt"
import PROMPT_LOCAL from "./prompt/local.txt"
import PROMPTS_MAP from "./prompt/prompts.json"
import { Flag } from "@opencode-ai/core/flag/flag"
import type { Provider } from "@/provider/provider"
import type { Agent } from "@/agent/agent"
import { Permission } from "@/permission"
import { Skill } from "@/skill"
import { LocationServiceMap, locationServiceMapLayer } from "@opencode-ai/core/location-services"
import { MCP } from "@/mcp"
import { PermissionV1 } from "@opencode-ai/core/v1/permission"
import SOUL from "../foxcode/soul.txt"
import SOUL_COMPACT from "../foxcode/soul-compact.txt"
import type { EditorContext } from "../foxcode/editor-context"
import { KilocodeSystemPrompt } from "../foxcode/system-prompt"
import { Config } from "@/config/config"
import * as FoxReference from "@/foxcode/reference"

const PROMPT_FILES: Record<string, string> = {
  "default.txt": PROMPT_DEFAULT,
  "local.txt": PROMPT_LOCAL,
}

const PROMPT_FILES_COMPACT: Record<string, string> = {
  "default.txt": PROMPT_DEFAULT_COMPACT,
  "local.txt": PROMPT_LOCAL, // local.txt is already compact
}

export function soul() {
  return (Flag.FOX_EXPERIMENTAL_COMPRESS ? SOUL_COMPACT : SOUL).trim()
}

export function provider(model: Provider.Model) {
  const files = Flag.FOX_EXPERIMENTAL_COMPRESS ? PROMPT_FILES_COMPACT : PROMPT_FILES
  const fallback = Flag.FOX_EXPERIMENTAL_COMPRESS ? PROMPT_DEFAULT_COMPACT : PROMPT_DEFAULT
  const key = `${model.providerID}/${model.api.id}`.toLowerCase()
  for (const entry of PROMPTS_MAP.prompts) {
    if (entry.match.some((pattern: string) => key.includes(pattern.toLowerCase()))) {
      const prompt = files[entry.file]
      if (prompt) return [prompt]
    }
  }
  return [files[PROMPTS_MAP.default] ?? fallback]
}

export interface Interface {
  readonly environment: (model: Provider.Model, editorContext?: EditorContext) => Effect.Effect<string[]>
  readonly skills: (agent: Agent.Info) => Effect.Effect<string | undefined>
  readonly mcp: (agent: Agent.Info, permission?: PermissionV1.Ruleset) => Effect.Effect<string | undefined>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SystemPrompt") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const skill = yield* Skill.Service
    const mcp = yield* MCP.Service
    const locations = yield* LocationServiceMap.Service
    const config = yield* Config.Service
    return Service.of({
      environment: Effect.fn("SystemPrompt.environment")(function* (
        model: Provider.Model,
        editorContext?: EditorContext,
      ) {
        const ctx = yield* InstanceState.context
        const cfg = yield* config.get()
        const references = yield* FoxReference.list(
          {
            references: cfg.references ?? cfg.reference ?? {},
            directory: ctx.directory,
            worktree: ctx.worktree,
          },
          locations,
        ).pipe(Effect.map((references) => references.filter((reference) => reference.description !== undefined)))
        return [
          ...KilocodeSystemPrompt.environment({ ctx, model, editor: editorContext }),
          references.length === 0
            ? undefined
            : [
                "Project references provide additional directories that can be accessed when relevant.",
                "<available_references>",
                ...references
                  .toSorted((a, b) => a.name.localeCompare(b.name))
                  .flatMap((reference) => [
                    "  <reference>",
                    `    <name>${reference.name}</name>`,
                    `    <path>${reference.path}</path>`,
                    ...(reference.description === undefined
                      ? []
                      : [`    <description>${reference.description}</description>`]),
                    "  </reference>",
                  ]),
                "</available_references>",
              ].join("\n"),
        ].filter((part): part is string => part !== undefined)
      }),
      skills: Effect.fn("SystemPrompt.skills")(function* (agent: Agent.Info) {
        if (Permission.disabled(["skill"], agent.permission).has("skill")) return

        const list = yield* skill.available(agent)

        return [
          "Skills provide specialized instructions and workflows for specific tasks.",
          "Use the skill tool to load a skill when a task matches its description.",
          // the agents seem to ingest the information about skills a bit better if we present a more verbose
          // version of them here and a less verbose version in tool description, rather than vice versa.
          Skill.fmt(list, { verbose: true }),
        ].join("\n")
      }),

      mcp: Effect.fn("SystemPrompt.mcp")(function* (agent: Agent.Info, permission?: PermissionV1.Ruleset) {
        const ruleset = Permission.merge(agent.permission, permission ?? [])
        const instructions = (yield* mcp.instructions()).filter(
          (item) => item.tools.length === 0 || Permission.disabled(item.tools, ruleset).size < item.tools.length,
        )
        if (instructions.length === 0) return

        return [
          "<mcp_instructions>",
          ...instructions.flatMap((item) => [
            `  <server name="${item.name}">`,
            ...item.instructions.split("\n").map((line) => `    ${line}`),
            "  </server>",
          ]),
          "</mcp_instructions>",
        ].join("\n")
      }),
    })
  }),
)

const locationServiceMapNode = LayerNode.make({
  service: LocationServiceMap.Service,
  layer: locationServiceMapLayer,
  deps: [],
})

export const node = LayerNode.make({
  service: Service,
  layer: layer,
  deps: [Skill.node, MCP.node, Config.node, locationServiceMapNode],
})

export * as SystemPrompt from "./system"
