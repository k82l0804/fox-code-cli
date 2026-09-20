import type { CorpusFixture } from "../types"

export const GITOPS_FIXTURES: readonly CorpusFixture[] = [
  {
    id: "gitops-01-status-verbose",
    name: "git status (verbose with hints and advice)",
    category: "gitops",
    tool: "bash",
    command: "git status",
    content: `On branch feat/standard-test-suite
Your branch is up to date with 'origin/feat/standard-test-suite'.

Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
	modified:   packages/core/src/tool/compress.ts
	new file:   test/corpora/types.ts

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   src/cli/cmd/compression.ts
	modified:   README.md

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	test/corpora/gitops/fixtures.ts
	docs/research/notes.tmp

no changes added to commit (use "git add" to track)`,
    mustContain: [
      "packages/core/src/tool/compress.ts",
      "test/corpora/types.ts",
      "src/cli/cmd/compression.ts",
      "README.md",
      "test/corpora/gitops/fixtures.ts",
    ],
    minExpectedReductionPct: 30,
  },
  {
    id: "gitops-02-diff-unified",
    name: "git diff (3-line context with metadata)",
    category: "gitops",
    tool: "bash",
    command: "git diff",
    content: `diff --git a/packages/core/src/tool/compress.ts b/packages/core/src/tool/compress.ts
index 9b7a1c4..e2f8d30 100644
--- a/packages/core/src/tool/compress.ts
+++ b/packages/core/src/tool/compress.ts
@@ -15,7 +15,7 @@ import { Flag } from "../flag/flag"
 import { Log } from "../util/log"
 import { CompressionMetrics } from "./compression-metrics"
 
-const log = Log.create({ service: "compression-legacy" })
+const log = Log.create({ service: "compression" })
 
 export interface CompressContext {
   readonly workspaceRoot: string
@@ -88,9 +88,9 @@ export function process(text: string, ctx: CompressContext): string {
   let originalLen = text.length
   let totalOverheadMs = 0
   let anyEnabled = false
-  for (const t of legacyTransforms) {
+  for (const transform of transforms) {
     if (!transform.enabled()) continue
     anyEnabled = true
`,
    mustContain: [
      "packages/core/src/tool/compress.ts",
      "-const log = Log.create({ service: \"compression-legacy\" })",
      "+const log = Log.create({ service: \"compression\" })",
      "-  for (const t of legacyTransforms) {",
      "+  for (const transform of transforms) {",
    ],
    minExpectedReductionPct: 20,
  },
  {
    id: "gitops-03-merge-conflict",
    name: "git merge conflict markers (lossless preservation invariant)",
    category: "gitops",
    tool: "bash",
    command: "git merge origin/main",
    content: `Auto-merging src/index.ts
CONFLICT (content): Merge conflict in src/index.ts
Auto-merging package.json
CONFLICT (content): Merge conflict in package.json
Automatic merge failed; fix conflicts and then commit the result.

<<<<<<< HEAD
export const VERSION = "0.2.0-alpha.1"
export const CODENAME = "foxy-fast"
=======
export const VERSION = "0.2.0-beta.0"
export const CODENAME = "foxy-stable"
>>>>>>> origin/main`,
    mustContain: [
      "CONFLICT (content): Merge conflict in src/index.ts",
      "CONFLICT (content): Merge conflict in package.json",
      "<<<<<<< HEAD",
      "=======",
      ">>>>>>> origin/main",
      "foxy-fast",
      "foxy-stable",
    ],
    minExpectedReductionPct: 0,
  },
  {
    id: "gitops-04-branch-switch",
    name: "git branch listing and checkout confirmation",
    category: "gitops",
    tool: "bash",
    command: "git branch -a",
    content: `* feat/standard-test-suite
  main
  fix/issue-412
  remotes/origin/HEAD -> origin/main
  remotes/origin/main
  remotes/origin/feat/standard-test-suite
  remotes/origin/feat/git-tool-token-compression
  remotes/origin/fix/issue-412`,
    mustContain: [
      "feat/standard-test-suite",
      "main",
      "origin/main",
    ],
    minExpectedReductionPct: 0,
  },
  {
    id: "gitops-05-log-unbounded-rewrite",
    name: "git log (unbounded history rewritten to --oneline -n 20)",
    category: "gitops",
    tool: "bash",
    command: "git log",
    content: Array.from({ length: 40 }, (_, i) => [
      `commit a1b2c3d4e5f6${i.toString(16).padStart(4, "0")}1234567890abcdef123456`,
      `Author: Developer <dev@fox.local>`,
      `Date:   Sun Sep 20 18:${String(i).padStart(2, "0")}:00 2026 -0400`,
      ``,
      `    feat(core): implement transform step ${i + 1} for compression pipeline`,
      ``,
    ]).flat().join("\n"),
    mustContain: [
      "feat(core): implement transform step",
    ],
    minExpectedReductionPct: 50,
  },
  {
    id: "gitops-06-raw-git-escape-hatch",
    name: "raw git command escape hatch (bypass rewrite)",
    category: "gitops",
    tool: "bash",
    command: "raw git status --porcelain=v2",
    content: `# branch.oid 744846f84d3b
# branch.head feat/standard-suite
# branch.upstream origin/feat/standard-suite
# branch.ab +0 -0
1 .M N... 100644 100644 100644 9b7a1c4 e2f8d30 src/cli/cmd/compression.ts
? test/corpora/gitops/fixtures.ts`,
    mustContain: [
      "branch.head feat/standard-suite",
      "src/cli/cmd/compression.ts",
      "test/corpora/gitops/fixtures.ts",
    ],
    isEscapeHatch: true,
    minExpectedReductionPct: 0,
  },
  {
    id: "gitops-07-tag-release",
    name: "git tag and release notes",
    category: "gitops",
    tool: "bash",
    command: "git tag -l -n3",
    content: `v0.1.0          Fox Code CLI Initial Release
    * Zero-overhead lossless token compression
    * Effect 4 HttpApi server routes
v0.1.1          Bugfix release for prompt caching
    * Deterministic tool schema ordering
    * Stable system prompt environment hash`,
    mustContain: [
      "v0.1.0",
      "v0.1.1",
      "Zero-overhead lossless token compression",
    ],
    minExpectedReductionPct: 0,
  },
]
