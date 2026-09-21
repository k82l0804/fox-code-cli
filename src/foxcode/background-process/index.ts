import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { InstanceState } from "@/effect/instance-state"
import { makeRuntime } from "@/effect/run-service"
import { Identifier } from "@/id/id"
import { Instance, type InstanceContext } from "@/foxcode/instance"
import { FoxShutdown } from "@/foxcode/cli/shutdown"
import { model as modelEnv } from "@/foxcode/process/env"
import { SessionID } from "@/session/schema"
import { Shell } from "@opencode-ai/core/shell"
import { ProjectV2 } from "@opencode-ai/core/project"
import { Process } from "@/util/process"
import { NonNegativeInt, PositiveInt, optionalOmitUndefined, withStatics } from "@opencode-ai/core/schema"
import { zod, ZodOverride } from "@opencode-ai/core/effect-zod"
import { Flag } from "@opencode-ai/core/flag/flag"
import { Global } from "@opencode-ai/core/global"
import { Hash } from "@opencode-ai/core/util/hash"
import { Flock } from "@opencode-ai/core/util/flock"
import * as Log from "@opencode-ai/core/util/log"
import { Filesystem } from "@/util/filesystem"
import { isRecord } from "@/util/record"
import { BackgroundProcessRunner } from "./runner"
import { chmod, mkdir, readFile, readdir, rm, stat } from "fs/promises"
import { randomUUID } from "crypto"
import { hostname } from "os"
import { spawn, type ChildProcess } from "child_process"
import { Context, Effect, Layer, Schema, Types } from "effect"
import net from "net"
import path from "path"
import z from "zod"
import * as Ports from "./ports"
import * as BackgroundProcessSchema from "./schema"
import * as BackgroundProcessTypes from "./types"
import {
  MAX_OUTPUT_BYTES,
  KILL_MS,
  READY_MS,
  PUBLISH_MS,
  PORT_START_MS,
  PORT_MS,
  PORT_LIMIT_MS,
} from "./types"
import { clamp, readLogOutput } from "./output"
import {
  alive,
  code,
  connected,
  group,
  kill,
  probe,
  rollback,
  stopped,
  terminal,
  waitExit,
  waitGone,
  waitReady,
} from "./lifecycle"

export namespace BackgroundProcess {
  const log = Log.create({ service: "background-process" })
  const MAX = MAX_OUTPUT_BYTES

  export type ID = BackgroundProcessSchema.ID
  export const ID = BackgroundProcessSchema.ID
  export type Status = BackgroundProcessSchema.Status
  export const Status = BackgroundProcessSchema.Status
  export type Lifetime = BackgroundProcessSchema.Lifetime
  export const Lifetime = BackgroundProcessSchema.Lifetime
  export type Ready = BackgroundProcessSchema.Ready
  export const Ready = BackgroundProcessSchema.Ready
  export type Info = BackgroundProcessSchema.Info
  export const Info = BackgroundProcessSchema.Info
  export type StartInput = BackgroundProcessSchema.StartInput
  export const StartInput = BackgroundProcessSchema.StartInput
  export type Logs = BackgroundProcessSchema.Logs
  export const Logs = BackgroundProcessSchema.Logs
  export const Event = BackgroundProcessSchema.Event

  export type Active = BackgroundProcessTypes.Active
  export type Shared = BackgroundProcessTypes.Shared
  export type State = BackgroundProcessTypes.State
  export type Probe = BackgroundProcessTypes.Probe

  const Persisted = Schema.Struct({
    scope: Schema.String,
    token: Schema.String,
    info: Info,
    start: StartInput,
  }).pipe(withStatics((s) => ({ zod: zod(s) })))
  type Persisted = Schema.Schema.Type<typeof Persisted>

  class StateService extends Context.Service<StateService, { readonly get: () => Effect.Effect<State> }>()(
    "@foxcode/BackgroundProcess.State",
  ) {}

