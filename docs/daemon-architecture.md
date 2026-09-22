# Fox Daemon & Client Architecture

> **Reference Guide**: Explains the internal mechanics, networking, state files, security, and multi-tenant project virtualization of the Fox Daemon (`fox serve`) and its client interactions (`fox`, `fox run`, `fox attach`, and `fox-acp-client`).

---

## 1. Executive Summary & Design Philosophy

The core architectural pattern behind Fox CLI is **"Single Binary, Decoupled Processes"** (the same architecture used by `tmux`, `docker`, `git`, and `ollama`):

```
                        THE UNIFIED FOX ARCHITECTURE
                        (Single Binary: `fox`)
                        
       ┌───────────────────────────────┐     ┌───────────────────────────────┐
       │     CLIENT 1: HUMAN TUI       │     │     CLIENT 2: VS CODE EXT     │
       │     `fox` (Interactive)       │     │     `fox acp` (IDE Client)    │
       │   • OpenTUI keyboard input    │     │   • Webview JSON-RPC 2.0      │
       │   • Zero state execution      │     │   • Zero state execution      │
       └───────────────┬───────────────┘     └───────────────┬───────────────┘
                       │                                     │
                       │  Local IPC / Unix Domain Socket     │
                       │  (or localhost HTTP/SSE)            │
                       ▼                                     ▼
       ┌─────────────────────────────────────────────────────────────────────┐
       │                    CORE BACKBONE: `fox serve`                       │
       │                           (The Daemon)                              │
       │  • SQLite Database (`fox.db`) & Session State                       │
       │  • Tool Engine (Git, Bash, Diff, Compaction)                        │
       │  • Multi-Project Instance Isolation (`x-fox-directory`)             │
       │  • Federation MCP Protocol & InfiniBand Mind-Speak                  │
       │  • SynOp Anubis Guardian Layer (Always running in daemon)           │
       └───────────────────────────────────┬─────────────────────────────────┘
                                           │ Spawns / Directs
                                           ▼
       ┌─────────────────────────────────────────────────────────────────────┐
       │                   RUNNER: `fox run --auto`                          │
       │                     (Headless Execution)                            │
       │  • Runs in the background (or CI, or cron)                          │
       │  • Drives the Doer / Subagent loop against daemon state             │
       │  • Emits events to `fox.db` so any Client can "attach" and watch   │
       └─────────────────────────────────────────────────────────────────────┘
```

### Why Decouple the Client from the Daemon?
1. **Resilience**: The interactive terminal UI (`fox`) can crash, be closed, or be resized without interrupting a running autonomous task.
2. **Resource Isolation**: Heavy compilation, large file diffs, and test executions do not block the terminal UI thread.
3. **Multi-Client Visibility**: A headless run launched on a remote node can be inspected in real time by connecting via `fox attach`.
4. **Zero SQLite Lock Collisions**: One process owns the database write-ahead log (WAL); multiple clients read and write via structured API calls.

---

## 2. Daemon Anatomy & Filesystem State

The daemon stores runtime discovery and lock state in your user state directory (`~/.local/state/fox/` or `$XDG_STATE_HOME/fox/`):

| File Path | Purpose | Permissions / Format |
|---|---|---|
| **`daemon.json`** | Active daemon state & discovery token | Permissions `0o600` (Owner read-write only) |
| **`daemon.log`** | Standard server log output | Log stream for headless operations |
| **`locks/kilocode-daemon`** | Cross-process file lock (`Flock`) | Mutex preventing competing daemon spawns |
| **`fox.db`** | Persistent SQLite database | Stored under `~/.local/share/fox/` |

### The `daemon.json` State File
When the daemon launches, it writes its connection details to `~/.local/state/fox/daemon.json`:
```json
{
  "pid": 28410,
  "hostname": "127.0.0.1",
  "port": 4097,
  "url": "http://127.0.0.1:4097",
  "urls": {
    "local": "http://localhost:4097",
    "bind": "http://127.0.0.1:4097"
  },
  "username": "fox",
  "password": "f8a1c92e-3b56-42d8-912a-0a4e7c83f120",
  "token": "Zm94OmY4YTFjOTJlL...",
  "version": "0.1.0",
  "startedAt": "2026-09-22T14:30:00.000Z",
  "log": "/home/k82l0804/.local/state/fox/log/daemon.log"
}
```

---

## 3. Networking & Security Model

### Dynamic Port Hunting
* Instead of failing on a hardcoded port, Fox hunts across a designated port block: **`4097` to `4116`** (`src/foxcode/daemon/daemon.ts:19`).
* It tests each port sequentially with a temporary TCP socket server. The first free port is bound.
* Explicit port overrides can be passed via `--port <number>`.

