import { readFile, readdir } from "fs/promises"
import { spawn, type ChildProcess } from "child_process"
import net from "net"
import { Process } from "@/util/process"
import { Filesystem } from "@/util/filesystem"
import * as Log from "@opencode-ai/core/util/log"
import type { Status, Ready } from "./schema"
import { KILL_MS, READY_MS, type Active, type Probe } from "./types"

const log = Log.create({ service: "background-process.lifecycle" })

export function terminal(status: Status): boolean {
  return status === "exited" || status === "failed" || status === "stopped"
}

export function stopped(proc: ChildProcess): boolean {
  return proc.exitCode !== null || proc.signalCode !== null
}

export function code(err: unknown): string | undefined {
  if (!err || typeof err !== "object" || !("code" in err)) return
  const value = (err as { code?: unknown }).code
  return typeof value === "string" ? value : undefined
}

export function alive(pid: number | undefined): boolean {
  if (!pid || pid === process.pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return code(err) === "EPERM"
  }
}

export function group(pid: number): boolean {
  if (process.platform === "win32") return false
  try {
    process.kill(-pid, 0)
    return true
  } catch (err) {
    if (code(err) === "EPERM") return true
    if (code(err) !== "ESRCH") log.debug("failed to probe process group", { err, pid })
    return false
  }
}

export function pgrp(text: string): number | undefined {
  const end = text.lastIndexOf(")")
  if (end < 0) return undefined
  const fields = text
    .slice(end + 2)
    .trim()
    .split(/\s+/)
  const value = Number(fields[2])
  return Number.isInteger(value) && value > 0 ? value : undefined
}

async function linux(active: Active): Promise<Probe> {
  const pid = active.info.pid
  const token = active.token
  if (!pid || !token) return "unknown"
  const leader = await readFile(`/proc/${pid}/stat`, "utf8").catch(() => undefined)
  if (leader && pgrp(leader) === pid) {
    const data = await readFile(`/proc/${pid}/environ`).catch(() => undefined)
    const parts = data?.toString("utf8").split("\0") ?? []
    if (parts.includes(`FOX_BACKGROUND_PROCESS_TOKEN=${token}`)) {
      return "owned"
    }
  }
  const names = await readdir("/proc").catch(() => undefined)
  if (!names) return "unknown"
  const members: number[] = []
  for (const name of names) {
    if (!/^\d+$/.test(name)) continue
    const text = await readFile(`/proc/${name}/stat`, "utf8").catch(() => undefined)
    if (text && pgrp(text) === pid) members.push(Number(name))
  }
  if (members.length === 0) return "gone"
  let read = false
  for (const member of members) {
    const data = await readFile(`/proc/${member}/environ`).catch(() => undefined)
    if (!data) continue
    read = true
    const parts = data.toString("utf8").split("\0")
    if (parts.includes(`FOX_BACKGROUND_PROCESS_TOKEN=${token}`)) {
      return "owned"
    }
  }
  return read ? "foreign" : "unknown"
}

async function unix(active: Active): Promise<Probe> {
  const pid = active.info.pid
  const token = active.token
  if (!pid || !token) return "unknown"
  const out = await Process.text(["ps", "eww", "-axo", "pid=,pgid=,command="], {
    nothrow: true,
    abort: AbortSignal.timeout(2_000),
    timeout: 2_000,
  })
  if (out.code !== 0) return "unknown"
  const members = out.text.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/)
    if (!match || Number(match[2]) !== pid) return []
    return [match[3]]
  })
  if (members.length === 0) return "gone"
  return members.some((command) => command.includes(token)) ? "owned" : "foreign"
}

async function windows(active: Active): Promise<Probe> {
  const pid = active.info.pid
  const token = active.token
  if (!pid || !token) return "unknown"
  const query = `$p=Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}"; if ($p) { [Console]::Out.Write($p.CommandLine) }`
  const out = await Process.text(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", query], {
    nothrow: true,
    abort: AbortSignal.timeout(2_000),
    timeout: 2_000,
  })
  if (out.code !== 0) return "unknown"
  if (!out.text.trim()) return "gone"
  return out.text.includes(token) ? "owned" : "foreign"
}

export async function probe(active: Active): Promise<Probe> {
  if (process.platform === "linux") return linux(active)
  if (process.platform === "win32") return windows(active)
  if (process.platform === "darwin" || process.platform === "freebsd") return unix(active)
  return "unknown"
}

export function waitExit(proc: ChildProcess, ms: number): Promise<void> {
  if (stopped(proc)) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const timer = setTimeout(done, ms)
    function done() {
      clearTimeout(timer)
      proc.off("exit", done)
      proc.off("error", done)
      resolve()
    }
    proc.once("exit", done)
    proc.once("error", done)
  })
}

