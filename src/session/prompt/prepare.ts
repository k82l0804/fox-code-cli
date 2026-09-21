import { Cause, Effect, Exit, Option, Schema, Types } from "effect"
import path from "path"
import { fileURLToPath } from "url"
import { MessageID, PartID, type SessionID } from "../schema"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { MessageV2 } from "../message-v2"
import { NamedError } from "@opencode-ai/core/util/error"
import { InstanceState } from "@/effect/instance-state"
import { InstanceRef } from "@/effect/instance-ref"
import { Instance } from "@/foxcode/instance"
import { Provider } from "@/provider/provider"
import { Session } from "../session"
import { Permission } from "@/permission"
import { Tool } from "@/tool/tool"
import { Image } from "@/image/image"
import { decodeDataUrl } from "@/util/data-url"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { isInterrupted } from "@/foxcode/effect/cause"
import * as FoxConfiguredReference from "@/foxcode/reference"
import * as SandboxPolicy from "@/foxcode/sandbox/policy"
import { SessionTranscript } from "@/foxcode/session/transcript"
import { FoxSessionPrompt } from "@/foxcode/session/prompt"
import { FoxReadObject } from "@/foxcode/tool/read-object"
import { FoxReference } from "@/foxcode/reference/contains"
import { assertExternalDirectoryEffect } from "@/tool/external-directory"
import { Config } from "@/config/config"
import { Database } from "@opencode-ai/core/database/database"
import {
  MAX_MCP_RESOURCE_BLOB_BYTES,
  SUPPORTED_MCP_RESOURCE_ATTACHMENT_MIMES,
  formatMcpResourceBytes,
  mcpResourceBase64Size,
} from "./attachment"
import type { PromptInput } from "./schema"
import type { Agent } from "../../agent/agent"
import type { EventV2 } from "@opencode-ai/core/event"
import type { Instruction } from "../instruction"
import type { Plugin } from "../../plugin"
import type { RuntimeFlags } from "@/effect/runtime-flags"
import type { MCP } from "../../mcp"
import type { LSP } from "@/lsp/lsp"
import type { ToolRegistry } from "@/tool/registry"
import type { ProviderV2 } from "@opencode-ai/core/provider"
import type { ModelV2 } from "@opencode-ai/core/model"

const decodeMessageInfo = Schema.decodeUnknownExit(SessionV1.Info)
const decodeMessagePart = Schema.decodeUnknownExit(SessionV1.Part)

export interface PrepareContext {
  sessions: Session.Interface
  agents: Agent.Interface
  events: EventV2.Interface
  provider: Provider.Interface
  instruction: Instruction.Interface
  config: Config.Interface
  plugin: Plugin.Interface
  fsys: FSUtil.Interface
  flags: typeof RuntimeFlags.Service.Service
  mcp: MCP.Interface
  lsp: LSP.Interface
  registry: ToolRegistry.Interface
  image: Image.Interface
  database: Database.Interface
  permission: Permission.Interface
  currentModel: (sessionID: SessionID) => Effect.Effect<{
    providerID: ProviderV2.ID
    modelID: ModelV2.ID
    variant?: string
  }>
  resolveReferenceParts: (template: string, skip?: Set<string>) => Effect.Effect<PromptInput["parts"]>
}

type Draft<T> = T extends SessionV1.Part ? Omit<T, "id"> & { id?: string } : never

