/**
 * Tier 3 — Adversarial Expansion (6 new fixtures)
 *
 * New adversarial modalities that stress compressor edge cases:
 *   1. Mixed encodings (UTF-8 + Latin-1 + BOM markers)
 *   2. Overlapping diff hunks
 *   3. Logs with embedded binary/base64 blobs
 *   4. Stack traces with circular references (must NOT dedupe)
 *   5. JSON-within-HTML-within-shell-output
 *   6. Multi-language mixed stack traces
 */
import type { ChallengeFixture } from "../types"

export const TIER3_ADVERSARIAL_EXPANSION_FIXTURES: readonly ChallengeFixture[] = [
  // 1. Mixed encodings with BOM markers
  {
    id: "adv-encoding-t3-01",
    tier: 3,
    category: "corrupted-logs",
    description: "Mixed encoding content with BOM markers and special chars",
    seed: 21001,
    input: {
      content: [
        `\uFEFF=== Log Output (UTF-8 BOM) ===`,
        `2026-09-22T10:00:00Z INFO  Processing file: données_clients.csv`,
        `2026-09-22T10:00:01Z WARN  Row 42: Invalid character in field "naïve_bayes_score": café → caf\uFFFD`,
        `2026-09-22T10:00:02Z INFO  Résumé: 1,234 rows processed, 3 warnings`,
        `2026-09-22T10:00:03Z ERROR Column "straße" contains non-ASCII: München, Zürich, São Paulo`,
        `2026-09-22T10:00:04Z INFO  Encoding detection: UTF-8 (with BOM \uFEFF detected)`,
        `2026-09-22T10:00:05Z WARN  Mixed line endings: CR+LF (42), LF (958), CR (0)`,
        `2026-09-22T10:00:06Z INFO  Output written to: rapport_données_2026.json`,
      ].join("\n"),
      tool: "bash",
      command: "python3 process.py",
    },
    expected: {
      type: "robustness",
      mustContain: ["données_clients.csv", "naïve_bayes_score", "straße", "München"],
      mustNotContain: ["undefined", "NaN"],
      workflow: "swe",
    },
  },

  // 2. Overlapping diff hunks
  {
    id: "adv-overlap-t3-01",
    tier: 3,
    category: "malformed-diffs",
    description: "Diff with overlapping/adjacent hunk ranges",
    seed: 21002,
    input: {
      content: `diff --git a/src/parser.ts b/src/parser.ts
--- a/src/parser.ts
+++ b/src/parser.ts
@@ -10,5 +10,7 @@
 import { Token } from './types';
-import { deprecated } from './legacy';
+import { modern } from './modern';
+import { helper } from './utils';
 
 export class Parser {
@@ -12,3 +14,4 @@
 export class Parser {
   private tokens: Token[] = [];
+  private cache = new Map();
 
@@ -20,6 +23,8 @@
   parse(input: string): AST {
     const tokens = this.tokenize(input);
-    return this.buildAST(tokens);
+    if (this.cache.has(input)) return this.cache.get(input);
+    const ast = this.buildAST(tokens);
+    this.cache.set(input, ast);
+    return ast;
   }`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "robustness",
      mustContain: ["import { modern }", "private cache = new Map()", "this.cache.has(input)", "cache"],
      workflow: "swe",
    },
  },

  // 3. Logs with embedded base64 blobs
  {
    id: "adv-binary-t3-01",
    tier: 3,
    category: "corrupted-logs",
    description: "Server logs with embedded base64-encoded payloads",
    seed: 21003,
    input: {
      content: [
        `2026-09-22T10:00:00Z [API] POST /api/upload 200 1.2s`,
        `2026-09-22T10:00:00Z [API] Request payload (base64):`,
        `eyJmaWxlTmFtZSI6InJlcG9ydC5wZGYiLCJjb250ZW50VHlwZSI6ImFwcGxpY2F0aW9uL3BkZiIsInNpemUiOjEyMzQ1Nn0=`,
        `2026-09-22T10:00:01Z [API] Response: {"id":"file-abc123","status":"uploaded"}`,
        `2026-09-22T10:00:02Z [WORKER] Processing file-abc123`,
        `2026-09-22T10:00:02Z [WORKER] Hex dump (first 64 bytes):`,
        `25 50 44 46 2D 31 2E 34 0A 25 E2 E3 CF D3 0A 31`,
        `20 30 20 6F 62 6A 0A 3C 3C 2F 54 79 70 65 2F 43`,
        `61 74 61 6C 6F 67 2F 50 61 67 65 73 20 32 20 30`,
        `20 52 3E 3E 0A 65 6E 64 6F 62 6A 0A 32 20 30 20`,
        `2026-09-22T10:00:05Z [WORKER] File processed: 4 pages extracted`,
        `2026-09-22T10:00:06Z [API] GET /api/files/file-abc123/status 200 0.1s`,
      ].join("\n"),
      tool: "bash",
      command: "docker logs api",
    },
    expected: {
      type: "robustness",
      mustContain: ["file-abc123", "base64", "Hex dump", "4 pages extracted"],
      mustNotContain: ["[object Object]"],
      workflow: "swe",
    },
  },

  // 4. Stack traces with circular references (must NOT dedupe)
  {
    id: "adv-circular-t3-01",
    tier: 3,
    category: "partial-stacktraces",
    description: "Recursive/circular stack trace that must not be deduplicated",
    seed: 21004,
    input: {
      content: [
        `Error: Maximum call stack size exceeded`,
        `    at EventEmitter.emit (events.js:315:12)`,
        `    at processMessage (src/worker.ts:42:5)`,
        `    at handleEvent (src/events.ts:18:3)`,
        `    at EventEmitter.emit (events.js:315:12)`,
        `    at processMessage (src/worker.ts:42:5)`,
        `    at handleEvent (src/events.ts:18:3)`,
        `    at EventEmitter.emit (events.js:315:12)`,
        `    at processMessage (src/worker.ts:42:5)`,
        `    at handleEvent (src/events.ts:18:3)`,
        `    at EventEmitter.emit (events.js:315:12)`,
        `    at processMessage (src/worker.ts:42:5)`,
        `    at handleEvent (src/events.ts:18:3)`,
        `    ... 148 more frames`,
        ``,
        `Context: Processing message queue batch #42`,
        `Queue depth: 1,247 messages`,
        `Worker PID: 28419`,
      ].join("\n"),
      tool: "bash",
      command: "node worker.js",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "Maximum call stack size exceeded",
        "processMessage (src/worker.ts:42:5)",
        "handleEvent (src/events.ts:18:3)",
        "148 more frames",
      ],
      // The circular frames MUST appear multiple times — deduplication would be wrong
      mustNotContain: ["[×"],  // Our dedup marker should NOT appear
      workflow: "swe",
    },
  },

  // 5. JSON-within-HTML-within-shell-output
  {
    id: "adv-nested-t3-01",
    tier: 3,
    category: "ambiguous-workflows",
    description: "Nested format: JSON inside HTML inside shell output",
    seed: 21005,
    input: {
      content: [
        `$ curl -s http://localhost:3000/debug/state | head -30`,
        `<!DOCTYPE html>`,
        `<html lang="en">`,
        `<head><title>Debug State</title></head>`,
        `<body>`,
        `  <h1>Application State</h1>`,
        `  <pre id="state-dump">`,
        `{`,
        `  "server": {`,
        `    "uptime": 86400,`,
        `    "version": "2.1.0",`,
        `    "config": {`,
        `      "database": "postgres://db:5432/app",`,
        `      "redis": "redis://cache:6379/0",`,
        `      "features": ["auth", "search", "export"]`,
        `    }`,
        `  },`,
        `  "metrics": {`,
        `    "requests_total": 1234567,`,
        `    "errors_total": 42,`,
        `    "p99_latency_ms": 125.5`,
        `  }`,
        `}`,
        `  </pre>`,
        `  <script>`,
        `    const data = JSON.parse(document.getElementById('state-dump').textContent);`,
        `    console.log('Loaded state:', data.server.version);`,
        `  </script>`,
        `</body>`,
        `</html>`,
        `$ echo "Exit code: $?"`,
        `Exit code: 0`,
      ].join("\n"),
      tool: "bash",
      command: "curl http://localhost:3000/debug/state",
    },
    expected: {
      type: "robustness",
      mustContain: ["state-dump", "postgres://db:5432/app", "requests_total", "p99_latency_ms"],
      mustNotContain: ["[object Object]"],
      workflow: "swe",
    },
  },

  // 6. Multi-language mixed stack traces
  {
    id: "adv-polyglot-t3-01",
    tier: 3,
    category: "partial-stacktraces",
    description: "Concatenated Python, Node, Java, and Bash error traces",
    seed: 21006,
    input: {
      content: [
        `=== Python Worker (pid 1234) ===`,
        `Traceback (most recent call last):`,
        `  File "/app/worker.py", line 42, in process_batch`,
        `    result = api_client.post("/transform", data=payload)`,
        `  File "/app/lib/http.py", line 18, in post`,
        `    raise ConnectionError(f"Failed to connect to {url}")`,
        `ConnectionError: Failed to connect to /transform`,
        ``,
        `=== Node.js API Gateway (pid 5678) ===`,
        `Error: ECONNREFUSED 127.0.0.1:8080`,
        `    at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1141:16)`,
        `    at Protocol._enqueue (/app/node_modules/mysql2/lib/protocol.js:45:53)`,
        `    at Connection.query (/app/node_modules/mysql2/lib/connection.js:202:25)`,
        `    at /app/src/routes/transform.ts:28:5`,
        ``,
        `=== Java Backend (pid 9012) ===`,
        `java.sql.SQLException: Cannot acquire connection from pool`,
        `    at com.zaxxer.hikari.pool.HikariPool.createTimeoutException(HikariPool.java:695)`,
        `    at com.zaxxer.hikari.pool.HikariPool.getConnection(HikariPool.java:197)`,
        `    at com.app.db.ConnectionManager.getConnection(ConnectionManager.java:42)`,
        `    at com.app.service.TransformService.execute(TransformService.java:88)`,
        `Caused by: java.net.ConnectException: Connection refused (Connection refused)`,
        `    at java.net.PlainSocketImpl.socketConnect(Native Method)`,
        ``,
        `=== systemctl status mysql ===`,
        `● mysql.service - MySQL Community Server`,
        `   Active: inactive (dead) since Mon 2026-09-22 10:00:00 UTC; 5min ago`,
        `   Process: 3456 ExecStart=/usr/sbin/mysqld (code=exited, status=1/FAILURE)`,
      ].join("\n"),
      tool: "bash",
      command: "cat /tmp/debug-trace.log",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "ConnectionError: Failed to connect",
        "ECONNREFUSED",
        "java.sql.SQLException",
        "mysql.service",
      ],
      workflow: "swe",
    },
  },
]
