import type { CorpusFixture } from "../types"

export const DIFF_FIXTURES: readonly CorpusFixture[] = [
  {
    id: "diff-01-multi-hunk",
    name: "multi-hunk unified diff across 4 separate functions",
    category: "diff",
    tool: "bash",
    command: "git diff -U3",
    content: `diff --git a/src/session/llm.ts b/src/session/llm.ts
index 1a2b3c4..5d6e7f8 100644
--- a/src/session/llm.ts
+++ b/src/session/llm.ts
@@ -12,7 +12,7 @@ import { Effect } from "effect"
 import { Flag } from "@opencode-ai/core/flag/flag"
 import { Log } from "@opencode-ai/core/util/log"
 
-const logger = Log.create({ service: "llm-old" })
+const logger = Log.create({ service: "llm" })
 
 export interface LLMOptions {
   readonly model: string
@@ -45,8 +45,8 @@ export function createStream(opts: LLMOptions) {
   const client = getClient(opts.provider)
   const params = {
-    max_tokens: 2048,
-    temperature: 0.7,
+    max_tokens: 4096,
+    temperature: 0.2,
   }
   return client.stream(params)
 }
@@ -102,6 +102,7 @@ export function resolveModel(name: string): string {
   if (name.startsWith("claude")) return "anthropic/" + name
+  if (name.startsWith("gemini")) return "google/" + name
   return name
 }
@@ -180,7 +181,7 @@ export function finalizeResponse(res: Response): FinalResult {
-  return { done: true, code: 0 }
+  return { done: true, code: 0, verified: true }
 }`,
    mustContain: [
      "-const logger = Log.create({ service: \"llm-old\" })",
      "+const logger = Log.create({ service: \"llm\" })",
      "-    max_tokens: 2048,",
      "+    max_tokens: 4096,",
      "+  if (name.startsWith(\"gemini\")) return \"google/\" + name",
      "+  return { done: true, code: 0, verified: true }",
    ],
    minExpectedReductionPct: 20,
  },
  {
    id: "diff-02-lockfile-package-lock",
    name: "package-lock.json large diff (collapsed to concise summary)",
    category: "diff",
    tool: "bash",
    command: "git diff package-lock.json",
    content: `diff --git a/package-lock.json b/package-lock.json
index 7a8b9c0..1d2e3f4 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -10,120 +10,120 @@
${Array.from({ length: 60 }, (_, i) => [
  `-\t\t"node_modules/@types/node-${i}": {`,
  `-\t\t\t"version": "20.1.0",`,
  `-\t\t\t"resolved": "https://registry.npmjs.org/@types/node-${i}/-/node-${i}-20.1.0.tgz"`,
  `+\t\t"node_modules/@types/node-${i}": {`,
  `+\t\t\t"version": "20.2.0",`,
  `+\t\t\t"resolved": "https://registry.npmjs.org/@types/node-${i}/-/node-${i}-20.2.0.tgz"`,
]).flat().join("\n")}`,
    mustContain: [
      "diff --git a/package-lock.json b/package-lock.json",
    ],
    minExpectedReductionPct: 75,
  },
  {
    id: "diff-03-whitespace-only",
    name: "whitespace and indentation alignment diff",
    category: "diff",
    tool: "bash",
    command: "git diff -w",
    content: `diff --git a/src/config/format.ts b/src/config/format.ts
index e1a2b3c..d4e5f6a 100644
--- a/src/config/format.ts
+++ b/src/config/format.ts
@@ -10,5 +10,5 @@ export function formatConfig(cfg: any): string {
-	return JSON.stringify(cfg, null, 4);
+  return JSON.stringify(cfg, null, 2);
 }`,
    mustContain: [
      "src/config/format.ts",
      "-	return JSON.stringify(cfg, null, 4);",
      "+  return JSON.stringify(cfg, null, 2);",
    ],
    minExpectedReductionPct: 15,
  },
  {
    id: "diff-04-binary-file",
    name: "binary file modification diff marker",
    category: "diff",
    tool: "bash",
    command: "git diff assets/logo.png",
    content: `diff --git a/assets/logo.png b/assets/logo.png
index a123456..b789012 100644
Binary files a/assets/logo.png and b/assets/logo.png differ`,
    mustContain: [
      "diff --git a/assets/logo.png b/assets/logo.png",
      "Binary files a/assets/logo.png and b/assets/logo.png differ",
    ],
    minExpectedReductionPct: 0,
  },
  {
    id: "diff-05-edge-of-file",
    name: "edge of file diff (line 1 edit and EOF newline append)",
    category: "diff",
    tool: "bash",
    command: "git diff src/env.ts",
    content: `diff --git a/src/env.ts b/src/env.ts
index 0123456..789abcd 100644
--- a/src/env.ts
+++ b/src/env.ts
@@ -1,3 +1,3 @@
-#!/usr/bin/env node
+#!/usr/bin/env bun
 import process from "node:process"
 
@@ -35,3 +35,4 @@ export const isDev = process.env.NODE_ENV === "development"
 export const port = Number(process.env.PORT ?? 4096)
+export const host = process.env.HOST ?? "127.0.0.1"
\\ No newline at end of file`,
    mustContain: [
      "-#!/usr/bin/env node",
      "+#!/usr/bin/env bun",
      "+export const host = process.env.HOST ?? \"127.0.0.1\"",
      "\\ No newline at end of file",
    ],
    minExpectedReductionPct: 15,
  },
  {
    id: "diff-06-file-rename",
    name: "git file rename with similarity index",
    category: "diff",
    tool: "bash",
    command: "git diff -M",
    content: `diff --git a/src/old-queue.ts b/src/worker-queue.ts
similarity index 94%
rename from src/old-queue.ts
rename to src/worker-queue.ts
index 456789a..bcdef01 100644
--- a/src/old-queue.ts
+++ b/src/worker-queue.ts
@@ -8,3 +8,3 @@ export class OldQueue {
-export class OldQueue {
+export class WorkerQueue {
   private concurrency = 4`,
    mustContain: [
      "similarity index 94%",
      "rename from src/old-queue.ts",
      "rename to src/worker-queue.ts",
      "-export class OldQueue {",
      "+export class WorkerQueue {",
    ],
    minExpectedReductionPct: 10,
  },
]
