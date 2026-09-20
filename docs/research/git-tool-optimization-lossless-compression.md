# Lossless Token Compression for Tool Use & Git in Fox CLI

> **Status:** Research & Architecture Proposal  
> **Date:** 2026-09-20  
> **Scope:** Software Engineering Workloads in Fox Code CLI (`fox-code-cli`)  
> **Focus:** Tool-Output Hygiene, Git Command Optimization, Ephemeral Superseding, and Content-Addressed Retrieval  
> **References:**  
> - [`considerations-lossless-token-compression.md`](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/research/considerations-lossless-token-compression.md)  
> - [`lossless-token-compression.md`](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/research/lossless-token-compression.md)  
> - [`est-savings-lossless-token-compression.md`](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/research/est-savings-lossless-token-compression.md)

---

## 1. Executive Summary: The "Git Token Tax"

Fox CLI is primarily designed for **software engineering tasks**. In typical coding sessions, Git is the single most frequently executed subsystem—either through direct user prompts or autonomous agent verification loops (`git status`, `git diff`, `git log`, `git show`, `git branch`).

While our initial token compression optimizations addressed **JSON schema minification**, **path prefix normalization**, **tabular/JSON key compression**, and **unified diff hunk trimming**, we left **tool-level Git execution** largely unoptimized:

1. **Verbose Command Defaults:** The agent runs bare `git status`, `git diff`, and `git log` commands that dump immense volumes of instructional text, index hashes, long commit headers, and 3-line hunk contexts (`-U3`).
2. **Lockfile & Asset Explosions:** Running `git diff` after dependency updates or builds dumps thousands of lines of lockfiles (`package-lock.json`, `bun.lockb`, `pnpm-lock.yaml`) or minified bundles, consuming 10,000–50,000 tokens on a single turn.
3. **Multi-Turn Stale History Accumulation:** `src/session/supersede.ts` only supersedes `read` tool outputs against `edit`/`write`. Stale `git status` and `git diff` outputs remain in the context history across all subsequent turns, re-prefilled on every step.
4. **Permissive Truncation Thresholds:** `src/tool/truncate.ts` uses a 50KB (~12,500 token) cap. A 20KB `git diff` or test failure log passes through unattenuated, polluting the context for the rest of the session.

By applying the principles in [`considerations-lossless-token-compression.md`](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/research/considerations-lossless-token-compression.md), we can eliminate **70%–92% of Git-related tokens** losslessly, translating to **6,000–14,000 tokens saved per 10-turn software engineering session**.

---

## 2. Quantitative Analysis of Git Output Bloat

### 2.1 `git status`

| Command / Representation | Raw Bytes | Est. Tokens | Noise Removed | Information Preserved |
|:---|:---:|:---:|:---|:---|
| **Default `git status`** | ~550 B | ~150 | Instructional hints (`(use "git add..." )`), headers | Working branch, upstream tracking, staged/unstaged files |
| **Terse `git status -sb`** | ~140 B | ~35 | 100% of instructional boilerplate | Exact same branch, tracking status, and file state |
| **Token Reduction** | **-74.5%** | **-76.7%** | — | **100% Lossless** |

```
# Default git status (150 tokens)
On branch feat/auth-tokens
Your branch is up to date with 'origin/feat/auth-tokens'.

Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
	modified:   packages/core/src/tool/compress.ts

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   src/tool/tool.ts
	modified:   src/session/supersede.ts

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	test/fixtures/sample.diff

no changes added to commit (use "git add" to commit)
```

```
# Terse git status -sb (35 tokens)
## feat/auth-tokens...origin/feat/auth-tokens
M  packages/core/src/tool/compress.ts
 M src/tool/tool.ts
 M src/session/supersede.ts
?? test/fixtures/sample.diff
```

### 2.2 `git diff`

| Component | Default | Optimized | Savings |
|:---|:---|:---|:---:|
| **Hunk Context** | `-U3` (3 context lines before/after) | `-U1` (1 context line before/after) | **40–50%** |
| **Metadata Headers** | `index 4cdca9b..7ef1234 100644` | Stripped (meaningless to LLM) | **~15 tokens/file** |
| **Lockfiles & Bundles** | Full 5,000-line JSON diff | Diffstat + collapsed summary | **95–99%** |
| **Whitespace Only** | Diffs on re-formatted lines | `--ignore-all-space` / `-w` | **50–90%** |

