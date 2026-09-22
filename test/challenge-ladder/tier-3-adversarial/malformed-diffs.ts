/**
 * Tier 3 — Malformed Diffs (15 fixtures)
 *
 * Intentionally broken/truncated diffs to stress Fox's robustness.
 * Key check: compressor must NOT "fix" or hallucinate content.
 */
import type { ChallengeFixture } from "../types"

export const TIER3_MALFORMED_DIFF_FIXTURES: readonly ChallengeFixture[] = [
  {
    id: "malformed-diff-t3-01",
    tier: 3,
    category: "malformed-diffs",
    description: "Truncated hunk — missing @@ header",
    seed: 20001,
    input: {
      content: `diff --git a/src/app.ts b/src/app.ts
index a1b2c3d..e4f5g6h 100644
--- a/src/app.ts
+++ b/src/app.ts
-const x = 1;
+const x = 2;
 const y = 3;`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "robustness",
      mustContain: ["-const x = 1;", "+const x = 2;", "const y = 3;"],
      mustNotContain: ["@@ -"],
      workflow: "swe",
    },
  },
  {
    id: "malformed-diff-t3-02",
    tier: 3,
    category: "malformed-diffs",
    description: "Missing --- and +++ headers",
    seed: 20002,
    input: {
      content: `diff --git a/config.json b/config.json
@@ -1,4 +1,4 @@
 {
-  "port": 3000,
+  "port": 8080,
   "host": "localhost"
 }`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "robustness",
      mustContain: ['"port": 3000', '"port": 8080', "config.json"],
      workflow: "swe",
    },
  },
  {
    id: "malformed-diff-t3-03",
    tier: 3,
    category: "malformed-diffs",
    description: "Mixed CRLF and LF line endings within diff",
    seed: 20003,
    input: {
      content: "diff --git a/src/utils.ts b/src/utils.ts\r\nindex 1234567..abcdef0 100644\r\n--- a/src/utils.ts\n+++ b/src/utils.ts\r\n@@ -1,3 +1,3 @@\r\n export function helper() {\n-  return null;\r\n+  return undefined;\n }",
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "robustness",
      mustContain: ["return null", "return undefined", "helper"],
      workflow: "swe",
    },
  },
  {
    id: "malformed-diff-t3-04",
    tier: 3,
    category: "malformed-diffs",
    description: "Overlapping hunk ranges (impossible line numbers)",
    seed: 20004,
    input: {
      content: `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -10,5 +10,5 @@
 function foo() {
-  return 1;
+  return 2;
 }
@@ -8,5 +8,5 @@
 function bar() {
-  return 3;
+  return 4;
 }`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "robustness",
      mustContain: ["return 1", "return 2", "return 3", "return 4", "foo", "bar"],
      workflow: "swe",
    },
  },
  {
    id: "malformed-diff-t3-05",
    tier: 3,
    category: "malformed-diffs",
    description: "Binary diff mixed with text diff in single output",
    seed: 20005,
    input: {
      content: `diff --git a/assets/logo.png b/assets/logo.png
Binary files a/assets/logo.png and b/assets/logo.png differ
diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -1,3 +1,3 @@
-export const VERSION = "1.0.0";
+export const VERSION = "1.1.0";
\x00\x01\x02\x03BINARY_NOISE_IN_TEXT_DIFF
 export const NAME = "app";`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "robustness",
      mustContain: ["Binary files", "logo.png", "VERSION", "1.1.0", "NAME"],
      workflow: "swe",
    },
  },
  {
    id: "malformed-diff-t3-06",
    tier: 3,
    category: "malformed-diffs",
    description: "Diff with no actual changes (empty hunk body)",
    seed: 20006,
    input: {
      content: `diff --git a/README.md b/README.md
index 1234567..abcdef0 100644
--- a/README.md
+++ b/README.md
@@ -1,3 +1,3 @@
 # Project Name
 
 This is the readme.`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "robustness",
      mustContain: ["README.md", "Project Name", "This is the readme"],
      workflow: "swe",
    },
  },
  {
    id: "malformed-diff-t3-07",
    tier: 3,
    category: "malformed-diffs",
    description: "Diff with extremely long single line (4KB)",
    seed: 20007,
    input: {
      content: `diff --git a/data/config.json b/data/config.json
--- a/data/config.json
+++ b/data/config.json
@@ -1 +1 @@
-${"a".repeat(4096)}
+${"b".repeat(4096)}`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "robustness",
      mustContain: ["config.json"],
      workflow: "swe",
    },
  },
  {
    id: "malformed-diff-t3-08",
    tier: 3,
    category: "malformed-diffs",
    description: "Diff with invalid UTF-8 sequences",
    seed: 20008,
    input: {
      content: `diff --git a/src/data.bin b/src/data.bin
--- a/src/data.bin
+++ b/src/data.bin
@@ -1,2 +1,2 @@
-header: \xff\xfe valid text after invalid bytes
+header: \xef\xbb\xbf corrected BOM prefix
 content remains unchanged`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "robustness",
      mustContain: ["data.bin", "content remains unchanged"],
      workflow: "swe",
    },
  },
  {
    id: "malformed-diff-t3-09",
    tier: 3,
    category: "malformed-diffs",
    description: "Diff with inconsistent addition/deletion counts in header",
    seed: 20009,
    input: {
      content: `diff --git a/src/math.ts b/src/math.ts
--- a/src/math.ts
+++ b/src/math.ts
@@ -1,3 +1,99 @@
-export const PI = 3.14;
+export const PI = 3.14159;
 export const E = 2.718;`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "robustness",
      mustContain: ["PI = 3.14", "PI = 3.14159", "E = 2.718"],
      workflow: "swe",
    },
  },
  {
    id: "malformed-diff-t3-10",
    tier: 3,
    category: "malformed-diffs",
    description: "Diff of a file that looks like a diff (meta-diff)",
    seed: 20010,
    input: {
      content: `diff --git a/test/fixtures/sample.diff b/test/fixtures/sample.diff
--- a/test/fixtures/sample.diff
+++ b/test/fixtures/sample.diff
@@ -1,5 +1,5 @@
 diff --git a/inner.ts b/inner.ts
 --- a/inner.ts
 +++ b/inner.ts
-@@ -1 +1 @@
+@@ -1,2 +1,2 @@
 -old content
 +new content`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "robustness",
      mustContain: ["sample.diff", "inner.ts", "old content", "@@ -1,2 +1,2 @@"],
      workflow: "swe",
    },
  },
  {
    id: "malformed-diff-t3-11",
    tier: 3,
    category: "malformed-diffs",
    description: "Git conflict markers embedded in diff output",
    seed: 20011,
    input: {
      content: `diff --git a/src/merge.ts b/src/merge.ts
--- a/src/merge.ts
+++ b/src/merge.ts
@@ -5,7 +5,11 @@
 function getValue() {
+<<<<<<< HEAD
+  return "main-value";
+=======
+  return "feature-value";
+>>>>>>> feat/new-feature
-  return "old-value";
 }`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "robustness",
      mustContain: ["<<<<<<< HEAD", "=======", ">>>>>>> feat/new-feature", "main-value", "feature-value"],
      workflow: "swe",
    },
  },
  {
    id: "malformed-diff-t3-12",
    tier: 3,
    category: "malformed-diffs",
    description: "Diff with tab/space inconsistency in context lines",
    seed: 20012,
    input: {
      content: `diff --git a/src/style.css b/src/style.css
--- a/src/style.css
+++ b/src/style.css
@@ -1,6 +1,6 @@
 .container {
\t  display: flex;
-\t  color: red;
+\t  color: blue;
    justify-content: center;
 }`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "robustness",
      mustContain: ["color: red", "color: blue", "container", "justify-content"],
      workflow: "swe",
    },
  },
  {
    id: "malformed-diff-t3-13",
    tier: 3,
    category: "malformed-diffs",
    description: "Diff with 'No newline at end of file' marker",
    seed: 20013,
    input: {
      content: `diff --git a/src/const.ts b/src/const.ts
--- a/src/const.ts
+++ b/src/const.ts
@@ -1,2 +1,2 @@
-export const MAX = 100;
\\ No newline at end of file
+export const MAX = 200;
\\ No newline at end of file`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "robustness",
      mustContain: ["MAX = 100", "MAX = 200", "No newline at end of file"],
      workflow: "swe",
    },
  },
  {
    id: "malformed-diff-t3-14",
    tier: 3,
    category: "malformed-diffs",
    description: "Completely empty diff (header only, no hunks)",
    seed: 20014,
    input: {
      content: `diff --git a/src/empty.ts b/src/empty.ts
index 1234567..1234567 100644`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "robustness",
      mustContain: ["empty.ts", "1234567"],
      workflow: "swe",
    },
  },
  {
    id: "malformed-diff-t3-15",
    tier: 3,
    category: "malformed-diffs",
    description: "Diff with permission mode change only",
    seed: 20015,
    input: {
      content: `diff --git a/scripts/deploy.sh b/scripts/deploy.sh
old mode 100644
new mode 100755`,
      tool: "bash",
      command: "git diff",
    },
    expected: {
      type: "robustness",
      mustContain: ["deploy.sh", "old mode 100644", "new mode 100755"],
      workflow: "swe",
    },
  },
]
