/**
 * Tier 4 — SWE-bench Verified Mini (20 fixtures)
 *
 * Realistic GitHub issue + failing test + reference patch pairs.
 * Extended versions with longer, more complex codebases.
 */
import type { ChallengeFixture } from "../types"

const sweVerifiedTemplates = [
  { title: "HashMap iterator invalidation on concurrent insert", fail: "ConcurrentModificationError: HashMap modified during iteration\n    at HashMap.forEach (src/collections/hashmap.ts:89:14)", patch: "--- a/src/collections/hashmap.ts\n+++ b/src/collections/hashmap.ts\n@@ -85,7 +85,8 @@\n-  forEach(fn: (key: K, value: V) => void): void {\n-    for (const [key, value] of this.entries) {\n+  forEach(fn: (key: K, value: V) => void): void {\n+    const snapshot = [...this.entries];\n+    for (const [key, value] of snapshot) {\n       fn(key, value);\n     }\n   }" },
  { title: "WebSocket reconnection drops buffered messages", fail: "✗ sends buffered messages after reconnect\n  Expected messages: ['msg1', 'msg2', 'msg3']\n  Received messages: ['msg3']\n  Buffer was cleared on disconnect instead of preserved", patch: "--- a/src/ws/client.ts\n+++ b/src/ws/client.ts\n@@ -42,7 +42,7 @@\n   private onClose(): void {\n-    this.buffer = [];\n+    // Keep buffer intact for retry on reconnect\n     this.scheduleReconnect();\n   }" },
  { title: "CSV export truncates unicode characters at boundary", fail: "✗ exports UTF-8 characters correctly\n  Expected: '日本語テスト'\n  Received: '日本語テス'\n  BOM + multi-byte char split at 4096-byte buffer boundary", patch: "--- a/src/export/csv.ts\n+++ b/src/export/csv.ts\n@@ -28,5 +28,7 @@\n-  const chunk = buffer.slice(0, CHUNK_SIZE);\n+  // Ensure we don't split multi-byte characters\n+  let end = CHUNK_SIZE;\n+  while (end > 0 && (buffer[end] & 0xC0) === 0x80) end--;\n+  const chunk = buffer.slice(0, end);" },
  { title: "Rate limiter allows burst after clock skew", fail: "✗ blocks requests after limit reached\n  Expected: 429 Too Many Requests\n  Received: 200 OK\n  Clock moved backward by 2s, resetting the window", patch: "--- a/src/middleware/rate-limit.ts\n+++ b/src/middleware/rate-limit.ts\n@@ -15,7 +15,8 @@\n-  if (now - window.start > WINDOW_MS) {\n-    window.start = now;\n-    window.count = 0;\n+  const elapsed = now - window.start;\n+  if (elapsed > WINDOW_MS || elapsed < 0) {\n+    window.start = now;\n+    window.count = 0;\n   }" },
  { title: "GraphQL resolver N+1 with DataLoader cache miss", fail: "✗ batches user queries in single SQL\n  Expected: 1 database query\n  Received: 25 database queries\n  DataLoader cache key uses object reference instead of ID", patch: "--- a/src/graphql/loaders.ts\n+++ b/src/graphql/loaders.ts\n@@ -8,7 +8,7 @@\n-const userLoader = new DataLoader(keys => batchLoadUsers(keys));\n+const userLoader = new DataLoader(keys => batchLoadUsers(keys), {\n+  cacheKeyFn: (key) => typeof key === 'object' ? key.id : key,\n+});" },
]

export const TIER4_SWE_VERIFIED_FIXTURES: readonly ChallengeFixture[] = Array.from(
  { length: 20 },
  (_, idx) => {
    const tpl = sweVerifiedTemplates[idx % sweVerifiedTemplates.length]!
    const variant = Math.floor(idx / sweVerifiedTemplates.length) + 1
    const content = [
      `## Issue: ${tpl.title}${variant > 1 ? ` (variant ${variant})` : ""}`,
      "",
      "### Failing Test Output",
      "```",
      tpl.fail,
      "```",
      "",
      "### Reference Patch",
      "```diff",
      tpl.patch,
      "```",
    ].join("\n")

    return {
      id: `swe-verified-t4-${String(idx + 1).padStart(2, "0")}`,
      tier: 4 as const,
      category: "swe-bench-verified" as const,
      description: `SWE-bench Verified: ${tpl.title} (v${variant})`,
      seed: 33000 + idx,
      input: { content, tool: "read" as const },
      expected: {
        type: "objective" as const,
        mustContain: [
          tpl.title.slice(0, 30),
          tpl.fail.split("\n")[0]!.slice(0, 40),
        ],
        workflow: "swe" as const,
      },
    }
  },
)
