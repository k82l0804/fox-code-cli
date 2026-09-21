import { Effect, Option, Types } from "effect"
import path from "path"
import os from "os"
import { pathToFileURL } from "url"
import { InstanceState } from "@/effect/instance-state"
import { ConfigMarkdown } from "@/config/markdown"
import * as FoxConfiguredReference from "@/foxcode/reference"
import type { Config } from "@/config/config"
import type { Agent } from "../../agent/agent"
import type { FSUtil } from "@opencode-ai/core/fs-util"
import type { RepositoryCache } from "@opencode-ai/core/repository-cache"
import type { PromptInput } from "./schema"

export interface PartsContext {
  config: Config.Interface
  agents: Agent.Interface
  fsys: FSUtil.Interface
  cache?: RepositoryCache.Interface
}

export function makePartsResolver(ctx: PartsContext) {
  const { config, agents, fsys, cache } = ctx

  const resolveReferenceParts = Effect.fnUntraced(function* (template: string, skip = new Set<string>()) {
    const instanceCtx = yield* InstanceState.context
    const cfg = yield* config.get()
    const refs = FoxConfiguredReference.resolveAll({
      references: cfg.references ?? cfg.reference ?? {},
      directory: instanceCtx.directory,
      worktree: instanceCtx.worktree,
    }).filter((item) => item.kind !== "invalid")
    const parts: Types.DeepMutable<PromptInput["parts"]> = []
    const seen = new Set<string>()
    for (const match of ConfigMarkdown.files(template)) {
      const name = match[1]
      if (!name) continue
      const alias = name.split("/")[0]
      if (!alias || seen.has(alias)) continue
      const reference = refs.find((item) => item.name === alias)
      if (!reference) continue
      seen.add(alias)
      const url = pathToFileURL(reference.path).href
      if (skip.has(url)) continue
      if (reference.kind === "git" && cache) yield* FoxConfiguredReference.ensure(cache, reference)
      const start = match.index ?? 0
      parts.push({
        type: "file",
        url,
        filename: alias,
        mime: "application/x-directory",
        source: { type: "file", text: { value: match[0], start, end: start + match[0].length }, path: alias },
      })
    }
    return parts
  })

  const resolvePromptParts = Effect.fn("SessionPrompt.resolvePromptParts")(function* (template: string) {
    const instanceCtx = yield* InstanceState.context
    const roots = yield* resolveReferenceParts(template)
    const parts: Types.DeepMutable<PromptInput["parts"]> = [{ type: "text", text: template }, ...roots]
    const files = ConfigMarkdown.files(template)
    const seen = new Set<string>()
    const configured = new Set(
      roots.flatMap((part) => (part.type === "file" && part.filename ? [part.filename] : [])),
    )
    yield* Effect.forEach(
      files,
      Effect.fnUntraced(function* (match) {
        const name = match[1]
        if (!name) return
        const alias = name.split("/")[0]
        if (alias && configured.has(alias)) return
        if (seen.has(name)) return
        seen.add(name)

        const filepath = name.startsWith("~/")
          ? path.join(os.homedir(), name.slice(2))
          : path.resolve(instanceCtx.worktree, name)

        const info = yield* fsys.stat(filepath).pipe(Effect.option)
        if (Option.isNone(info)) {
          const found = yield* agents.get(name)
          if (found) parts.push({ type: "agent", name: found.name })
          return
        }
        const stat = info.value
        parts.push({
          type: "file",
          url: pathToFileURL(filepath).href,
          filename: name,
          mime: stat.type === "Directory" ? "application/x-directory" : "text/plain",
        })
      }),
      { concurrency: "unbounded", discard: true },
    )
    return parts
  })

  return { resolveReferenceParts, resolvePromptParts }
}