  function scoped(ctx: InstanceContext) {
    const root = ctx.project.id === ProjectV2.ID.global ? ctx.directory : ctx.project.worktree
    const hash = Hash.fast(`${ctx.project.id}\0${Filesystem.resolve(root)}`)
    return { key: `scope:${hash}`, dir: `scope-${hash}` }
  }

  function root(shared: Shared) {
    return path.join(Global.Path.state, "background-process", shared.dir)
  }

  function manifest(shared: Shared, id: ID) {
    return path.join(root(shared), `${id}.json`)
  }

  function logroot(shared: Shared) {
    return path.join(Global.Path.log, "background-process", shared.dir)
  }

  function logfile(shared: Shared, id: ID) {
    return path.join(logroot(shared), `${id}.log`)
  }

  function controlfile(shared: Shared, id: ID) {
    return path.join(root(shared), `${id}.stop`)
  }

  async function secure(shared: Shared) {
    const dirs = [
      path.join(Global.Path.state, "background-process"),
      path.join(Global.Path.state, "background-process", "locks"),
      root(shared),
      path.join(Global.Path.log, "background-process"),
      logroot(shared),
    ]
    await Promise.all(dirs.map((dir) => mkdir(dir, { recursive: true, mode: 0o700 })))
    if (process.platform === "win32") return
    await Promise.all(dirs.map((dir) => chmod(dir, 0o700)))
  }

  function lockroot() {
    return path.join(Global.Path.state, "background-process", "locks")
  }

  async function held(shared: Shared) {
    const file = path.join(lockroot(), `${Hash.fast(shared.key)}.lock`, "meta.json")
    const value = await readFile(file, "utf8")
      .then((text): unknown => JSON.parse(text))
      .catch(() => undefined)
    if (!isRecord(value) || typeof value.pid !== "number" || typeof value.hostname !== "string") return false
    if (value.hostname !== hostname() || value.pid === process.pid) return false
    return alive(value.pid)
  }

  async function claim(shared: Shared) {
    if (shared.lease) return true
    if (shared.claim) return shared.claim
    if (await held(shared)) return false
    const pending = Flock.acquire(shared.key, {
      dir: lockroot(),
      timeoutMs: 100,
      staleMs: 10_000,
      baseDelayMs: 25,
      maxDelayMs: 50,
    })
      .then((lease) => {
        shared.lease = lease
        return true
      })
      .catch((err) => {
        log.debug("persistent process scope is managed by another Fox process", { err, scope: shared.key })
        return false
      })
      .finally(() => {
        if (shared.claim === pending) shared.claim = undefined
      })
    shared.claim = pending
    return pending
  }

  async function save(shared: Shared, active: Active, opts?: { create?: boolean; disposed?: boolean }) {
    const token = active.token
    if ((!opts?.disposed && active.disposed) || active.info.lifetime !== "persistent" || !token) return
    if (!opts?.create && !active.saved) return
    if (opts?.create) active.saved = true
    const prev = active.saving?.catch(() => undefined) ?? Promise.resolve()
    const next = prev.then(async () => {
      await secure(shared)
      const info = clone(active.info)
      info.output = ""
      info.ports = []
      await Filesystem.writeJson(
        manifest(shared, active.info.id),
        {
          scope: shared.key,
          token,
          info,
          start: active.start,
        } satisfies Persisted,
        0o600,
      )
    })
    active.saving = next
    try {
      await next
    } catch (err) {
      if (opts?.create) active.saved = false
      throw err
    } finally {
      if (active.saving === next) active.saving = undefined
    }
  }

  async function forget(shared: Shared, active: Active) {
    active.saved = false
    await active.saving?.catch((err: unknown) =>
      log.warn("failed to finish persistent process metadata", { err, id: active.info.id }),
    )
    await Promise.all(
      [manifest(shared, active.info.id), logfile(shared, active.info.id), controlfile(shared, active.info.id)].map(
        (file) =>
          rm(file, { force: true }).catch((err) =>
            log.warn("failed to remove persistent process artifact", { err, file }),
          ),
      ),
    )
  }