### Authentication & Containment
* **Cryptographic Token**: Every daemon spawn generates a random UUID password (`randomUUID()`).
* **HTTP Basic Auth**: All REST and SSE requests require `Authorization: Basic <base64(username:password)>`.
* **Filesystem Containment**: Because `daemon.json` has `0o600` permissions, other unprivileged users on a shared Linux server cannot read the token or access your session.

---

## 4. Lifecycle & The Discovery Handshake

### 1. Interactive Launch (`fox`)
When the user executes `fox` in a terminal:
```
1. `FoxTuiThreadDaemon.attach()` checks for an active daemon via `DaemonClient.connect()`.
2. Reads `~/.local/state/fox/daemon.json`.
3. Verifies `process.kill(pid, 0)` (OS process is alive).
4. Probes health: `GET http://127.0.0.1:4097/global/health` (with 2-second timeout).
5. If healthy:
   └── TUI attaches as a thin client via HTTP/SSE. (No duplicate server started!)
6. If not running or stale:
   └── Transparently starts a new background daemon or spawns an embedded worker thread.
```

### 2. Explicit Server Launch (`fox serve`)
Runs the daemon as a long-running service (used for `systemd`, Docker containers, or permanent GPU nodes like `aorus`):
```bash
fox serve --hostname 0.0.0.0 --port 4097
```
* Binds to network interfaces.
* Handles OS termination signals (`SIGTERM`, `SIGINT`, `SIGHUP`) to flush all active session instances before exiting.

### 3. Remote / Local Attach (`fox attach <url>`)
Allows any terminal to attach to an existing session:
```bash
# Attach to local daemon
fox attach http://localhost:4097

# Attach to remote cluster node over InfiniBand
fox attach http://aorus:4097 --password=secret --continue
```
* You can attach, monitor the Guardian and Doer, provide interactive prompts, and detach (`Ctrl+C`), leaving the remote execution untouched.

---

## 5. Multi-Project / Multi-Tenant Isolation

A key architectural advantage: **The Fox daemon is not bound to a single repository directory.**

In `src/cli/cmd/serve.ts`:
```typescript
// Server loads instances per-request via x-kilo-directory header — no
// need for an ambient project InstanceContext at startup.
instance: false
```

* When an API request or client connects from a folder (`/home/user/project-a`), the client passes the header:
  `x-fox-directory: /home/user/project-a` (or legacy `x-kilo-directory`).
* The daemon **lazily initializes an isolated `InstanceRuntime`** for that specific directory.
* **Result**: A single Fox daemon can simultaneously serve **10 different git repositories** across 10 terminal tabs or VS Code windows without lock conflicts or port collisions.

---

## 6. Self-Healing & Safety Watchdogs

### 1. Cross-Process Mutex (`Flock.withLock`)
Fox uses OS-level file locking (`fcntl`/`flock`) on `locks/kilocode-daemon`. If multiple scripts or terminals start at the exact same millisecond, they queue cleanly rather than racing to bind the same port or corrupting `daemon.json`.

### 2. Version Mismatch Auto-Reload
If Fox CLI is recompiled or upgraded (`bun run build`), the next `fox` client checks `probe.version !== InstallationVersion`. If the running daemon is an older version, Fox terminates the old daemon, deletes stale state, and spawns the upgraded version automatically.

### 3. Parent PID Watchdog (`src/foxcode/parent-watchdog.ts`)
When spawned by an IDE (like VS Code or Kilo extension), the editor passes its process ID via `FOX_PARENT_PID`.
* The daemon runs an internal polling watchdog.
* If the editor is hard-killed (`kill -9`) or crashes without sending `SIGTERM`, the watchdog detects that the parent PID has vanished and **automatically terminates the daemon**.
* This guarantees that no orphaned zombie processes are left running on the host machine.

---

## 7. The Federation Connection: Serving the Small Army

The daemon architecture directly enables **The Federation's multi-agent operations**:

1. **Persistent Node Daemon**: On dedicated cluster nodes (`aorus`, `baby`, `taichi`), `fox serve` runs continuously under `systemd`.
2. **Direct Peer MCP Interconnect**: Instances communicate peer-to-peer over InfiniBand via the daemon's HTTP/JSON-RPC routes without human relay.
3. **Resilient Detachment**: The Conductor can launch a 3-hour autonomous task from `speedy`, close the laptop lid, and check in later via `fox attach`.
4. **Crash Resurrection**: If a node fails, SynOp Anubis reads the shared state from SQLite/Git and resurrects the task on an alternate node using `fox run --auto --continue`.
