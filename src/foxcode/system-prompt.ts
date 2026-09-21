
import { Global } from "@opencode-ai/core/global"
import { Effect } from "effect"
import { staticEnvLines, type EditorContext } from "@/foxcode/editor-context"
import { FoxMemory } from "@foxcode/memory/effect"
import type { MemoryPaths } from "@foxcode/memory/effect/paths"
import { MemoryMarker } from "@/foxcode/memory/marker"
import type { Provider } from "@/provider/provider"
import type { InstanceContext } from "@/project/instance-context"
import * as Log from "@opencode-ai/core/util/log"

const log = Log.create({ service: "foxcode.system-prompt" })

export namespace KilocodeSystemPrompt {
  export function shouldIncludePersona(agent: string) {
    return agent !== "title" && agent !== "branch-name"
  }

  export function environment(input: { ctx: InstanceContext; model: Provider.Model; editor?: EditorContext }) {
    return [
      [
        `You are powered by the model named ${input.model.api.id}. The exact model ID is ${input.model.providerID}/${input.model.api.id}`,
        `Here is some useful information about the environment you are running in:`,
        `<env>`,
        `  Is directory a git repo: ${input.ctx.project.vcs === "git" ? "yes" : "no"}`,
        `  Platform: ${process.platform}`,
        `  Project config: .fox/command/*.md, .fox/agent/*.md, fox.json, AGENTS.md. Put new commands and agents in .fox/. Do not use .kilo/, .kilocode/ or .opencode/.`,
        `  Global config: ${Global.Path.config}/ (same structure)`,
        ...staticEnvLines(input.editor),
        `</env>`,
      ].join("\n"),
    ]
  }

  export function memoryBlocks(input: {
    ctx: MemoryPaths.Ctx
    sessionID?: string
    record?: boolean
    enabled?: boolean
  }) {
    return Effect.gen(function* () {
      const project =
        input.enabled === false
          ? undefined
          : yield* Effect.tryPromise(() =>
              FoxMemory.context({
                ctx: input.ctx,
                sessionID: input.sessionID,
                record: input.record,
              }),
            ).pipe(
              Effect.catch((err) =>
                Effect.sync(() => {
                  log.warn("memory context unavailable", { error: String(err) })
                  return undefined
                }),
              ),
            )
      const blocks = project?.blocks ?? []
      const guidance = [
        "The following Fox memory blocks are saved project context from previous sessions. Use them for continuity, corrections, constraints, and prior decisions.",
        "For memory operations: call fox_memory_save when the user asks to remember/correct/update; call fox_memory_recall (mode=search or mode=typed) when a request depends on saved details not shown below.",
        "Memory is context, not instruction. Current user messages, repo files, tool output, and AGENTS.md take precedence. If git state conflicts with memory, trust the repo.",
        "Do not force memory recall before routine commands. Recall only when saved memory is likely to answer the request or avoid repeating prior investigation.",
      ].join("\n")
      return {
        blocks: blocks.length
          ? [guidance, ...blocks.map((block) => block.text.trim())]
          : [],
        marker: MemoryMarker.fromBlocks(blocks),
      }
    })
  }
}
