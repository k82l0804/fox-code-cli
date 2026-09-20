import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@foxcode/plugin/tui"
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from "solid-js"
import { UsageRow } from "@/foxcode/plugins/sidebar-usage-row"
import { isSessionTreeMember } from "@/foxcode/plugins/model-usage"
import type { CompressionSummary } from "@opencode-ai/core/tool/compression-metrics"

const id = "internal:fox-sidebar-compression"

interface CompressionSample {
  ttft?: number
  compression?: CompressionSummary
}

function View(props: { api: TuiPluginApi; session_id: string }) {
  const [open, setOpen] = createSignal(true)
  const [samples, setSamples] = createSignal<CompressionSample[]>([])
  const theme = () => props.api.theme.current

  // Reset samples when session changes.
  createEffect(() => {
    props.session_id
    setSamples([])
  })

  const latest = createMemo(() => samples().at(-1))
  const totals = createMemo(() => {
    const all = samples()
    if (all.length === 0) return undefined
    let charsBefore = 0
    let charsSaved = 0
    let schemaSaved = 0
    let superseded = 0
    let overheadMs = 0
    let ttftSum = 0
    let ttftCount = 0
    for (const s of all) {
      if (s.compression) {
        charsBefore += s.compression.charsBefore
        charsSaved += s.compression.charsSaved
        schemaSaved += s.compression.schemaSaved
        superseded += s.compression.superseded
        overheadMs += s.compression.overheadMs
      }
      if (s.ttft !== undefined && s.ttft > 0) {
        ttftSum += s.ttft
        ttftCount++
      }
    }
    const totalSaved = charsSaved + schemaSaved
    const totalBefore = charsBefore + schemaSaved // original size ≈ before + what schema removed
    const pct = totalBefore > 0 ? Math.round((totalSaved / totalBefore) * 1000) / 10 : 0
    return {
      charsSaved,
      schemaSaved,
      totalSaved,
      pct,
      superseded,
      overheadMs: Math.round(overheadMs * 100) / 100,
      avgTtft: ttftCount > 0 ? Math.round(ttftSum / ttftCount) : undefined,
      turns: all.length,
    }
  })

  /** True when at least one sample has meaningful data to display. */
  const hasData = createMemo(() => {
    const l = latest()
    if (!l) return false
    return (l.ttft !== undefined && l.ttft > 0)
      || (l.compression !== undefined && (
        l.compression.charsSaved > 0
        || l.compression.schemaSaved > 0
        || l.compression.superseded > 0
      ))
  })

  const fmtMs = (ms: number | undefined) => {
    if (ms === undefined || !Number.isFinite(ms) || ms <= 0) return "—"
    if (ms < 1000) return `${Math.round(ms)}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const fmtChars = (n: number) => {
    if (n <= 0) return "0"
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return String(n)
  }

  const fmtPct = (n: number) => {
    if (n <= 0) return "0%"
    return `${n.toFixed(1)}%`
  }

  onMount(() => {
    const related = (sessionID: string) =>
      isSessionTreeMember({ root: props.session_id, sessionID, get: props.api.state.session.get })

    const off = props.api.event.on("message.part.updated", (event) => {
      const part = event.properties.part as Record<string, unknown>
      if (part.type !== "step-finish") return
      if (!related(event.properties.sessionID)) return

      const time = part.time as Record<string, unknown> | undefined
      const compression = part.compression as CompressionSummary | undefined
      const ttft = typeof time?.ttft === "number" ? time.ttft : undefined

      setSamples((current) => [...current, { ttft, compression }])
    })
    onCleanup(off)
  })

  const Row = (props: { label: string; value: string; color?: any }) => (
    <UsageRow label={props.label} value={props.value} color={props.color ?? theme().textMuted} />
  )

  return (
    <box>
      <box flexDirection="row" gap={1} onMouseDown={() => setOpen((o) => !o)}>
        <text fg={theme().text}>{open() ? "▼" : "▶"}</text>
        <text fg={theme().text}>
          <b>Compression</b>
        </text>
      </box>
      <Show when={open() && hasData()}>
        <Show when={latest()}>
          {(data) => (
            <>
              <Show when={data().compression && data().compression!.charsBefore > 0}>
                <Row
                  label="Tool output"
                  value={`-${fmtChars(data().compression!.charsSaved)} (${fmtPct(data().compression!.pctSaved)})`}
                />
              </Show>
              <Show when={data().compression && data().compression!.schemaSaved > 0}>
                <Row label="Schemas" value={`-${fmtChars(data().compression!.schemaSaved)} bytes`} />
              </Show>
              <Show when={data().compression && data().compression!.superseded > 0}>
                <Row label="Superseded" value={`${data().compression!.superseded} reads`} />
              </Show>
              <Show when={data().ttft !== undefined && data().ttft! > 0}>
                <Row label="TTFT" value={fmtMs(data().ttft)} />
              </Show>
              <Show when={data().compression && data().compression!.overheadMs > 0}>
                <Row label="Overhead" value={fmtMs(data().compression!.overheadMs)} />
              </Show>

              <Show when={totals() && totals()!.turns > 1}>
                <text fg={theme().textMuted}>─── Session ───</text>
                <Row label="Total saved" value={`${fmtChars(totals()!.totalSaved)} (${totals()!.pct}%)`} />
                <Show when={totals()!.avgTtft !== undefined}>
                  <Row label="Avg TTFT" value={fmtMs(totals()!.avgTtft)} />
                </Show>
                <Row label="Turns" value={String(totals()!.turns)} />
              </Show>
            </>
          )}
        </Show>
        <Show when={!hasData()}>
          <text fg={theme().textMuted}>Waiting for data...</text>
        </Show>
      </Show>
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 105,
    slots: {
      sidebar_content(_ctx, props) {
        return <View api={api} session_id={props.session_id} />
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id,
  tui,
}

export default plugin