### 2.3 `git log`

| Command | Format | Tokens (10 commits) | Tokens (50 commits) |
|:---|:---|:---:|:---:|
| **Default `git log`** | Full SHA-1, Author, Date, Multi-line commit msg | ~1,800 | ~9,000 |
| **Optimized `git log --oneline -n 10`** | 7-char hash + subject line | ~110 | ~550 |
| **Compact with Date `%h %cd %s`** | Hash, ISO date, subject line | ~160 | ~800 |
| **Savings** | — | **91.1%** | **91.1%** |

---

## 3. Four-Layer Architecture for Git & Tool Optimization

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Layer 1: Source Filter                          │
│     (Pre-execution command rewriting & flag injection in shell tool)    │
│  - git status -> git status -sb                                        │
│  - git diff -> git diff -U1 :(exclude)*lock*                           │
│  - git log -> git log --oneline -n 20                                  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Layer 2: ToolOutputCompressor                        │
│      (Post-execution deterministic filtering & data compaction)        │
│  - compressGitStatus: boilerplate strip fallback                       │
│  - compressGitDiff: lockfile collapse & metadata strip                 │
│  - filterTestOutput: collapse PASS/spinners, retain FAIL & stack traces│
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Layer 3: Content-Addressed Retrieval Store               │
│     (Capped preview + pointer reference for oversized outputs)         │
│  - Soft cap at 4KB–8KB (down from 50KB)                                │
│  - Spill full output to .fox/output/<hash>                             │
│  - Return: diffstat/summary + [Full output: ref:diff_a1. Call retrieve]│
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│              Layer 4: Render-Time Diagnostic Superseding               │
│         (src/session/supersede.ts across multi-turn history)           │
│  - Turn 1 `git status` superseded by Turn 5 `git status`               │
│  - Turn 3 `git diff` superseded by Turn 6 edits or newer diff          │
│  - Replaces historical payload with [git status superseded by step 5]  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Detailed Design by Layer

### Layer 1: Source-Level Filter & Pre-Execution Command Rewriting

As stated in the considerations document:
> *"Filter at the source inside the tool wrappers: Prefer terse flags (`git status --porcelain` / `--short`, `npm test --silent`, `cargo test --quiet`, `pytest -q`)."*

When an agent issues commands to the `bash` or `shell` tool, Fox CLI can automatically inject safe, terse flags if the agent did not supply formatting flags:

#### 1.1 Command Rewriter Rules (`src/tool/shell/rewrite.ts`)

1. **`git status`**:
   - If command is bare `git status` or `git status .` (without `-s`, `--short`, `--porcelain`):
   - Rewrite to: `git status -sb`
   - *Result:* Preserves branch tracking and staged/unstaged changes in 25% of the tokens.

2. **`git diff`**:
   - If command is bare `git diff` or `git diff <args>` without `-U` / `--unified`:
   - Inject `-U1` context lines.
   - Inject pathspec exclusions for package lockfiles and binaries if not explicitly targeting them:
     `:(exclude)*lock* :(exclude)*.lock :(exclude)*-lock.json :(exclude)bun.lockb :(exclude)*.min.* :(exclude)*.map`
   - *Result:* Eliminates accidental 20,000-token dumps of lockfiles and reduces hunk context tokens by 50%.

3. **`git log`**:
   - If command has no `-n`, `--max-count`, or formatting options:
   - Rewrite to: `git log --oneline -n 20`
   - *Result:* Eliminates unbounded commit history dumping while giving the agent sufficient context.

4. **Test Commands (`bun test`, `npm test`, `pytest`, `cargo test`, `vitest`)**:
   - If run without quiet flags, inject terse/quiet options or pipe through signal filters.

#### 1.2 Gating via Feature Flag
Controlled by `FOX_EXPERIMENTAL_COMPRESS_GIT=true` (cascaded under `FOX_EXPERIMENTAL_COMPRESS`). If disabled, commands execute raw without mutation.

---

### Layer 2: Deterministic Command-Specific Compressors (`compress.ts`)

Even if a command runs without rewriting (e.g. through complex piping or external scripts), the post-execution pipeline in `packages/core/src/tool/compress.ts` inspects tool output:

#### 2.1 `compressGitStatus`
- Detects standard `git status` output via `On branch ` and `Changes to be committed:`.
- Deterministically parses staged, unstaged, untracked sections and formats into `-sb` style.
- Eliminates 100% of help strings `(use "git add <file>..." to update...)`.

#### 2.2 `compressGitDiff`
- Extends the existing `trimDiffContext`:
  1. Strips `index <hash>..<hash> <mode>` metadata.
  2. Collapses lockfile hunks:
     ```diff
     diff --git a/package-lock.json b/package-lock.json
     [package-lock.json modified: 412 lines changed — diff collapsed for brevity; run git diff -- package-lock.json if inspection needed]
     ```
  3. Strips binary file notices.

#### 2.3 `filterTestOutput`
- Collapses long runs of passing tests (`✓ test_foo (12ms)`) into a summary line:
  `[42 tests passed]`
- Preserves 100% of failing test names, error messages, and stack traces.

---

### Layer 3: Content-Addressed Local Output Storage & Retrieval

The considerations document emphasizes:
> *"Write the complete tool result to a content-addressed local store (file, SQLite FTS5, or simple key-value). Return to the model only a short summary + retrieval key... call retrieve_tool_output if needed."*

#### 3.1 Tightening Truncation from 50KB to 6KB
- In `src/tool/truncate.ts`, the current limit is `MAX_BYTES = 50 * 1024` (50KB = ~12,500 tokens).
- For software engineering workloads, this is too generous. A 12,000-token tool output consumes 10% of a 128K context and 25% of typical KV caches.
- **New Default for Shell Outputs:** `MAX_SHELL_BYTES = 6 * 1024` (~1,500 tokens) or 150 lines.

#### 3.2 Pointer & Retrieval Mechanism
When output exceeds 6KB:
1. Write full output to `.fox/storage/tool_outputs/<sha256>.txt`.
2. Format output for model:
   ```
   [Output truncated at 150 lines / 6KB. Total: 842 lines / 34KB]
   Summary: 14 files changed, 450 insertions(+), 120 deletions(-)
   
   ... <first 120 lines of diff/output> ...
   
   [Full output stored with key=tool_out_9f82d1]
   To inspect specific files: run `git diff <path>` or use the Read tool on specific ranges.
   To retrieve full output: call retrieve_tool_output(key="tool_out_9f82d1").
   ```
3. Register a lightweight tool `retrieve_tool_output(key: string, offset?: number, limit?: number)` or integrate with the existing `Read` tool.

---

### Layer 4: Multi-Turn Superseding for Git & Diagnostics