  function clone(info: Info): Info {
    return {
      ...info,
      ports: [...info.ports],
      time: { ...info.time },
    }
  }

  function same(a: number[], b: number[]) {
    return a.length === b.length && a.every((port, index) => port === b[index])
  }

  function infer() {
    return (
      Flag.FOX_CLIENT === "cli" && process.env.FOX_BACKGROUND_PROCESS_PORTS === "true"
    )
  }

  function update(active: Active, ports?: number[]) {
    const pid = active.info.pid
    if (!pid || terminal(active.info.status)) {
      const changed = active.info.ports.length > 0
      active.info.ports = []
      return changed
    }
    const fallback = active.info.ready && active.start.ready?.port ? [active.start.ready.port] : []
    const next = Array.from(new Set([...(ports ?? active.info.ports), ...fallback])).toSorted((a, b) => a - b)
    if (same(active.info.ports, next)) return false
    active.info.ports = next
    active.info.time.updated = Date.now()
    return true
  }

  async function refresh(active: Active) {
    const pid = active.info.pid
    if (!pid || terminal(active.info.status)) return update(active)
    return update(active, await Ports.list(pid))
  }

  function eventscope(active: Active) {
    if (active.info.lifetime === "persistent" && active.ctx.project.id !== ProjectV2.ID.global) {
      return active.ctx.project.worktree
    }
    return active.ctx.directory
  }

  function emit(active: Active) {
    Instance.restore(active.ctx, () => {
      void Bus.publish(active.ctx, Event.Updated, { info: clone(active.info), scope: eventscope(active) }).catch(
        (err) => {
          log.warn("failed to publish process update", { err, id: active.info.id })
        },
      )
    })
  }

  function publish(active: Active) {
    if (active.disposed) return
    update(active)
    emit(active)
  }

  function persist(active: Active) {
    if (!active.shared) return
    void save(active.shared, active).catch((err) =>
      log.warn("failed to save persistent process metadata", { err, id: active.info.id }),
    )
  }

  function recover(shared: Shared, active: Active) {
    if (active.disposed || active.saved || active.retry) return
    active.retry = setTimeout(() => {
      active.retry = undefined
      void save(shared, active, { create: true })
        .catch((err) => log.warn("failed to recover persistent process metadata", { err, id: active.info.id }))
        .finally(() => recover(shared, active))
    }, 5_000)
  }

  function finished(active: Active) {
    if (active.disposed) return true
    if (!infer()) return true
    if (terminal(active.info.status)) return true
    if (active.info.ports.length > 0) return true
    return Date.now() - active.info.time.started >= PORT_LIMIT_MS
  }

  function scan(active: Active) {
    if (finished(active)) return
    if (active.scan) return
    active.scan = refresh(active)
      .then((changed) => {
        active.scan = undefined
        if (active.disposed) return false
        if (changed) emit(active)
        poll(active)
        return changed
      })
      .catch((err) => {
        active.scan = undefined
        if (active.disposed) return false
        log.debug("failed to refresh process ports", { err, id: active.info.id })
        poll(active)
        return false
      })
  }

  function poll(active: Active, ms = PORT_MS) {
    if (finished(active)) return
    if (active.poll) return
    active.poll = setTimeout(() => {
      active.poll = undefined
      scan(active)
    }, ms)
  }

  function schedule(active: Active) {
    if (active.disposed) return
    if (active.notify) return
    active.notify = setTimeout(() => {
      active.notify = undefined
      publish(active)
    }, PUBLISH_MS)
  }

  function ready(active: Active) {
    if (active.disposed) return
    if (active.info.ready) return
    active.info.ready = true
    active.info.status = "ready"
    active.info.time.updated = Date.now()
    active.resolve?.(true)
    active.resolve = undefined
    publish(active)
    persist(active)
  }