export async function waitGone(active: Active): Promise<void> {
  const end = Date.now() + KILL_MS
  while (Date.now() < end) {
    const status = await probe(active)
    if (status === "gone" || status === "foreign") return
    await Bun.sleep(100)
  }
}

export async function kill(active: Active): Promise<void> {
  const pid = active.info.pid
  if (!pid) return
  if (active.info.lifetime === "persistent") {
    const before = await probe(active)
    if (before === "gone" || before === "foreign") return
    if (before !== "owned") throw new Error(`Cannot verify ownership of persistent process: ${active.info.id}`)
    if (process.platform === "win32") {
      if (!active.control) throw new Error(`Persistent process control path is missing: ${active.info.id}`)
      await Filesystem.write(active.control, "stop", 0o600)
      await waitGone(active)
      const stoppedProc = await probe(active)
      if (stoppedProc === "gone" || stoppedProc === "foreign") return
      throw new Error(`Persistent process runner did not stop safely: ${active.info.id}`)
    }
    try {
      process.kill(-pid, "SIGTERM")
    } catch (err) {
      if ((await probe(active)) === "owned") throw err
      return
    }
    await waitGone(active)
    const force = await probe(active)
    if (force === "owned") {
      try {
        process.kill(-pid, "SIGKILL")
      } catch (err) {
        if ((await probe(active)) === "owned") throw err
      }
    }
    if (force === "unknown") throw new Error(`Cannot reverify persistent process before SIGKILL: ${active.info.id}`)
    return
  }
  if (active.proc ? stopped(active.proc) : !alive(pid)) return
  if (process.platform === "win32") {
    await new Promise<void>((resolve) => {
      const child = spawn("taskkill", ["/pid", String(pid), "/f", "/t"], {
        stdio: "ignore",
        windowsHide: true,
      })
      child.once("exit", () => resolve())
      child.once("error", () => resolve())
    })
    return
  }
  try {
    process.kill(-pid, "SIGTERM")
  } catch (err) {
    log.warn("failed to terminate process group", { err, pid })
    try {
      process.kill(pid, "SIGTERM")
    } catch (err2) {
      if (code(err2) !== "ESRCH") throw err2
    }
  }
  if (active.proc) await waitExit(active.proc, KILL_MS)
  if (!active.proc) await Bun.sleep(KILL_MS)
  if (!alive(pid) && !group(pid)) return
  try {
    process.kill(-pid, "SIGKILL")
  } catch (err) {
    log.warn("failed to kill process group", { err, pid })
    try {
      process.kill(pid, "SIGKILL")
    } catch (err2) {
      if (code(err2) !== "ESRCH") throw err2
    }
  }
}

export async function rollback(active: Active): Promise<boolean> {
  const pid = active.info.pid
  if (!pid) return true
  const before = await probe(active)
  if (before === "gone" || before === "foreign") return true
  if (before === "unknown" && (!active.proc || stopped(active.proc))) return false
  if (process.platform === "win32") {
    if (active.control) {
      await Filesystem.write(active.control, "stop", 0o600)
    } else {
      const out = await Process.run(["taskkill", "/pid", String(pid), "/f", "/t"], { nothrow: true })
      if (out.code !== 0 && (await probe(active)) === "owned") return false
    }
  } else {
    try {
      process.kill(-pid, "SIGKILL")
    } catch (err) {
      if ((await probe(active)) === "owned") throw err
    }
  }
  const end = Date.now() + KILL_MS
  while (Date.now() < end) {
    const status = await probe(active)
    if (status === "gone" || status === "foreign") return true
    await Bun.sleep(100)
  }
  return false
}

export function connected(port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" })
    const done = (ok: boolean) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(500)
    socket.once("connect", () => done(true))
    socket.once("error", () => done(false))
    socket.once("timeout", () => done(false))
  })
}

export async function waitReady(
  active: Active,
  input: Ready,
  callbacks: {
    ready: (active: Active) => void
    publish: (active: Active) => void
    persist: (active: Active) => void
  },
): Promise<boolean> {
  if (!input.pattern && !input.port) return false
  if (input.pattern && active.pattern?.test(active.info.output)) {
    callbacks.ready(active)
    return true
  }
  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      if (active.info.status === "starting") {
        active.info.status = "running"
        active.info.time.updated = Date.now()
        callbacks.publish(active)
        callbacks.persist(active)
      }
      active.resolve = undefined
      resolve(false)
    }, input.timeout ?? READY_MS)
    active.resolve = (ok) => {
      clearTimeout(timeout)
      resolve(ok)
    }
    const poll = async () => {
      if (!input.port) return
      while (!terminal(active.info.status) && !active.info.ready && active.resolve) {
        if (await connected(input.port)) {
          callbacks.ready(active)
          return
        }
        await Bun.sleep(250)
      }
    }
    void poll().catch((err) => {
      log.warn("port readiness check failed", { err, id: active.info.id, port: input.port })
    })
  })
}
