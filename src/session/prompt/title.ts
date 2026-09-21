import { Cause, Effect, Stream } from "effect"
import { LLMEvent } from "@opencode-ai/llm"
import { FoxSessionTitle } from "@/foxcode/session/title"
import { FoxSessionPrompt } from "@/foxcode/session/prompt"
import { Session } from "../session"
import type { SessionV1 } from "@opencode-ai/core/v1/session"
import type { ProviderV2 } from "@opencode-ai/core/provider"
import type { ModelV2 } from "@opencode-ai/core/model"
import type { Agent } from "../../agent/agent"
import type { Provider } from "@/provider/provider"
import type { LLM } from "../llm"

export interface TitleContext {
  agents: Agent.Interface
  provider: Provider.Interface
  llm: LLM.Interface
  sessions: Session.Interface
}

export interface EnsureTitleInput {
  session: Session.Info
  history: SessionV1.WithParts[]
  providerID: ProviderV2.ID
  modelID: ModelV2.ID
}

export function makeTitleGenerator(ctx: TitleContext) {
  const { agents, provider, llm, sessions } = ctx

  const title = Effect.fn("SessionPrompt.ensureTitle")(function* (input: EnsureTitleInput) {
    if (input.session.parentID) return
    if (!Session.isDefaultTitle(input.session.title)) return
    const built = FoxSessionTitle.build(input.history)
    if (!built) return
    const ag = yield* agents.get("title")
    if (!ag) return
    const mdl = ag.model
      ? yield* provider.getModel(ag.model.providerID, ag.model.modelID)
      : ((yield* provider.getSmallModel(input.providerID)) ??
        (yield* provider.getModel(input.providerID, input.modelID)))
    const text = yield* llm
      .stream({
        agent: ag,
        user: built.user,
        system: [],
        small: true,
        tools: {},
        model: mdl,
        sessionID: FoxSessionPrompt.titleID(input.session.id),
        retries: 2,
        messages: built.messages,
      })
      .pipe(
        Stream.filter(LLMEvent.is.textDelta),
        Stream.map((e) => e.text),
        Stream.mkString,
        Effect.orDie,
      )
    const cleaned = text
      .replace(/<think>[\s\S]*?<\/think>\s*/g, "")
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0)
    if (!cleaned) return
    const t = cleaned.length > 100 ? cleaned.substring(0, 97) + "..." : cleaned
    const fresh = yield* sessions.get(input.session.id).pipe(Effect.orElseSucceed(() => null))
    if (
      !FoxSessionPrompt.prepareAutoTitle({
        sessionID: input.session.id,
        title: t,
        fresh,
        isDefaultTitle: Session.isDefaultTitle,
      })
    )
      return
    yield* sessions.setTitle({ sessionID: input.session.id, title: t }).pipe(
      Effect.catchCause((cause) => {
        FoxSessionPrompt.clearAutoTitleMark(input.session.id, t)
        return Effect.logError("failed to generate title", { error: Cause.squash(cause) })
      }),
    )
  })

  return { title }
}