  function append(active: Active, chunk: string) {
    if (active.disposed) return
    active.info.output = clamp(active.info.output + chunk)
    active.info.time.updated = Date.now()
    if (active.pattern?.test(active.info.output)) ready(active)
    schedule(active)
  }

  function exited(active: Active, code: number | null, signal: NodeJS.Signals | null) {
    if (active.disposed) return
    if (terminal(active.info.status)) return
    if (active.notify) clearTimeout(active.notify)
    if (active.poll) clearTimeout(active.poll)
    active.notify = undefined
    active.poll = undefined
    if (code === null) delete active.info.exitCode
    else active.info.exitCode = code
    if (signal === null) delete active.info.signal
    else active.info.signal = signal
    active.info.ports = []
    active.info.ready = active.info.ready && code === 0
    active.info.status = active.info.status === "stopping" ? "stopped" : code === 0 ? "exited" : "failed"
    active.info.time.updated = Date.now()
    active.info.time.ended = active.info.time.updated
    active.resolve?.(false)
    active.resolve = undefined
    publish(active)
  }

  function failed(active: Active, err: unknown) {
    if (active.disposed) return
    append(active, `\n${err instanceof Error ? err.message : String(err)}\n`)
    exited(active, 1, null)
  }

  function pattern(input?: string) {
    if (!input) return
    try {
      return new RegExp(input)
    } catch (err) {
      throw new Error(`Invalid ready pattern: ${err instanceof Error ? err.message : String(err)}`)
    }
  }



  function env(id?: ID, token?: string) {
    const result: NodeJS.ProcessEnv = modelEnv({
      TERM: "dumb",
      ...(id ? { FOX_BACKGROUND_PROCESS_ID: id } : {}),
      ...(token ? { FOX_BACKGROUND_PROCESS_TOKEN: token } : {}),
    })
    delete result.FOX_BACKGROUND_PROCESS_PORTS
    delete result.KILO_BACKGROUND_PROCESS_PORTS
    return result
  }



  function owner(state: State, lifetime: Lifetime) {
    return lifetime === "persistent" ? state.shared.processes : state.processes
  }

  async function terminate(state: State, active: Active, opts?: { remove?: boolean; silent?: boolean }) {
    if (active.retry) clearTimeout(active.retry)
    active.retry = undefined
    if (!terminal(active.info.status)) {
      active.info.status = "stopping"
      active.info.time.updated = Date.now()
      if (!opts?.silent) publish(active)
      await kill(active)
      if (active.info.lifetime === "persistent") await output(active)
      if (!terminal(active.info.status)) exited(active, active.proc?.exitCode ?? null, active.proc?.signalCode ?? null)
      if (active.info.lifetime === "persistent") await forget(state.shared, active)
    }
    if (!opts?.remove) return
    active.disposed = true
    owner(state, active.info.lifetime).delete(active.info.id)
    if (active.notify) clearTimeout(active.notify)
    if (active.poll) clearTimeout(active.poll)
    if (active.watch) clearTimeout(active.watch)
    active.resolve?.(false)
    active.resolve = undefined
    if (active.info.lifetime === "persistent") await forget(state.shared, active)
    if (opts.silent) return
    await Instance.restore(active.ctx, () =>
      Bus.publish(active.ctx, Event.Deleted, {
        sessionID: active.info.sessionID,
        processID: active.info.id,
        scope: eventscope(active),
      }).catch((err) => {
        log.warn("failed to publish process deletion", { err, id: active.info.id })
      }),
    )
  }

  async function output(active: Active) {
    await readLogOutput(active, append)
  }

  function watch(shared: Shared, active: Active) {
    if (active.disposed || terminal(active.info.status) || active.watch) return
    active.watch = setTimeout(() => {
      active.watch = undefined
      void output(active)
        .then(async () => {
          const status = await probe(active)
          if (status === "owned" || status === "unknown") {
            if (status === "unknown") log.warn("failed to verify persistent process", { id: active.info.id })
            watch(shared, active)
            return
          }
          exited(active, 0, null)
          await forget(shared, active)
        })
        .catch((err) => {
          log.warn("failed to watch persistent process", { err, id: active.info.id })
          watch(shared, active)
        })
    }, PUBLISH_MS)
  }