Currently, [`src/session/supersede.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/supersede.ts) only implements Strategy 4.4 for file reads:
```typescript
const READ_TOOLS = new Set(["read"])
const MUTATE_TOOLS = new Set(["edit", "write", "apply_patch"])
```

#### 4.1 Extending Supersession to Git Commands
In a typical software development workflow:
1. Step 1: `bash: git status`
2. Step 2: `edit: src/app.ts`
3. Step 3: `bash: git status`

Step 1's `git status` is **factually obsolete**. The current git state is represented in Step 3.

Similarly:
- Step 2: `bash: git diff`
- Step 3: `edit: src/app.ts`
- Step 4: `bash: git diff`
Step 2's diff is obsolete because the file was further edited and re-diffed.

#### 4.2 Supersession Algorithm for Shell Commands
In `buildSupersededSet()`:
1. Identify bash tool calls whose command is an idempotent inspection command:
   - `git status` (any variation)
   - `git diff` (when superseded by a later `git diff` or commit)
   - `git branch` (superseded by later branch check)
2. When a newer invocation of the same command occurs later in the conversation history:
   - Supersede the earlier tool output:
     ```
     [Git status superseded by step 5]
     ```
   - For `git diff`: when a subsequent `git commit` or newer `git diff` occurs:
     ```
     [Git diff superseded by subsequent changes at step 6]
     ```
3. Stored message history on disk is **never altered**—this is purely a **render-time projection** when compiling messages for the LLM.

---

## 5. System Prompt & Agent Instruction Alignment

Fox CLI's default prompts currently contain examples that unintentionally teach the model to run verbose commands:

In [`src/tool/shell/prompt.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/shell/prompt.ts#L10-L14):
```typescript
Input: git status
Output: Shows working tree status
```
And:
```typescript
For example, if you need to run "git status" and "git diff", send a single message with two bash tool calls in parallel.
```

### Proposed Prompt Refinements
Update [`src/session/prompt/default-compact.txt`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt/default-compact.txt) and [`src/tool/shell/prompt.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/shell/prompt.ts):

1. **Explicit Git Brevity Rules**:
   - *"Git usage: Always use terse commands (`git status -sb`, `git diff -U1`, `git log --oneline -n 10`)."*
   - *"Never run unconstrained `git log` or diff generated lockfiles (`package-lock.json`, `bun.lockb`)."*
2. **Selective Diffs**:
   - *"Prefer targeting specific files in diffs (`git diff path/to/file`) instead of repo-wide diffs when checking edits."*

---

## 6. Expected Token Savings per 10-Turn SW Development Session

| Optimization Strategy | Optimistic | Realistic | Pessimistic | Mechanism |
|:---|:---:|:---:|:---:|:---|
| **Git Status Terse / Normalization** | 1,200 | 800 | 400 | -75% tokens across 3–5 status checks |
| **Git Diff Context Trimming (-U1) & Index Stripping** | 3,500 | 2,200 | 1,000 | -45% diff tokens on intermediate checks |
| **Lockfile & Asset Exclusion from Diffs** | 15,000 | 3,000 | 0 | Prevents massive 10K+ token lockfile diff dumps |
| **Git Log Terse Formatting** | 2,000 | 1,000 | 300 | `--oneline -n 10` vs unbounded default |
| **Cross-Turn Git Superseding** | 4,000 | 2,500 | 1,200 | Stale status & diffs replaced by 10-token markers |
| **Output Cap (6KB) + Pointer Retrieval** | 6,000 | 2,500 | 800 | Large test runs or diffs capped proactively |
| **Total Expected Git/Tool Savings** | **31,700** | **12,000** | **3,700** | **Lossless / Semantically Lossless** |

### Latency & TTFT Impact
On local models (Nemotron 550B, Gemma 30B, GPT-OSS 120B):
- Prefill savings of ~10,000 tokens per turn = **~1.5s to 3.5s TTFT reduction** per turn.
- Eliminates context bloat that pushes sessions toward the 128K context boundary where throttled local models degrade.

---

## 7. Concrete Implementation Roadmap

### Phase 1: Render-Time Git Supersession (Quick Win, Zero Side Effects)
1. Edit [`src/session/supersede.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/supersede.ts):
   - Add inspection command parser for `bash` tool calls.
   - Detect `git status`, `git diff`, and diagnostic commands.
   - Supersede earlier occurrences when newer ones or commits are present.
2. Add unit tests in [`test/supersede.test.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/test/supersede.test.ts).

### Phase 2: Git & Tool Output Compressors in `ToolOutputCompressor`
1. Edit [`packages/core/src/tool/compress.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/tool/compress.ts):
   - Add `compressGitStatus`: strips instructional headers if standard status was returned.
   - Extend `trimDiffContext`: strip `index` hashes, collapse lockfile hunks.
   - Add `filterTestSummary`: collapse repetitive passing test lines.
2. Add feature flags `FOX_EXPERIMENTAL_COMPRESS_GIT` in [`packages/core/src/flag/flag.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/flag/flag.ts).

### Phase 3: Shell Pre-Execution Terse Flag Injection
1. In [`src/tool/shell.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/shell.ts) and [`packages/core/src/tool/bash.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/tool/bash.ts):
   - Implement pre-execution command rewriter for common git commands (`status` -> `-sb`, `log` -> `--oneline -n 20`, `diff` -> `-U1` + lockfile exclusions).
   - Ensure environment variables (`PAGER=cat`, `GIT_TERMINAL_PROMPT=0`) are always injected.

### Phase 4: Output Capping & Pointers
1. In [`src/tool/truncate.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/truncate.ts):
   - Support tool-specific limits (e.g. 6KB for shell, 50KB for file reads).
   - Return structured pointers and refinement hints for truncated outputs.

### Phase 5: System Prompt & Shell Prompt Updates
1. Update [`src/session/prompt/default-compact.txt`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt/default-compact.txt) and [`src/tool/shell/prompt.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/shell/prompt.ts) with terse git instructions.