export function makePreparer(ctx: PrepareContext) {
  const {
    sessions,
    agents,
    events,
    provider,
    instruction,
    config,
    plugin,
    fsys,
    mcp,
    lsp,
    registry,
    image,
    database,
    permission,
    currentModel,
    resolveReferenceParts,
  } = ctx

  const prepare = Effect.fn("SessionPrompt.prepare")(function* (input: PromptInput, defer = false) {
    const agentName = input.agent ?? (yield* sessions.get(input.sessionID).pipe(Effect.orDie)).agent
    const ag = agentName ? yield* agents.get(agentName) : yield* agents.defaultInfo()
    if (!ag) {
      const available = (yield* agents.list()).filter((a) => !a.hidden).map((a) => a.name)
      const hint = available.length ? ` Available agents: ${available.join(", ")}` : ""
      const error = new NamedError.Unknown({ message: `Agent not found: "${agentName}".${hint}` })
      if (!defer) yield* events.publish(Session.Event.Error, { sessionID: input.sessionID, error: error.toObject() })
      throw error
    }
    const model = input.model ?? ag.model ?? (yield* currentModel(input.sessionID))
    const stored = !input.model && !ag.model ? model : undefined
    const same = ag.model && model.providerID === ag.model.providerID && model.modelID === ag.model.modelID
    const full =
      !input.variant && ag.variant && same
        ? yield* provider
            .getModel(model.providerID, model.modelID)
            .pipe(Effect.catchIf(Provider.ModelNotFoundError.isInstance, () => Effect.succeed(undefined)))
        : undefined
    const variant =
      input.variant ??
      (stored && "variant" in stored && typeof stored.variant === "string" ? stored.variant : undefined) ??
      (ag.variant && full?.variants?.[ag.variant] ? ag.variant : undefined)
    const info: SessionV1.User = {
      id: input.messageID ?? MessageID.ascending(),
      role: "user",
      sessionID: input.sessionID,
      time: { created: Date.now() },
      tools: input.tools,
      agent: ag.name,
      model: {
        providerID: model.providerID,
        modelID: model.modelID,
        variant,
      },
      system: input.system,
      format: input.format,
      editorContext: input.editorContext,
    }
    const select = Effect.gen(function* () {
      const current = yield* sessions.get(input.sessionID).pipe(Effect.orDie)
      if (
        current.agent !== info.agent ||
        current.model?.providerID !== info.model.providerID ||
        current.model?.id !== info.model.modelID ||
        (current.model?.variant === "default" ? undefined : current.model?.variant) !== info.model.variant
      ) {
        yield* sessions.setAgentModel({
          sessionID: input.sessionID,
          agent: info.agent,
          model: {
            id: info.model.modelID,
            providerID: info.model.providerID,
            variant: info.model.variant ?? "default",
          },
          time: info.time.created,
        })
      }
    })
    if (!defer) yield* select
    yield* Effect.addFinalizer(() => instruction.clear(info.id))

    const assign = (part: Draft<SessionV1.Part>): SessionV1.Part => ({
      ...part,
      id: part.id ? PartID.make(part.id) : PartID.ascending(),
    })

    const instanceCtx = yield* InstanceState.context
    const references = FoxConfiguredReference.resolveAll({
      references: (yield* config.get()).reference ?? {},
      directory: instanceCtx.directory,
      worktree: instanceCtx.worktree,
    }).filter((item) => item.kind !== "invalid")

    const referenceContextFromFilePart = Effect.fnUntraced(function* (
      part: Extract<PromptInput["parts"][number], { type: "file" }>,
      filepath: string,
    ) {
      const name = part.filename?.replace(/#\d+(?:-\d*)?$/, "")
      if (!name) return
      const slash = name.indexOf("/")
      if (slash === -1) return

      const reference = references.find((item) => item.name === name.slice(0, slash))
      if (!reference) return
      if (!FSUtil.contains(reference.path, filepath)) return

      return { root: reference.path }
    })
    const networkRestricted = yield* SandboxPolicy.networkRestricted(input.sessionID).pipe(
      Effect.provideService(Config.Service, config),
      Effect.provideService(Database.Service, database),
      Effect.provideService(InstanceRef, Instance.current),
    )
    const resolvePart: (part: PromptInput["parts"][number]) => Effect.Effect<Draft<SessionV1.Part>[]> = Effect.fn(
      "SessionPrompt.resolveUserPart",
    )(function* (part) {
      if (part.type === "file") {
        if (part.source?.type === "resource") {
          const { clientName, uri } = part.source
          yield* Effect.logInfo("mcp resource", { clientName, uri, mime: part.mime })
          const pieces: Draft<SessionV1.Part>[] = [
            {
              messageID: info.id,
              sessionID: input.sessionID,
              type: "text",
              synthetic: true,
              text: `Reading MCP resource: ${part.filename} (${uri})`,
            },
          ]
          const exit = yield* (
            networkRestricted
              ? Effect.fail(new Error("Sandbox denied MCP resource access"))
              : mcp.readResource(clientName, uri)
          ).pipe(Effect.exit)
          if (Exit.isSuccess(exit)) {
            const content = exit.value
            if (!content) throw new Error(`Resource not found: ${clientName}/${uri}`)
            const items = Array.isArray(content.contents) ? content.contents : [content.contents]
            for (const c of items) {
              if (!c || typeof c !== "object") continue
              if ("text" in c && typeof c.text === "string" && c.text) {
                pieces.push({
                  messageID: info.id,
                  sessionID: input.sessionID,
                  type: "text",
                  synthetic: true,
                  text: c.text,
                })
              } else if ("blob" in c && typeof c.blob === "string" && c.blob) {
                const mime = "mimeType" in c && typeof c.mimeType === "string" ? c.mimeType : part.mime
                const filename = "uri" in c && typeof c.uri === "string" ? c.uri : part.filename
                const size = mcpResourceBase64Size(c.blob)
                if (!SUPPORTED_MCP_RESOURCE_ATTACHMENT_MIMES.has(mime)) {
                  pieces.push({
                    messageID: info.id,
                    sessionID: input.sessionID,
                    type: "text",
                    synthetic: true,
                    text: `[Binary MCP resource omitted: ${filename ?? uri} (${mime}, ${formatMcpResourceBytes(size)}) is not a supported attachment type]`,
                  })
                  continue
                }
                if (size > MAX_MCP_RESOURCE_BLOB_BYTES) {
                  pieces.push({
                    messageID: info.id,
                    sessionID: input.sessionID,
                    type: "text",
                    synthetic: true,
                    text: `[Binary MCP resource omitted: ${filename ?? uri} (${mime}, ${formatMcpResourceBytes(size)}) exceeds ${formatMcpResourceBytes(MAX_MCP_RESOURCE_BLOB_BYTES)}]`,
                  })
                  continue
                }
                pieces.push({
                  messageID: info.id,
                  sessionID: input.sessionID,
                  type: "text",
                  synthetic: true,
                  text: `[Binary MCP resource attached: ${filename ?? uri} (${mime})]`,
                })
                pieces.push({
                  messageID: info.id,
                  sessionID: input.sessionID,
                  type: "file",
                  mime,
                  filename,
                  url: `data:${mime};base64,${c.blob}`,
                })
              }
            }
          } else {
            if (defer && isInterrupted(exit.cause)) return yield* Effect.interrupt
            const error = Cause.squash(exit.cause)
            if (defer) return yield* Effect.die(error)
            yield* Effect.logError("failed to read MCP resource", { error, clientName, uri })
            const message = error instanceof Error ? error.message : String(error)
            pieces.push({
              messageID: info.id,
              sessionID: input.sessionID,
              type: "text",
              synthetic: true,
              text: `Failed to read MCP resource ${part.filename}: ${message}`,
            })
          }
          return pieces
        }
        const url = new URL(part.url)
        switch (url.protocol) {
          case "data:":
            if (part.mime === "text/plain") {
              return [
                {
                  messageID: info.id,
                  sessionID: input.sessionID,
                  type: "text",
                  synthetic: true,
                  text: `Called the Read tool with the following input: ${JSON.stringify({ filePath: part.filename })}`,
                },
                {
                  messageID: info.id,
                  sessionID: input.sessionID,
                  type: "text",
                  synthetic: true,
                  text: decodeDataUrl(part.url),
                },
                { ...part, messageID: info.id, sessionID: input.sessionID },
              ]
            }
            if (part.mime.startsWith("image/")) {
              const file: MessageV2.FilePart = {
                ...part,
                id: part.id ? PartID.make(part.id) : PartID.ascending(),
                messageID: info.id,
                sessionID: input.sessionID,
              }
              return [yield* image.normalize(file).pipe(Effect.orDie)]
            }
            break
          case "session:":
            return yield* SessionTranscript.resolve(part, {
              messageID: info.id,
              sessionID: input.sessionID,
              sessions,
            })
          case "file:": {
            yield* Effect.logInfo("file", { mime: part.mime })
            const filepath = fileURLToPath(part.url)
            const reference = yield* referenceContextFromFilePart(part, filepath)
            const mime = (yield* fsys.isDir(filepath)) ? "application/x-directory" : part.mime

            const { read } = yield* registry.named()
            const controller = new AbortController()
            const ask: Tool.Context["ask"] = (request) =>
              Effect.gen(function* () {
                const sess = yield* sessions.get(input.sessionID)
                yield* FoxSessionPrompt.askPermission({
                  permission,
                  agents,
                  sessions,
                  agent: ag,
                  session: sess,
                  request: {
                    ...request,
                    sessionID: input.sessionID,
                  },
                })
              }).pipe(Effect.orDie)
            const toolCtx = (extra?: Tool.Context["extra"]): Tool.Context => ({
              sessionID: input.sessionID,
              abort: controller.signal,
              agent: ag.name,
              messageID: info.id,
              extra: { ...extra, referenceRoot: reference?.root, includeInstructions: false, denyDirectory: true },
              messages: [],
              metadata: () => Effect.void,
              ask,
            })
            const execRead = (args: Parameters<typeof read.execute>[0], extra?: Tool.Context["extra"]) => {
              return read
                .execute(args, toolCtx(extra))
                .pipe(Effect.onInterrupt(() => Effect.sync(() => controller.abort())))
            }

            if (mime === "text/plain") {
              let offset: number | undefined
              let limit: number | undefined
              const range = { start: url.searchParams.get("start"), end: url.searchParams.get("end") }
              if (range.start != null) {
                const filePathURI = part.url.split("?")[0]
                let start = parseInt(range.start)
                let end = range.end ? parseInt(range.end) : undefined
                if (start === end) {
                  const symbols = yield* lsp.documentSymbol(filePathURI).pipe(Effect.catch(() => Effect.succeed([])))
                  for (const symbol of symbols) {
                    let r: LSP.Range | undefined
                    if ("range" in symbol) r = symbol.range
                    else if ("location" in symbol) r = symbol.location.range
                    if (r?.start?.line && r?.start?.line === start) {
                      start = r.start.line
                      end = r?.end?.line ?? start
                      break
                    }
                  }
                }
                offset = Math.max(start, 1)
                if (end) limit = end - (offset - 1)
              }
              const args = { filePath: filepath, offset, limit }
              const pieces: Draft<SessionV1.Part>[] = [
                {
                  messageID: info.id,
                  sessionID: input.sessionID,
                  type: "text",
                  synthetic: true,
                  text: `Called the Read tool with the following input: ${JSON.stringify(args)}`,
                },
              ]
              const exit = yield* provider.getModel(info.model.providerID, info.model.modelID).pipe(
                Effect.flatMap((mdl) => execRead(args, { model: mdl })),
                Effect.exit,
              )
              if (Exit.isSuccess(exit)) {
                const result = exit.value
                pieces.push({
                  messageID: info.id,
                  sessionID: input.sessionID,
                  type: "text",
                  synthetic: true,
                  text: result.output,
                })
                if (result.attachments?.length) {
                  pieces.push(
                    ...result.attachments.map((a) => ({
                      ...a,
                      synthetic: true,
                      filename: a.filename ?? part.filename,
                      messageID: info.id,
                      sessionID: input.sessionID,
                    })),
                  )
                } else {
                  pieces.push({ ...part, mime, messageID: info.id, sessionID: input.sessionID })
                }
              } else {
                if (defer && isInterrupted(exit.cause)) return yield* Effect.interrupt
                const error = Cause.squash(exit.cause)
                if (defer) return yield* Effect.die(error)
                yield* Effect.logError("failed to read file", { error, filepath })
                const message = error instanceof Error ? error.message : String(error)
                yield* events.publish(Session.Event.Error, {
                  sessionID: input.sessionID,
                  error: new NamedError.Unknown({ message }).toObject(),
                })
                pieces.push({
                  messageID: info.id,
                  sessionID: input.sessionID,
                  type: "text",
                  synthetic: true,
                  text: `Read tool failed to read ${filepath} with the following error: ${message}`,
                })
              }
              return pieces
            }

            if (mime === "application/x-directory") {
              const args = { filePath: filepath }
              const exit = yield* execRead(args).pipe(Effect.exit)
              if (Exit.isFailure(exit)) {
                if (defer && isInterrupted(exit.cause)) return yield* Effect.interrupt
                const error = Cause.squash(exit.cause)
                if (defer) return yield* Effect.die(error)
                yield* Effect.logError("failed to read directory", { error, filepath })
                const message = error instanceof Error ? error.message : String(error)
                yield* events.publish(Session.Event.Error, {
                  sessionID: input.sessionID,
                  error: new NamedError.Unknown({ message }).toObject(),
                })
                return [
                  {
                    messageID: info.id,
                    sessionID: input.sessionID,
                    type: "text",
                    synthetic: true,
                    text: `Read tool failed to read ${filepath} with the following error: ${message}`,
                  },
                ]
              }
              return [
                {
                  messageID: info.id,
                  sessionID: input.sessionID,
                  type: "text",
                  synthetic: true,
                  text: `Called the Read tool with the following input: ${JSON.stringify(args)}`,
                },
                {
                  messageID: info.id,
                  sessionID: input.sessionID,
                  type: "text",
                  synthetic: true,
                  text: exit.value.output,
                },
                { ...part, mime, messageID: info.id, sessionID: input.sessionID },
              ]
            }
            const access = yield* Effect.gen(function* () {
              const file = yield* FoxReadObject.file(filepath)
              const instance = yield* InstanceState.context
              const context = toolCtx()
              const explicit = reference ? yield* FoxReference.path(fsys, reference.root, file.target) : false
              const referenced =
                explicit || (yield* FoxReference.contains({ fs: fsys, references, target: file.target }))
              yield* assertExternalDirectoryEffect(context, file.target, { bypass: referenced, kind: "file" })
              yield* context.ask({
                permission: "read",
                patterns: [...new Set([filepath, file.target].map((item) => path.relative(instance.worktree, item)))],
                always: ["*"],
                metadata: {},
              })

              return yield* FoxReadObject.use(file, (bound) =>
                Effect.gen(function* () {
                  const limit = mime.startsWith("image/")
                    ? ((yield* config.get()).attachment?.image?.max_base64_bytes ?? Image.MAX_BASE64_BYTES)
                    : undefined
                  const raw = limit === undefined ? undefined : Math.floor(limit / 4) * 3 + 1
                  const bytes = yield* Effect.tryPromise({
                    try: (signal) => bound.read(raw, AbortSignal.any([context.abort, signal])),
                    catch: (err) => (err instanceof Error ? err : new Error(String(err))),
                  })
                  if (limit !== undefined) {
                    const encoded = Math.ceil(bytes.byteLength / 3) * 4
                    if (encoded > limit) {
                      return yield* Effect.fail(
                        new Image.SizeError({
                          bytes: encoded,
                          max: limit,
                          width: 0,
                          height: 0,
                          max_width: 0,
                          max_height: 0,
                        }),
                      )
                    }
                  }
                  const filePart: MessageV2.FilePart = {
                    id: part.id ? PartID.make(part.id) : PartID.ascending(),
                    messageID: info.id,
                    sessionID: input.sessionID,
                    type: "file",
                    url: `data:${mime};base64,${bytes.toString("base64")}`,
                    mime,
                    filename: part.filename!,
                    source: part.source,
                  }
                  return mime.startsWith("image/") ? yield* image.normalize(filePart) : filePart
                }),
              )
            }).pipe(Effect.exit)
            if (Exit.isFailure(access)) {
              if (defer && isInterrupted(access.cause)) return yield* Effect.interrupt
              const error = Cause.squash(access.cause)
              if (defer) return yield* Effect.die(error)
              if (
                error instanceof Image.InvalidDataUrlError ||
                error instanceof Image.DecodeError ||
                error instanceof Image.SizeError
              )
                return yield* Effect.die(error)
              yield* Effect.logError("failed to read file", { error, filepath })
              const message = error instanceof Error ? error.message : String(error)
              yield* events.publish(Session.Event.Error, {
                sessionID: input.sessionID,
                error: new NamedError.Unknown({ message }).toObject(),
              })
              return [
                {
                  messageID: info.id,
                  sessionID: input.sessionID,
                  type: "text",
                  synthetic: true,
                  text: `Read tool failed to read ${filepath} with the following error: ${message}`,
                },
              ]
            }
            return [
              {
                messageID: info.id,
                sessionID: input.sessionID,
                type: "text",
                synthetic: true,
                text: `Called the Read tool with the following input: {"filePath":"${filepath}"}`,
              },
              access.value,
            ]
          }
        }
      }

      if (part.type === "agent") {
        const perm = Permission.evaluate("task", part.name, ag.permission)
        const hint = perm.action === "deny" ? " . Invoked by user; guaranteed to exist." : ""
        return [
          { ...part, messageID: info.id, sessionID: input.sessionID },
          {
            messageID: info.id,
            sessionID: input.sessionID,
            type: "text",
            synthetic: true,
            text:
              " Use the above message and context to generate a prompt and call the task tool with subagent: " +
              part.name +
              hint,
          },
        ]
      }

      return [{ ...part, messageID: info.id, sessionID: input.sessionID }]
    })
    const submittedParts: Types.DeepMutable<PromptInput["parts"]> = [...input.parts]
    const attached = new Set(
      input.parts.flatMap((part) =>
        part.type === "file" && part.mime === "application/x-directory" ? [part.url] : [],
      ),
    )
    for (const part of input.parts) {
      if (part.type !== "text" || part.synthetic) continue
      for (const reference of yield* resolveReferenceParts(part.text, attached)) {
        if (reference.type === "file" && attached.has(reference.url)) continue
        if (reference.type === "file") {
          attached.add(reference.url)
        }
        submittedParts.push(reference)
      }
    }
    const resolvedParts = yield* Effect.forEach(submittedParts, resolvePart, { concurrency: "unbounded" }).pipe(
      Effect.map((x) => x.flat().map(assign)),
    )

    yield* plugin.trigger(
      "chat.message",
      {
        sessionID: input.sessionID,
        agent: input.agent,
        model: input.model,
        messageID: input.messageID,
        variant: input.variant,
      },
      { message: info, parts: resolvedParts },
    )
    const parts = resolvedParts

    const parsed = decodeMessageInfo(info, { errors: "all", propertyOrder: "original" })
    if (Exit.isFailure(parsed)) {
      yield* Effect.logError("invalid user message before save", {
        sessionID: input.sessionID,
        messageID: info.id,
        agent: info.agent,
        model: info.model,
        cause: Cause.pretty(parsed.cause),
      })
    }
    for (const [index, part] of parts.entries()) {
      const p = decodeMessagePart(part, { errors: "all", propertyOrder: "original" })
      if (Exit.isSuccess(p)) continue
      yield* Effect.logError("invalid user part before save", {
        sessionID: input.sessionID,
        messageID: info.id,
        partID: part.id,
        partType: part.type,
        index,
        cause: Cause.pretty(p.cause),
        part,
      })
    }
    return Effect.gen(function* () {
      if (defer) yield* select
      yield* sessions.updateMessage(info)
      for (const part of parts) yield* sessions.updatePart(part)

      return { info, parts }
    })
  })

  const createUserMessage = (input: PromptInput) => prepare(input).pipe(Effect.flatten, Effect.scoped)

  return { prepare, createUserMessage }
}