  async function verify(active: Active) {
    const end = Date.now() + 2_000
    while (Date.now() < end) {
      const status = await probe(active)
      if (status === "owned") return
      if (active.proc && stopped(active.proc)) break
      await Bun.sleep(50)
    }
    throw new Error(`Persistent process identity could not be verified: ${active.info.id}`)
  }



  async function launch(state: State, input: StartInput, id = ID.ascending()) {
    const sh = Shell.acceptable()
    const cwd = path.resolve(state.dir, input.cwd ?? state.dir)
    const readyPattern = pattern(input.ready?.pattern)
    if (input.ready?.port && (await connected(input.ready.port))) {
      throw new Error(`Ready port is already in use: ${input.ready.port}`)
    }
    const args = Shell.args(sh, input.command, cwd)
    const lifetime = input.lifetime ?? "session"
    const start = { ...input, cwd, lifetime }
    const token = lifetime === "persistent" ? randomUUID() : undefined
    const logpath = lifetime === "persistent" ? logfile(state.shared, id) : undefined
    const control = lifetime === "persistent" ? controlfile(state.shared, id) : undefined
    if (logpath) {
      await secure(state.shared)
      if (!(await claim(state.shared)))
        throw new Error("Persistent processes for this project are managed by another Fox process")
      await Filesystem.write(logpath, "", 0o600)
    }
    const cmd =
      logpath && token && control
        ? BackgroundProcessRunner.command({ token, shell: sh, args, cwd, log: logpath, control })
        : [sh, ...args]
    const proc = await Promise.resolve()
      .then(() =>
        spawn(cmd[0], cmd.slice(1), {
          cwd,
          env: env(id, token),
          stdio: ["ignore", "pipe", "pipe"],
          detached: lifetime === "persistent" || process.platform !== "win32",
          windowsHide: true,
        }),
      )
      .catch(async (err) => {
        if (logpath) await rm(logpath, { force: true })
        if (control) await rm(control, { force: true })
        throw err
      })
    const now = Date.now()
    const active: Active = {
      ctx: state.ctx,
      info: {
        id,
        sessionID: input.sessionID,
        pid: proc.pid,
        command: input.command,
        cwd,
        description: input.description,
        ports: [],
        status: input.ready ? "starting" : "running",
        lifetime,
        ready: false,
        output: "",
        time: {
          started: now,
          updated: now,
        },
      },
      proc,
      start,
      pattern: readyPattern,
      log: logpath,
      control,
      token,
      shared: lifetime === "persistent" ? state.shared : undefined,
      offset: 0,
    }
    const processes = owner(state, lifetime)
    processes.set(id, active)
    proc.stdout?.on("data", (chunk) => append(active, chunk.toString("utf-8")))
    proc.stderr?.on("data", (chunk) => append(active, chunk.toString("utf-8")))
    proc.once("error", (err) => failed(active, err))
    proc.once("exit", (code, signal) => {
      if (processes.get(id) !== active || active.disposed) return
      if (lifetime !== "persistent") {
        exited(active, code, signal)
        return
      }
      void output(active)
        .then(async () => {
          const status = await probe(active)
          if (status === "owned" || status === "unknown") {
            watch(state.shared, active)
            return
          }
          exited(active, code, signal)
          await forget(state.shared, active)
        })
        .catch((err) => log.warn("failed to finalize persistent process", { err, id }))
    })
    try {
      if (lifetime === "persistent") {
        await verify(active)
        await save(state.shared, active, { create: true })
        proc.unref()
        await output(active)
        watch(state.shared, active)
      }
      publish(active)
      poll(active, PORT_START_MS)
      if (input.ready) await waitReady(active, input.ready, { ready, publish, persist })
      return clone(active.info)
    } catch (err) {
      active.disposed = true
      processes.delete(id)
      if (active.notify) clearTimeout(active.notify)
      if (active.poll) clearTimeout(active.poll)
      if (active.watch) clearTimeout(active.watch)
      const stopped = await rollback(active).catch((cause) => {
        log.error("failed to roll back persistent process", { cause, id })
        return false
      })
      if (lifetime === "persistent" && !stopped) {
        active.disposed = false
        processes.set(id, active)
        const saved = await save(state.shared, active, { create: true })
          .then(() => true)
          .catch((cause) => {
            log.error("failed to preserve persistent process after rollback", { cause, id })
            return false
          })
        if (!saved) recover(state.shared, active)
        proc.unref()
        publish(active)
        watch(state.shared, active)
      }
      if (lifetime === "persistent" && stopped) await forget(state.shared, active)
      throw err
    }
  }

