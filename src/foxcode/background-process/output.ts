import { stat } from "fs/promises"
import { MAX_OUTPUT_BYTES, type Active } from "./types"

/**
 * Clamps a UTF-8 string to a maximum byte length from the end,
 * respecting multi-byte UTF-8 character boundaries.
 */
export function clamp(text: string, max = MAX_OUTPUT_BYTES): string {
  const buf = Buffer.from(text, "utf-8")
  if (buf.length <= max) return text
  let start = buf.length - max
  while (start < buf.length && (buf[start] & 0xc0) === 0x80) start++
  return buf.subarray(start).toString("utf-8")
}

/**
 * Reads newly written output from the persistent process log file into the Active buffer.
 */
export async function readLogOutput(
  active: Active,
  append: (active: Active, chunk: string) => void,
): Promise<void> {
  if (!active.log) return
  const meta = await stat(active.log).catch(() => undefined)
  if (!meta) return
  const key = `${meta.dev}:${meta.ino}`
  if (active.file && active.file !== key) {
    active.offset = 0
    active.info.output = ""
  }
  active.file = key
  const size = meta.size
  const offset = active.offset ?? 0
  const start = size < offset ? Math.max(0, size - MAX_OUTPUT_BYTES) : offset
  const next = await Bun.file(active.log).slice(start, size).text()
  active.offset = size
  if (next) append(active, next)
}
