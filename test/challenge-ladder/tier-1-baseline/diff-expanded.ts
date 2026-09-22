/**
 * Tier 1 — Diff Expanded (10 fixtures)
 *
 * 6 existing diff fixtures + 4 new:
 *   - Rename + modify diff
 *   - Whitespace-only changes
 *   - Binary file diff marker
 *   - Submodule pointer change
 */
import type { ChallengeFixture } from "../types"
import { DIFF_FIXTURES } from "../../corpora/diff/fixtures"

const existingFixtures: ChallengeFixture[] = DIFF_FIXTURES.map((f, idx) => ({
  id: `diff-t1-${String(idx + 1).padStart(2, "0")}`,
  tier: 1 as const,
  category: "diff" as const,
  description: f.name,
  seed: 5000 + idx,
  input: {
    content: f.content,
    tool: f.tool,
    command: f.command,
  },
  expected: {
    type: "invariant" as const,
    mustContain: f.mustContain ? [...f.mustContain] : undefined,
    workflow: "swe" as const,
  },
}))

const newFixtures: ChallengeFixture[] = [
  {
    id: "diff-t1-07",
    tier: 1,
    category: "diff",
    description: "Rename + modify diff (similarity index 85%)",
    seed: 5100,
    input: {
      content: `diff --git a/src/utils/helpers.ts b/src/utils/string-helpers.ts
similarity index 85%
rename from src/utils/helpers.ts
rename to src/utils/string-helpers.ts
index a1b2c3d..e4f5g6h 100644
--- a/src/utils/helpers.ts
+++ b/src/utils/string-helpers.ts
@@ -1,8 +1,10 @@
-export function formatString(input: string): string {
-  return input.trim().toLowerCase()
+/**
+ * String manipulation utilities — extracted from generic helpers.
+ */
+export function normalizeString(input: string): string {
+  return input.trim().toLowerCase().replace(/\\s+/g, " ")
 }
 
-export function truncate(str: string, len: number): string {
-  return str.length > len ? str.slice(0, len) + "..." : str
+export function truncate(str: string, maxLen: number, suffix = "…"): string {
+  return str.length > maxLen ? str.slice(0, maxLen) + suffix : str
 }`,
      tool: "bash",
      command: "git diff HEAD~1",
    },
    expected: {
      type: "invariant",
      mustContain: [
        "rename from src/utils/helpers.ts",
        "rename to src/utils/string-helpers.ts",
        "similarity index 85%",
        "normalizeString",
      ],
      workflow: "swe",
    },
  },
  {
    id: "diff-t1-08",
    tier: 1,
    category: "diff",
    description: "Whitespace-only changes (tabs to spaces, trailing whitespace)",
    seed: 5101,
    input: {
      content: `diff --git a/src/config.ts b/src/config.ts
index 9b7a1c4..e2f8d30 100644
--- a/src/config.ts
+++ b/src/config.ts
@@ -1,10 +1,10 @@
-\texport const config = {
-\t\thost: "localhost",
-\t\tport: 3000,
-\t\tdb: {
-\t\t\thost: "localhost",  
-\t\t\tport: 5432,   
-\t\t\tname: "app_db",\t
-\t\t},
-\t}
+export const config = {
+  host: "localhost",
+  port: 3000,
+  db: {
+    host: "localhost",
+    port: 5432,
+    name: "app_db",
+  },
+}`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "invariant",
      mustContain: [
        "config.ts",
        "host: \"localhost\"",
        "port: 3000",
        "app_db",
      ],
      workflow: "swe",
    },
  },
  {
    id: "diff-t1-09",
    tier: 1,
    category: "diff",
    description: "Binary file diff marker (image asset replacement)",
    seed: 5102,
    input: {
      content: `diff --git a/assets/logo.png b/assets/logo.png
index a1b2c3d..e4f5g6h 100644
Binary files a/assets/logo.png and b/assets/logo.png differ
diff --git a/assets/icon.svg b/assets/icon.svg
index 9b7a1c4..0d1e2f3 100644
--- a/assets/icon.svg
+++ b/assets/icon.svg
@@ -1,5 +1,5 @@
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
-  <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#333"/>
+  <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#1a73e8"/>
   <path d="M2 17l10 5 10-5" fill="none" stroke="#333"/>
 </svg>`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "invariant",
      mustContain: [
        "Binary files",
        "logo.png",
        "icon.svg",
        "fill=\"#1a73e8\"",
      ],
      workflow: "swe",
    },
  },
  {
    id: "diff-t1-10",
    tier: 1,
    category: "diff",
    description: "Submodule pointer change diff",
    seed: 5103,
    input: {
      content: `diff --git a/.gitmodules b/.gitmodules
index 1234567..abcdef0 100644
--- a/.gitmodules
+++ b/.gitmodules
@@ -1,6 +1,6 @@
 [submodule "vendor/sdk"]
 	path = vendor/sdk
-	url = https://github.com/org/sdk.git
+	url = https://github.com/org/sdk-v2.git
 	branch = main
 [submodule "vendor/proto"]
 	path = vendor/proto
diff --git a/vendor/sdk b/vendor/sdk
--- a/vendor/sdk
+++ b/vendor/sdk
@@ -1 +1 @@
-Subproject commit a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
+Subproject commit f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "invariant",
      mustContain: [
        ".gitmodules",
        "sdk-v2.git",
        "Subproject commit",
        "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        "f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5",
      ],
      workflow: "swe",
    },
  },
]

export const TIER1_DIFF_FIXTURES: readonly ChallengeFixture[] = [
  ...existingFixtures,
  ...newFixtures,
]