  async function cleanup(shared: Shared, file: string, name: string) {
    const id = name.endsWith(".json") ? name.slice(0, -5) : ""
    const files = [
      file,
      ...(id.startsWith("bgp") ? [path.join(logroot(shared), `${id}.log`), path.join(root(shared), `${id}.stop`)] : []),
    ]
    await Promise.all(files.map((item) => rm(item, { force: true })))
  }

  async function records(state: State) {
    const shared = state.shared
    await secure(shared)
    const dir = root(shared)
    const files = await readdir(dir).catch((err) => {
      if (code(err) === "ENOENT") return []
      throw err
    })
    const records = files.filter((item) => item.endsWith(".json"))
    if (records.length === 0 || !(await claim(shared))) return
    for (const name of records) {
      const file = path.join(dir, name)
      const record = await readFile(file, "utf8")
        .then((text) => Schema.decodeUnknownSync(Persisted)(JSON.parse(text)))
        .catch((err) => {
          log.warn("failed to read persistent process metadata", { err, file })
          return undefined
        })
      if (!record) {
        await cleanup(shared, file, name)
        continue
      }
      if (record.scope !== shared.key || record.info.lifetime !== "persistent" || name !== `${record.info.id}.json`) {
        await cleanup(shared, file, name)
        continue
      }
      if (shared.processes.has(record.info.id)) continue
      const active: Active = {
        ctx: state.ctx,
        info: record.info,
        start: record.start,
        pattern: pattern(record.start.ready?.pattern),
        log: logfile(shared, record.info.id),
        control: controlfile(shared, record.info.id),
        token: record.token,
        shared,
        offset: 0,
        saved: true,
      }
      active.info.output = ""
      active.info.ports = []
      const status = await probe(active)
      if (shared.processes.has(active.info.id)) continue
      if (status === "unknown") {
        log.warn("persistent process ownership is unknown", { id: active.info.id })
        continue
      }
      if (status !== "owned") {
        await cleanup(shared, file, name)
        continue
      }
      if (process.platform !== "win32") {
        await Promise.all([chmod(file, 0o600), chmod(logfile(shared, active.info.id), 0o600).catch(() => undefined)])
      }
      shared.processes.set(active.info.id, active)
      await output(active)
      watch(shared, active)
      poll(active, PORT_START_MS)
      publish(active)
    }
  }

  function adopt(state: State) {
    if (state.shared.adopt) return state.shared.adopt
    const pending = records(state).finally(() => {
      if (state.shared.adopt === pending) state.shared.adopt = undefined
    })
    state.shared.adopt = pending
    return pending
  }

