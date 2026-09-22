/**
 * Tier 3 — Corrupted Logs (15 fixtures)
 *
 * Interleaved processes, partial lines, random noise.
 * Check: routing still classifies as shell/test, no loss of real content.
 */
import type { ChallengeFixture } from "../types"

export const TIER3_CORRUPTED_LOG_FIXTURES: readonly ChallengeFixture[] = [
  {
    id: "corrupted-log-t3-01",
    tier: 3,
    category: "corrupted-logs",
    description: "Two processes interleaving stdout lines",
    seed: 21001,
    input: {
      content: [
        "[process-A] Starting initialization...",
        "[process-B] Connecting to database...",
        "[process-A] Loading configuration from /etc/app/config.yaml",
        "[process-B] Connection established: postgres://localhost:5432/app",
        "[process-A] Config loaded: 14 keys, 3 overrides",
        "[process-B] Running migrations...",
        "[process-A] Starting HTTP server on :3000",
        "[process-B] Migration 001_create_users applied (45ms)",
        "[process-B] Migration 002_add_sessions applied (23ms)",
        "[process-A] Server ready, accepting connections",
        "[process-B] All 2 migrations applied successfully",
        "[process-A] Health check: OK",
      ].join("\n"),
      tool: "bash",
      command: "docker compose logs",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "[process-A] Starting initialization",
        "[process-B] Connection established",
        "Migration 001_create_users",
        "Server ready",
      ],
      workflow: "swe",
    },
  },
  {
    id: "corrupted-log-t3-02",
    tier: 3,
    category: "corrupted-logs",
    description: "Partial lines cut mid-word (simulating buffer flush)",
    seed: 21002,
    input: {
      content: [
        "[2026-09-20T14:30:01Z] INFO: Processing batch item #1",
        "[2026-09-20T14:30:01Z] INFO: Processing batch item #2",
        "[2026-09-20T14:30:02Z] INFO: Processing bat",
        "ch item #3 — completed with warnings",
        "[2026-09-20T14:30:02Z] INFO: Processing batch item #4",
        "[2026-09-20T14:30:03Z] WARN: Slow query detec",
        "ted: SELECT * FROM orders WHERE status = 'pending' (4523ms)",
        "[2026-09-20T14:30:03Z] INFO: Processing batch item #5",
      ].join("\n"),
      tool: "bash",
      command: "tail -f /var/log/app.log",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "Processing bat",
        "ch item #3",
        "Slow query detec",
        "ted: SELECT",
        "4523ms",
      ],
      workflow: "swe",
    },
  },
  {
    id: "corrupted-log-t3-03",
    tier: 3,
    category: "corrupted-logs",
    description: "ANSI escape sequences mixed with JSON log lines",
    seed: 21003,
    input: {
      content: [
        '\x1b[32m{"level":"info","msg":"Server started","port":3000}\x1b[0m',
        '\x1b[33m{"level":"warn","msg":"Deprecated API call","endpoint":"/v1/users"}\x1b[0m',
        '\x1b[31m{"level":"error","msg":"Connection refused","host":"redis:6379"}\x1b[0m',
        '\x1b[32m{"level":"info","msg":"Retry successful","attempt":2}\x1b[0m',
        '\x1b[1m\x1b[31m{"level":"fatal","msg":"Out of memory","heap_used":"3.9GB","heap_max":"4GB"}\x1b[0m',
      ].join("\n"),
      tool: "bash",
      command: "docker logs app-server",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "Server started",
        "Deprecated API call",
        "Connection refused",
        "Out of memory",
        "3.9GB",
      ],
      workflow: "swe",
    },
  },
  {
    id: "corrupted-log-t3-04",
    tier: 3,
    category: "corrupted-logs",
    description: "Log with null bytes and control characters embedded",
    seed: 21004,
    input: {
      content: `[INFO] Normal log line
[INFO] Line with embedded null\x00byte here
[WARN] Tab\tseparated\tfields
[ERROR] Critical failure\x07\x07 — alert bells
[INFO] Recovery after control chars: status=OK
[DEBUG] Binary blob reference: key=\x01\x02\x03data_id_42`,
      tool: "bash",
      command: "cat /var/log/system.log",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "Normal log line",
        "Critical failure",
        "Recovery after control chars",
        "status=OK",
      ],
      workflow: "swe",
    },
  },
  {
    id: "corrupted-log-t3-05",
    tier: 3,
    category: "corrupted-logs",
    description: "Mixed JSON and plaintext log formats",
    seed: 21005,
    input: {
      content: [
        '{"timestamp":"2026-09-20T10:00:00Z","level":"INFO","message":"App starting"}',
        "2026-09-20 10:00:01 [WARN] Legacy logger: config file not found, using defaults",
        '{"timestamp":"2026-09-20T10:00:02Z","level":"INFO","message":"Database connected"}',
        "2026-09-20 10:00:03 [ERROR] Legacy logger: failed to load plugin 'auth-v1'",
        '{"timestamp":"2026-09-20T10:00:04Z","level":"ERROR","message":"Plugin load failed","plugin":"auth-v1","error":"module not found"}',
        "Server ready on port 3000",
      ].join("\n"),
      tool: "bash",
      command: "docker compose logs app",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "App starting",
        "Legacy logger",
        "Database connected",
        "auth-v1",
        "Server ready on port 3000",
      ],
      workflow: "swe",
    },
  },
  {
    id: "corrupted-log-t3-06",
    tier: 3,
    category: "corrupted-logs",
    description: "Log with extremely long single line (stacktrace as one line)",
    seed: 21006,
    input: {
      content: [
        "[ERROR] Unhandled exception: " + Array.from({ length: 50 }, (_, i) =>
          `at Module${i}.process (node_modules/@scope/pkg-${i}/dist/index.js:${100 + i}:${20 + i})`
        ).join(" → "),
        "[INFO] Process recovered, continuing execution",
      ].join("\n"),
      tool: "bash",
      command: "node dist/server.js",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "Unhandled exception",
        "Module0.process",
        "Module49.process",
        "Process recovered",
      ],
      workflow: "swe",
    },
  },
  {
    id: "corrupted-log-t3-07",
    tier: 3,
    category: "corrupted-logs",
    description: "Repeated identical log lines (100x) with one unique line embedded",
    seed: 21007,
    input: {
      content: [
        ...Array.from({ length: 50 }, () => "[DEBUG] Heartbeat: connection alive, latency=2ms"),
        "[CRITICAL] Database failover detected: primary=db-1, new-primary=db-2, clients-reconnecting=147",
        ...Array.from({ length: 50 }, () => "[DEBUG] Heartbeat: connection alive, latency=2ms"),
      ].join("\n"),
      tool: "bash",
      command: "tail -100 /var/log/app.log",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "Heartbeat: connection alive",
        "Database failover detected",
        "new-primary=db-2",
        "clients-reconnecting=147",
      ],
      workflow: "swe",
    },
  },
  {
    id: "corrupted-log-t3-08",
    tier: 3,
    category: "corrupted-logs",
    description: "Multi-line stack trace with garbled line in the middle",
    seed: 21008,
    input: {
      content: `Error: ECONNREFUSED 127.0.0.1:6379
    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1494:16)
    at TCPConnectWrap.callbackTrampoline (node:internal/async_hooks:128:17)
\x00\x00GARBLED_DATA_FROM_MEMORY_CORRUPTION\x00\x00
    at RedisClient.connect (/app/node_modules/redis/lib/client.js:88:14)
    at SessionStore.initialize (/app/src/session/store.ts:42:22)
    at Application.bootstrap (/app/src/app.ts:15:8)`,
      tool: "bash",
      command: "node dist/index.js",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "ECONNREFUSED 127.0.0.1:6379",
        "TCPConnectWrap",
        "RedisClient.connect",
        "SessionStore.initialize",
        "Application.bootstrap",
      ],
      workflow: "swe",
    },
  },
  {
    id: "corrupted-log-t3-09",
    tier: 3,
    category: "corrupted-logs",
    description: "Log with timestamps in 3 different formats",
    seed: 21009,
    input: {
      content: [
        "2026-09-20T10:00:00.000Z [INFO] ISO format timestamp",
        "Sep 20 10:00:01 syslog-style [WARN] Syslog format timestamp",
        "1727000002 [ERROR] Unix epoch timestamp",
        "2026/09/20 10:00:03 [DEBUG] Slash-separated timestamp",
        "Fri Sep 20 10:00:04 UTC 2026 [INFO] Human-readable timestamp",
      ].join("\n"),
      tool: "bash",
      command: "cat /var/log/mixed.log",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "ISO format timestamp",
        "Syslog format timestamp",
        "Unix epoch timestamp",
        "Slash-separated timestamp",
        "Human-readable timestamp",
      ],
      workflow: "swe",
    },
  },
  {
    id: "corrupted-log-t3-10",
    tier: 3,
    category: "corrupted-logs",
    description: "Webpack/Vite build output with progress bars and ANSI",
    seed: 21010,
    input: {
      content: [
        "\x1b[2K\x1b[1A\x1b[2K\x1b[1A[build] Compiling... (1/45)",
        "\x1b[2K\x1b[1A\x1b[2K\x1b[1A[build] Compiling... (15/45)",
        "\x1b[2K\x1b[1A\x1b[2K\x1b[1A[build] Compiling... (30/45)",
        "\x1b[2K\x1b[1A\x1b[2K\x1b[1A[build] Compiling... (45/45)",
        "\x1b[32m✓\x1b[0m Build completed in 3.2s",
        "",
        "  \x1b[1mAssets:\x1b[0m",
        "    dist/index.js    245.3 KB (gzipped: 67.8 KB)",
        "    dist/vendor.js   892.1 KB (gzipped: 234.5 KB)",
        "    dist/styles.css   45.2 KB (gzipped: 8.9 KB)",
        "",
        "\x1b[33m⚠\x1b[0m 3 warnings:",
        "  - Module 'lodash' is large (68KB), consider cherry-picking",
        "  - Source map generation disabled for production",
        "  - Unused export 'debugHelper' in src/utils.ts",
      ].join("\n"),
      tool: "bash",
      command: "npm run build",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "Build completed",
        "dist/index.js",
        "245.3 KB",
        "lodash",
        "debugHelper",
      ],
      workflow: "swe",
    },
  },
  {
    id: "corrupted-log-t3-11",
    tier: 3,
    category: "corrupted-logs",
    description: "Docker compose output with service name prefixes and interleaving",
    seed: 21011,
    input: {
      content: [
        "web-1     | [nestjs] Starting application...",
        "db-1      | PostgreSQL 15.4 on x86_64, compiled by gcc, 64-bit",
        "redis-1   | Ready to accept connections on port 6379",
        "web-1     | [nestjs] AppModule dependencies initialized",
        "worker-1  | [bull] Worker started, processing queue 'emails'",
        "db-1      | LOG:  database system is ready to accept connections",
        "web-1     | [nestjs] Mapped {/api/users, GET} route",
        "worker-1  | [bull] Processed job #1: send-welcome-email (234ms)",
        "web-1     | [nestjs] Mapped {/api/orders, GET} route",
        "web-1     | [nestjs] Application running on http://0.0.0.0:3000",
        "worker-1  | [bull] Processed job #2: send-receipt-email (189ms)",
        "web-1     | [nestjs] Health check: all services healthy",
      ].join("\n"),
      tool: "bash",
      command: "docker compose up",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "web-1",
        "db-1",
        "redis-1",
        "worker-1",
        "Application running",
        "send-welcome-email",
      ],
      workflow: "swe",
    },
  },
  {
    id: "corrupted-log-t3-12",
    tier: 3,
    category: "corrupted-logs",
    description: "Python multiline exception with nested cause chain",
    seed: 21012,
    input: {
      content: `Traceback (most recent call last):
  File "/app/src/handler.py", line 45, in process_request
    result = await db.execute(query)
  File "/app/src/db.py", line 23, in execute
    conn = self.pool.acquire()
  File "/app/lib/pool.py", line 89, in acquire
    raise PoolExhaustedError("No available connections")
app.errors.PoolExhaustedError: No available connections

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "/app/src/server.py", line 12, in handle
    response = await handler.process_request(request)
  File "/app/src/handler.py", line 48, in process_request
    raise ServiceUnavailable("Database pool exhausted") from e
app.errors.ServiceUnavailable: Database pool exhausted`,
      tool: "bash",
      command: "python -m app.server",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "PoolExhaustedError",
        "No available connections",
        "ServiceUnavailable",
        "Database pool exhausted",
        "direct cause",
      ],
      workflow: "swe",
    },
  },
  {
    id: "corrupted-log-t3-13",
    tier: 3,
    category: "corrupted-logs",
    description: "Log output with embedded SQL query containing special characters",
    seed: 21013,
    input: {
      content: `[2026-09-20 10:00:00] [SLOW_QUERY] Duration: 4523ms
Query: SELECT u.id, u.name, o.total
  FROM users u
  JOIN orders o ON o.user_id = u.id
  WHERE u.created_at > '2026-01-01'
    AND o.status IN ('pending', 'processing')
    AND u.name LIKE '%O''Brien%'
    AND o.total >= 100.00
  ORDER BY o.created_at DESC
  LIMIT 1000;
[2026-09-20 10:00:00] [SLOW_QUERY] Rows returned: 847
[2026-09-20 10:00:00] [SLOW_QUERY] Suggested index: CREATE INDEX idx_orders_user_status ON orders(user_id, status);`,
      tool: "bash",
      command: "cat /var/log/slow-queries.log",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "Duration: 4523ms",
        "O''Brien",
        "Rows returned: 847",
        "CREATE INDEX",
      ],
      workflow: "swe",
    },
  },
  {
    id: "corrupted-log-t3-14",
    tier: 3,
    category: "corrupted-logs",
    description: "Kubernetes pod logs with restart loop and OOMKilled",
    seed: 21014,
    input: {
      content: `app-deployment-7b9f4c8d5-x2k9j  Normal   Scheduled  successfully assigned default/app-deployment-7b9f4c8d5-x2k9j to node-3
app-deployment-7b9f4c8d5-x2k9j  Normal   Pulling    Pulling image "registry.io/app:v2.3.1"
app-deployment-7b9f4c8d5-x2k9j  Normal   Pulled     Successfully pulled image in 2.3s
app-deployment-7b9f4c8d5-x2k9j  Normal   Created    Created container app
app-deployment-7b9f4c8d5-x2k9j  Normal   Started    Started container app
app-deployment-7b9f4c8d5-x2k9j  Warning  OOMKilled  Container app exceeded memory limit (512Mi), killed
app-deployment-7b9f4c8d5-x2k9j  Normal   Pulling    Pulling image "registry.io/app:v2.3.1" (restart #1)
app-deployment-7b9f4c8d5-x2k9j  Normal   Started    Started container app
app-deployment-7b9f4c8d5-x2k9j  Warning  OOMKilled  Container app exceeded memory limit (512Mi), killed
app-deployment-7b9f4c8d5-x2k9j  Warning  BackOff    Back-off restarting failed container (restart #2)
app-deployment-7b9f4c8d5-x2k9j  Normal   Pulling    Pulling image "registry.io/app:v2.3.1" (restart #2)
app-deployment-7b9f4c8d5-x2k9j  Warning  OOMKilled  Container app exceeded memory limit (512Mi), killed
app-deployment-7b9f4c8d5-x2k9j  Warning  BackOff    Back-off restarting failed container (restart #3, CrashLoopBackOff)`,
      tool: "bash",
      command: "kubectl describe pod app-deployment-7b9f4c8d5-x2k9j",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "OOMKilled",
        "512Mi",
        "CrashLoopBackOff",
        "registry.io/app:v2.3.1",
        "restart #3",
      ],
      workflow: "swe",
    },
  },
  {
    id: "corrupted-log-t3-15",
    tier: 3,
    category: "corrupted-logs",
    description: "Log with base64-encoded blob embedded in structured output",
    seed: 21015,
    input: {
      content: `[2026-09-20T10:00:00Z] [REQUEST] POST /api/upload
[2026-09-20T10:00:00Z] [REQUEST] Content-Type: multipart/form-data
[2026-09-20T10:00:00Z] [REQUEST] Body preview (first 200 chars of base64):
SGVsbG8gV29ybGQhIFRoaXMgaXMgYSBiYXNlNjQgZW5jb2RlZCBwYXlsb2FkIHRoYXQgY29udGFpbnMgc29tZSBiaW5hcnkgZGF0YS4gSXQgc2hvdWxkIG5vdCBiZSBtb2RpZmllZCBieSB0aGUgY29tcHJlc3Nv
[2026-09-20T10:00:01Z] [RESPONSE] 201 Created
[2026-09-20T10:00:01Z] [RESPONSE] {"id": "upload-42", "size": 1048576, "hash": "sha256:a1b2c3d4e5f6"}`,
      tool: "bash",
      command: "cat /var/log/access.log",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "POST /api/upload",
        "multipart/form-data",
        "SGVsbG8gV29ybGQ",
        "201 Created",
        "upload-42",
        "sha256:a1b2c3d4e5f6",
      ],
      workflow: "swe",
    },
  },
]