  const stateLayer = Layer.effect(
    StateService,
    Effect.gen(function* () {
      const shared = new Map<string, Shared>()
      const ref = yield* InstanceState.make(
        Effect.fn("BackgroundProcess.state")(function* (ctx) {
          const scope = scoped(ctx)
          const current = shared.get(scope.key) ?? { ...scope, processes: new Map<ID, Active>() }
          shared.set(scope.key, current)
          const state: State = { ctx, dir: ctx.directory, processes: new Map(), shared: current }
          yield* Effect.promise(() => adopt(state))
          yield* Effect.addFinalizer(() =>
            Effect.promise(async () => {
              await Promise.all(
                Array.from(state.processes.values()).map((active) =>
                  terminate(state, active, { remove: true, silent: true }),
                ),
              )
              state.processes.clear()
            }),
          )
          return state
        }),
      )
      yield* Effect.addFinalizer(() =>
        Effect.promise(async () => {
          for (const current of shared.values()) {
            await Promise.all(
              Array.from(current.processes.values()).map(async (active) => {
                active.disposed = true
                if (active.notify) clearTimeout(active.notify)
                if (active.poll) clearTimeout(active.poll)
                if (active.watch) clearTimeout(active.watch)
                if (active.retry) clearTimeout(active.retry)
                active.proc?.removeAllListeners()
                active.proc?.stdout?.destroy()
                active.proc?.stderr?.destroy()
                await save(current, active, { create: !terminal(active.info.status), disposed: true })
              }),
            )
            current.processes.clear()
            await current.lease
              ?.release()
              .catch((err: unknown) => log.warn("failed to release persistent process scope", { err, scope: current.key }))
          }
          shared.clear()
        }),
      )
      return StateService.of({ get: () => InstanceState.get(ref) })
    }),
  )

  const runtime = makeRuntime(StateService, stateLayer)
  FoxShutdown.register(() => runtime.dispose())

  function state() {
    return runtime.runPromise((svc) => svc.get())
  }

  function find(state: State, id: ID) {
    return state.processes.get(id) ?? state.shared.processes.get(id)
  }

  function values(state: State) {
    return [...state.processes.values(), ...state.shared.processes.values()]
  }

  export function shutdown() {
    return runtime.dispose()
  }

  export async function start(input: StartInput) {
    return launch(await state(), input)
  }

  export async function list(input?: { sessionID?: SessionID }) {
    const current = await state()
    await adopt(current)
    return values(current)
      .map((active) => clone(active.info))
      .filter((info) => !input?.sessionID || info.sessionID === input.sessionID || info.lifetime === "persistent")
      .toSorted((a, b) => a.time.started - b.time.started || a.id.localeCompare(b.id))
  }

  export async function get(id: ID) {
    const current = await state()
    if (!find(current, id)) await adopt(current)
    const active = find(current, id)
    return active ? clone(active.info) : undefined
  }

  export async function logs(id: ID): Promise<Logs | undefined> {
    const current = await state()
    if (!find(current, id)) await adopt(current)
    const active = find(current, id)
    if (!active) return
    return { id: active.info.id, sessionID: active.info.sessionID, output: active.info.output }
  }

  export async function stop(id: ID) {
    const current = await state()
    if (!find(current, id)) await adopt(current)
    const active = find(current, id)
    if (!active) return
    await terminate(current, active)
    return clone(active.info)
  }

  export async function restart(id: ID) {
    const current = await state()
    if (!find(current, id)) await adopt(current)
    const active = find(current, id)
    if (!active) return
    const input = active.start
    await terminate(current, active, { remove: true })
    return launch(current, input, id)
  }

  export async function stopSession(sessionID: SessionID) {
    const current = await state()
    const list = Array.from(current.processes.values()).filter((active) => active.info.sessionID === sessionID)
    await Promise.all(
      list.map(async (active) => {
        if (active.info.lifetime === "parent" && active.start.parentID) {
          active.info.sessionID = active.start.parentID
          active.info.lifetime = "session"
          active.start.sessionID = active.start.parentID
          active.start.lifetime = "session"
          delete active.start.parentID
          active.info.time.updated = Date.now()
          publish(active)
          return
        }
        await terminate(current, active, { remove: true })
      }),
    )
  }
}
