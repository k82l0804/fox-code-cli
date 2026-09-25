# Future Tasks

> **Phase flow**: Phase 1 (✅) → Phase 1B (✅) → Phase 2.0 (✅) → Phase 2A (✅) → Phase 2B (✅) → Phase 2C (✅) → Phase 2D (✅) → **Phase 2E** (🔧 current) → Phase 2F → Phase 2G → Phase 3 → Phase 4

---

## Phase 2E — SOTA Harness & Localization

> The Aider-loop and SOTA research identified that Fox has the right **pieces** (indexer, whole-file write, verification pipeline, git tooling) but they are attached to the **tool stream** instead of the **harness**. This phase moves the critical decision points — loop exit, verification, localization, edit format selection — from "things the model may choose to do" to "things the harness enforces."
>
> **Research**: [`why-aider-wins.md`](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/research/2026-09-24T20-20_why-aider-wins.md), [`how-to-make-fox-code-cli-state-of-the-art.md`](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/research/2026-09-24T20-30_how-to-make-fox-code-cli-state-of-the-art.md)
>
> **Principle**: After this phase, the loop cannot exit on prose when the task required a code change. Verification is a harness reflection, not a tool-result footnote. Localization is a pipeline prelude, not a tool the model may skip.

### Cross-cutting design constraints (apply to all tasks)

**Unified exit-condition table** — One function in `loop.ts` decides `continue | break | rollback`. All six conditions live in one matrix:

| Condition | Action | Budget | Notes |
|---|---|---|---|
| Empty exit (no mutation on code-change task) | Inject reflection, `continue` | `max_empty_exit_retries` (2) | Reflection names the allowed edit tool for this tier |
| Verify fail (new regressions only) | Inject reflection, `continue` | `max_repair_turns` (3) | Cheap stages first; baseline comparison filters pre-existing |
| Syntax reject (edit tool) | Tool error return | Per-tool, not loop-level | Compare error count to pre-edit, not absolute clean |
| Oscillation (A→B→A→B hash ring) | Warning + `break` | 3 oscillations | Not yet implemented; placeholder row |
| Compaction overflow | Compact + `continue` | Existing compaction logic | Already in loop.ts |
| Max steps | `break` with warning | Existing step cap | Already in loop.ts |

On exhaustion of any repair/retry budget: keep current state and exit with warning. Rollback to last green snapshot **only** if one exists; never rollback to pre-task and call it success.

**Single code-context envelope** — `buildCodeContextBlock()` owns one 5000-token budget for `{repo map + localize spans + pinned file bodies}`, allocated in that priority order, pinned bodies truncated first. One function, one injection point in the system prompt. 2E-3 and 2E-5 do not independently inject "their" blocks.

**KV cache rule** — Map + pins live in a suffix of the system prefix. The hash of that suffix is part of the `sysCache` key. Content refreshes only on: session start, after a successful apply/edit, after `/add`. Not every turn. Recency-weighted remap on every turn defeats `sysCache`.

**Fresh-verify skip** — Exit-time verification is skipped if the last post-mutation-tool verify covers the same `HEAD` commit (same files touched, no new mutations since). Incremental: lint/tsc on touched files first; full suite only if those pass or on `--auto` mode. Avoids double-running a 30s test suite.

**File paths frozen against current `main`** — Before implementing any task, the plan must verify every cited path exists. Known real paths as of this writing:

| Reference | Real path |
|---|---|
| Intent detection | [`src/foxcode/intent.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/intent.ts) |
| Model tier | [`src/foxcode/model-tier.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/model-tier.ts) |
| Loop | [`src/session/prompt/loop.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt/loop.ts) |
| Processor | [`src/session/processor.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/processor.ts) |
| System prompt template | [`src/session/prompt/default.txt`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt/default.txt) |
| Prompt preparation | [`src/session/prompt/prepare.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt/prepare.ts) |
| Verification pipeline | [`packages/core/src/verification.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/verification.ts) |
| Verification baseline | [`packages/core/src/verification-baseline.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/verification-baseline.ts) |
| Repair budget | [`packages/core/src/repair-budget.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/repair-budget.ts) |
| Checkpoints | [`packages/core/src/checkpoint.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/checkpoint.ts) |
| Tool registry | [`src/tool/registry.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/registry.ts) |
| Edit tool | [`src/tool/edit.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/edit.ts) |
| Rewrite file tool | [`src/tool/rewrite_file.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/rewrite_file.ts) |
| Write tool | [`src/tool/write.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/write.ts) |
| Read tool | [`src/tool/read.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/read.ts) |
| Fetch repo map | [`src/tool/fetch_repo_map.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/fetch_repo_map.ts) |
| Lookup symbols | [`src/tool/lookup_symbols.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/lookup_symbols.ts) |
| AST indexer | [`packages/fox-indexing/src/ast/indexer.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/fox-indexing/src/ast/indexer.ts) |
| Commit tool | [`src/tool/commit.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/commit.ts) |

---

### 2E-1. Loop-Exit Gate + Mutation Journal (PR 1 — ship first)

**Problem**: `loop.ts` exits when the model emits a `finish` signal with no pending tool calls. The model can narrate "I fixed it" without touching a file. The 8B Llama trace: 7 turns, zero `edit` calls, commit of unchanged files, loop exits.

**What to build**:

1. **Session mutation journal**: Track successful mutations applied by the harness (not `git diff`). Gate = "harness applied ≥1 successful mutation since the user message that started this goal." Record tool name, file path, and timestamp for each successful apply. `git diff` against session-start snapshot is the fallback, NOT `git diff --stat` (which misses committed changes, untracked files, and pre-session dirt).
2. **Mutation gate in `loop.ts`** (lines 217–238): Before the existing `break` on finished assistant message:
   - Classify the task via [`intent.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/intent.ts) `.needsWriteTools`. **Fail open toward code-change** when confidence is low — false "question" classification is how the 8B bug returns. Override rule: if any `edit`/`rewrite_file`/`apply_patch` is in the prompt's tool list AND the message contains words like fix/add/refactor/implement/create/update/change/modify/remove/delete → code-change regardless of classifier confidence.
   - If code-change AND journal is empty: inject a **reflection user message** (proper user-role, not tool-result append). Reflection text must name **the allowed edit tool for this tier** (e.g., "Use `rewrite_file` to modify the file" for Tier C/D, "Use `edit` to make the changes" for S/A), or C/D models will try `edit` after it's been removed.
   - `continue` instead of `break`.
3. **`max_empty_exit_retries`** (default 2): After N reflections with no mutation, allow exit with a warning. Non-code tasks (questions, explanations, `needsWriteTools=false`) still exit normally.

**Files to modify**: [`src/session/prompt/loop.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt/loop.ts), [`src/session/processor.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/processor.ts).
**Files to create**: `src/session/mutation-journal.ts` (or add to processor).
**Leverage**: [`src/foxcode/intent.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/intent.ts) (`.needsWriteTools`, `.intent`).

**Tests**:
- Model finishes without mutations on code-change task → reflection injected, names correct edit tool for tier.
- Non-code task ("explain this function") → exits normally, no reflection.
- Max-retry cap: 2 reflections with no mutation → exit with warning.
- `commit` of empty tree (no file changes) must NOT count as a mutation.
- Intent false-negative: "the rate limiter tests are failing" → classified as code-change (needs fix).
- Model mutates, then declares done in prose without a new tool call → journal is non-empty → proceeds to exit-time verify (2E-2).

---

### 2E-2. Verification as Harness Reflection (PR 1 — ship with 2E-1)

**Problem**: Verification only runs after mutation tools (`MUTATION_TOOLS` set). Its output is appended to a tool result. The model can ignore it. If no mutation tool was called, no verification runs at all.

**What to build**:

1. **Exit-time verification**: When 2E-1's mutation gate detects mutations AND a verification pipeline is configured, run the verification pipeline *before* allowing `break`. **Fresh-verify skip**: if the last post-mutation verify covers the same HEAD (no new mutations since), skip re-running. Incremental: lint/tsc on touched files first; full suite only if those pass (or on `--auto` mode).
2. **Pipeline order**: Use `detectCommandPipeline` priority (cheap stages first), NOT a fixed "typecheck → test → lint" order. Lint is often cheaper than tests; tests sometimes need a build step.
3. **Reflection on failure**: If `PipelineResult.allPassed` is `false`:
   - Use [`verification-baseline.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/verification-baseline.ts) `.compareToBaseline()` to classify regressions. Only block exit for **new regressions** (commands that were passing at baseline but now fail). Pre-existing failures (`alreadyFailing`) do not block.
   - Format failure output via existing `formatPipelineFeedback`.
   - Inject a reflection user message with failure details. `continue` the loop.
4. **Repair budget enforcement**: Wire existing [`repair-budget.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/repair-budget.ts) `RepairBudgetTracker` into the exit gate as a **hard cap**, not advisory text appended to tool output. After `max_repair_turns` (default 3) failed verification cycles: keep current state and exit with warning. Rollback to last green snapshot only if one exists (via [`checkpoint.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/checkpoint.ts)); never rollback to pre-task and report success.
5. **Flaky test retry**: Before consuming a repair budget slot, retry a failed test command once. One flake + repair budget of 3 can burn the entire session otherwise.
6. Post-mutation-tool verification stays unchanged — this is a **second** gate at loop exit, not a replacement.

**Unified exit-condition function**: Implement the 6-row exit table (see cross-cutting section above) as one function: `resolveExitCondition(journal, verify, budget, step) → "continue" | "break" | "rollback"`. 2E-1 and 2E-2 must not fight over the `break` decision.

**Files to modify**: [`src/session/prompt/loop.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt/loop.ts), [`packages/core/src/verification.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/verification.ts) (add `runExitVerification` export), [`src/session/processor.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/processor.ts).

**Tests**:
- Model mutates a file, introduces a type error → exit-time verification catches it → reflection injected → model fixes → verification passes → exit.
- Dirty repo with pre-existing red tests → baseline comparison → pre-existing failures don't block exit.
- Model mutates, verify red, model claims done in prose without a new tool call → verify still blocks exit.
- Repair budget cap: 3 failed verify cycles → exit with warning, no rollback to pre-task.
- Fresh-verify skip: mutation → verify runs → no further mutations → exit → verify NOT re-run.
- Flaky test: first run fails, retry passes → does not consume a repair budget slot.

---

### 2E-3. Localization Pipeline + Code Context Block (PR 3 — after ACI)

**Problem**: Fox's first action is almost always `read`/`grep`/`glob`. The model spends 2–6 turns finding the right file before any patch exists. Weak models lose the original request across those hops.

**What to build**:

1. **`buildCodeContextBlock()`** — a single function that produces the entire code-context injection for the system prompt, within a **5000-token total envelope** for `{repo map + localize spans + pinned file bodies}`. Allocation priority: map first, localize spans second, pinned bodies last (truncate bodies first when over budget). This function is called from `loop.ts` and replaces any separate map/pin injection. The output block is placed in the system prompt suffix; **its content hash is part of the `sysCache` key**. Content refreshes only on: session start, after a successful apply/edit, after `/add`. NOT every turn.

2. **Hierarchical localize prelude** (runs on code-change tasks only, gated by the same intent bit as 2E-1):
   - **File-level**: Use the existing AST indexer ([`packages/fox-indexing/src/ast/indexer.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/fox-indexing/src/ast/indexer.ts)) + symbol graph. BM25 search over **exported identifiers + comments/docstrings** from the indexer, not just filenames from `git ls-files`. ("sliding window carry-over" must match `rate_limiter.ts` even if the filename doesn't say "sliding window.") Fuse with Reciprocal Rank Fusion (RRF).
   - **Function-level**: For top-K files (K=5), use tree-sitter AST to extract function/class spans. Rank spans by keyword overlap + graph centrality.
   - **Output**: Ranked list of `{file, span_start, span_end, score, reason}`. Top 3–5 spans injected into the code-context block.
   - **Cold-index non-blocking**: If the index is cold (first run, no warm cache), serve path + symbol BM25 from whatever is warm and mark the block `partial`. Do NOT block the first generate on a full AST scan. A 8s localize before token one feels worse than Aider.

3. **Graph queries**: Extend the indexer to support `callers(symbol)`, `callees(symbol)`, `importers(file)` as **harness-internal functions** (not tools). These power multi-hop localization ("who calls this after a rename?"). `lookup_symbols` stays as an optional deep-dive tool for Tier S/A.

4. **Repo map injection**: Auto-inject a bounded, signatures-only repo map (file → exported function/class/type signatures) into the code-context block. Trim by: (a) task keyword overlap, (b) PageRank in the import graph, (c) files the harness has applied edits to this session. Token allocation: S/A get ~1000 tokens of map; C/D get ~1500 (weak models need more context, not less). For C/D, remove `fetch_repo_map` and `lookup_symbols` from the tool surface — they get the map for free. Reserve these tools for S/A as opt-in deep-dive.

5. **Working-set file pinning**: When localize pins files, include their full content in the code-context block (up to 4 files, pinned body budget = remainder of the 5k envelope after map + localize). Pins = localize top spans OR files the harness already applied edits to. Not "last 4 reads" (that oscillates). This means the model's first completion can be an edit against text it already has.

6. **AST-boundary chunking**: All retrieval chunks align to tree-sitter function/class boundaries, never arbitrary character windows.

**Files to create**: `src/session/code-context.ts` (the `buildCodeContextBlock()` function), `src/session/localize/pipeline.ts` (orchestrator), `src/session/localize/bm25.ts` (text scoring over identifiers + docstrings), `src/session/localize/graph.ts` (callers/callees/importers), `src/session/localize/ranker.ts` (RRF fusion + span ranking).
**Files to modify**: [`src/session/prompt/loop.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt/loop.ts) (call `buildCodeContextBlock()` + include in system block), [`src/session/prompt/prepare.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt/prepare.ts) (inject block into system message), [`packages/fox-indexing/src/ast/indexer.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/fox-indexing/src/ast/indexer.ts) (expose callers/callees/importers), [`src/foxcode/model-tier.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/model-tier.ts) (C/D tool surface removes map/symbol tools).

**Tests**:
- Unit test BM25 scoring over identifiers, graph traversal, RRF fusion.
- Integration test: given a task description and a small fixture repo **with decoy files** (similar names), verify the pipeline returns the correct file and function span in top-3.
- Verify 5k total envelope is respected: map + localize + pins never exceed budget.
- Verify cache key changes when map/pins change; stays stable when they don't.
- Map refresh after apply: new cache key, correct content.
- Cold-index: generate starts without blocking; block marked `partial`.
- Localize not run on Ask/explain tasks.
- "the rate limiter tests are failing" → localizes to `rate_limiter.ts` even though the filename doesn't appear in the query.

---

### 2E-4. ACI Simplification — Tool Surface Matrix (PR 2 — after loop gate)

**Problem**: Fox exposes `edit`, `apply_patch`, `write`, `rewrite_file`, `commit` simultaneously. That's a selection problem for smaller models. SWE-agent showed a designed, minimal ACI beats raw bash by a lot.

**What to build**:

The **canonical ACI matrix** (implement exactly this table, no additions):

| Tier | Edit | Explore | Shell |
|---|---|---|---|
| **S/A** | `edit` + `rewrite_file`(create) | `read` paginated, `grep`, `glob`, `lsp` | `bash` |
| **B** | `edit` + `rewrite_file` | `read` paginated, `grep`, `glob`, `lsp` | `bash` |
| **C/D** | **none as tools** (2E-6 handles) | `grep` (+ `read` only after one failed apply or empty grep) | `bash` |

Key decisions:
- **`apply_patch` off default surface for all tiers.** The journal + `edit` SEARCH/REPLACE is the standard path. `apply_patch` remains in the codebase for internal harness use and explicit opt-in.
- **`write` subsumed into `rewrite_file`** with a `create: true` flag for new files. One fewer tool. S/A needs `rewrite_file`(create) because `edit` cannot create files.
- **`commit` off default tool surface for all tiers.** Commit happens harness-side after a successful apply (like Aider), not as a tool the model calls. This removes "commit unchanged files and declare victory." The `commit` tool stays for explicit user-invoked commits.
- **C/D tool surface defers to 2E-6**: no edit tools as tool-call schemas. `grep` stays so a wrong pin is recoverable. `read` is added dynamically only after one failed apply or empty grep (not default).

Additional ACI improvements:
- **Syntax gate on edit application**: Before applying any edit (SEARCH/REPLACE or whole-file), run tree-sitter parse on the result. If the parse introduces **new** syntax errors (compare error count to pre-edit state, not absolute clean), reject the edit and return the parse error as a tool error. Files that were already invalid are not blocked.
- **Bounded viewer**: Cap `read` tool output at 200 lines per call (configurable). Add `offset` parameter for pagination. Include line numbers always. Add a hard byte cap too (catches minified bundles). Return `"... N more lines (M bytes), use offset=K to continue"` instead of dumping.
- **Empty success formatting**: Tool results that produce no output return `"Command completed successfully with no output."` instead of `""`.
- **Grep/search results = file + hit count**, not full hunks, until the agent asks for a specific file. Reduces context blowout on broad searches (SWE-agent ACI rule). Optional micro-add if time allows.

**Files to modify**: [`src/foxcode/model-tier.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/model-tier.ts), [`src/tool/registry.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/registry.ts), [`src/tool/edit.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/edit.ts), [`src/tool/rewrite_file.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/rewrite_file.ts), [`src/tool/read.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/read.ts), [`src/tool/write.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/write.ts), [`src/tool/commit.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/commit.ts).

**Tests**:
- Tier S/A model sees: `edit`, `rewrite_file`, `read`, `grep`, `glob`, `lsp`, `bash`. Does NOT see: `apply_patch`, `write`, `commit`.
- Tier C/D model sees: `grep`, `bash` only (no edit tools — 2E-6 handles editing).
- Syntax gate rejects an edit that introduces new parse errors. Accepts an edit on a file that was already invalid if error count doesn't increase.
- Read pagination: 200-line cap, offset parameter works, byte cap catches minified files.
- Empty output: bash command with exit 0 and no stdout → "Command completed successfully with no output."
- `rewrite_file` with `create: true` creates a new file.

---

### 2E-5. *(Merged into 2E-3)* — Repo Map Injection + Working-Set Pinning

> This task is fully subsumed by 2E-3's `buildCodeContextBlock()`. See 2E-3 items 1, 4, and 5. Kept as a placeholder to preserve task numbering.

---

### 2E-6. Weak-Model Fast Path — Whole-File Generation Format (PR 4 — after context block)

**Problem**: For Tier C/D models, tool calling itself is the bottleneck. The 8B model couldn't reliably emit function-call JSON. Aider abandoned tool calling for weak models entirely.

**What to build**:

This is **the C/D contract**. 2E-4 defines S/A/B tool surfaces; this task defines C/D's generation format. There is no overlap — C/D models do not see edit tool schemas.

1. **Generation format switch**: When `resolveTier()` returns C or D:
   - Do NOT send tool schemas for `edit`/`apply_patch`/`rewrite_file`/`read` in the LLM request. Do NOT send `rewrite_file` either — if you do, 8B will emit a broken tool call instead of a fence.
   - Send only: system prompt (with code-context block from 2E-3, including repo map + pinned files) + user message.
   - Keep **`bash` and `grep` as the only tool schemas**. The model can still run commands, but editing is via the whole-file output format.
   - Instruct the model: "Output the complete updated file contents between ``` markers. Include the filename on the first line as `File: path/to/file`."

2. **Harness-side parsing**: After generation, extract code from the completion. Accept all of:
   - Fenced code blocks with `File: path` before the fence (Aider `whole` format).
   - Filename on the first line inside the fence.
   - SEARCH/REPLACE blocks (models learn this from training data).
   - **Multiple files in one completion**.
   Match filenames to known files, apply as `rewrite_file` operations internally via the harness (not tool calls).

3. **Reflection on empty extraction**: If zero files are extracted from the completion, inject a reflection: "Please output the complete file contents between ``` markers, with the filename on the first line." Do NOT fall back to "looks like the model is done" — that's the 8B bug.

4. **`read` as dynamic fallback**: `read` is not in the default C/D tool surface (2E-4). Add it dynamically only after one failed apply or empty grep, so a wrong pin is recoverable. Otherwise you recreate tool-calling on turn 2.

**Files to modify**: [`src/session/prompt/loop.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt/loop.ts) (generation format switch + harness-side parsing), [`src/session/prompt/prepare.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt/prepare.ts) (weak-model system prompt variant), [`src/tool/rewrite_file.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/rewrite_file.ts) (extraction logic, reusable from harness).
**Files to create**: `src/session/prompt/fence-parser.ts` (multi-format extraction: fences, SEARCH/REPLACE, File: header).

**Tests**:
- Tier D completion with two fences and one prose paragraph → both files extracted and applied.
- Prose-only response → reflection injected, not treated as "done."
- SEARCH/REPLACE blocks in a Tier D completion → parsed and applied as edits.
- `File: path/to/file` before fence → matched to known file.
- Zero files extracted → reflection, NOT exit.
- `read` not in initial C/D surface; appears after one failed apply.

---

### 2E-7. Multi-Attempt Architecture — Worktree Isolation + Deterministic Selection (PR 5 — after exit+verify are trusted)

**Problem**: Pass@1 is a product bug. Extra attempts plus a non-LLM selector beat a smarter single trajectory. No open CLI makes "3 attempts, 3 trees, one winner" the default.

**What to build (v1 — scoped for first PR)**:

1. **`fox run --attempts N` mode** (default N=1, opt-in N=3 for batch/headless):
   - For each attempt, create a `git worktree` in a temp directory.
   - Run the agent loop **sequentially** (v1; parallel is a future optimization) in each worktree.
   - Each attempt gets an **independent session** with its own message history. **Do not share SQLite session rows** across attempts.
   - Copy localize pins from `buildCodeContextBlock()` into each worktree's session context.
   - **Per-attempt timeout**: Each attempt gets `attempt_timeout` (default: 5 minutes). Prevents one stuck attempt from burning the entire budget.

2. **Deterministic selection** (no LLM judge):
   - **Filter**: Discard attempts where `git diff` is empty, tree-sitter parse fails on any changed file, or exit-time verification fails (2E-2).
   - **Rank** (for N=3, ranking beats clustering): (a) Verification passes completely. (b) Fewest new test failures vs baseline. (c) Smallest diff size. (d) Fastest completion.
   - **Cluster** (for N≥5 only): Normalize remaining diffs (strip whitespace/comment-only changes), hash, group. Largest cluster wins, ties broken by rank criteria above.
   - Apply winning diff to original HEAD via `git diff` from attempt tree, NOT via merge of dirty user work. Commit.

3. **Resource management**: Clean up all worktrees after selection. Report which attempt won and why in the session log.

**NOT in v1**: `--repro-first` (reproduction test generation), container/port isolation, parallel execution. Document that parallel tests on the same Postgres/port will give false results.

**Files to create**: `src/session/multi-attempt/orchestrator.ts`, `src/session/multi-attempt/worktree.ts` (git worktree lifecycle), `src/session/multi-attempt/selector.ts` (filter + rank + cluster).
**Files to modify**: `src/cli/cmd/run/run-message.ts` (add `--attempts` flag), [`src/session/prompt/loop.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt/loop.ts) (support worktree-isolated execution).

**Tests**:
- 3 attempts on a simple bug, one correct, two wrong → selector picks the correct one.
- Worktree creation and cleanup (no leaked worktrees on success or failure).
- Empty-diff filtering: attempt with no changes → discarded.
- Per-attempt timeout: stuck attempt → killed, remaining attempts continue.
- Winner applied as clean diff onto original HEAD, not merge.

---

### Success criteria (all four must be true before moving past 2E)

1. **Code-change task + weak model → at least one applied mutation, or a capped, explicit failure — never a prose exit.**
2. **Dirty/red repo → only *new* failures block.**
3. **Tier C/D → first completion can be a file, not a tool call.**
4. **KV prefix still hits when map/pins have not changed.**

If (1) is false, 2E-3 through 2E-7 are decoration.

### Ship order (PRs, not tasks)

> Do not start 2E-3/5/6 until 2E-1 fails closed on the Llama 8B trace. Otherwise you debug localize quality on a loop that still exits on prose.
>
> Do not "plan all of 2E then start at 2E-3 because the indexer is interesting." Implement in order. Stop and measure after each PR.

| PR | Tasks | Gate | Notes |
|---|---|---|---|
| **PR 1** | 2E-1 + 2E-2 + 2F-1 + 2F-4 | Re-run 8B Task 3 trace — must NOT exit on prose | Exit gate, verify reflection, harness commit, unified control-plane. One vertical slice. |
| **PR 2** | 2E-4 + 2F-2 (grep shape) | Typecheck + existing tests pass | ACI matrix + search shape. Hide `write`/`apply_patch`/`commit` from model. No C/D format switch yet. |
| **PR 3** | 2E-3 (includes 2E-5) | Localize top-3 accuracy on fixture repo with decoys | One `buildCodeContextBlock()`, one 5k envelope, honest cache key. |
| **PR 4** | 2E-6 | 8B model produces and applies a fence without tool calls | This is when 8B should start looking like Aider. |
| **PR 5** | 2E-7 | Exit + verify trusted from PR 1 | Multi-attempt multiplies a broken loop. Last. |

### Golden replay fixture

One frozen replay: 8B empty-exit transcript + a small fixture repo with a one-span bug and a decoy file. Each PR either changes that outcome in the intended direction or it is not merged. When Chronicle/cut-point replay (2G-4) ships, this fixture becomes CI. Until then, run it by hand every merge.

### Where plans will try to lie (require these in plan review)

- **Two C/D contracts.** Tool-`rewrite_file` and fence-parse cannot both ship. 2E-6 *is* C/D. Plans must say so.
- **A moving "stable" prefix.** Recency-weighted map every turn will miss `sysCache` every turn. Freeze map+pins; hash them into the cache key; refresh after apply.
- **Double verify.** Exit-time suite must no-op when the last mutation verify is fresh.
- **`git diff --stat` as mutation.** Use the journal / snapshot-from-goal, or new files and harness commits will not count (or user dirt will).
- **Intent false-negatives.** Fail open toward "this is a code change."
- **Path drift.** Resolve `intent.ts` / `rewrite_file.ts` / indexer against `main` in the first plan file, not in the last PR.

### Plan format requirement

Plans should name the **loop assertion** they enforce, not the files they touch. Example: "`break` is illegal when intent=code-change and mutation_journal is empty and empty_exit_retries < N." That is implementable. "Improve localization quality" is not.

Every plan must include a "non-goals / do not break" section preserving Fox's real differentiators: **local-first, prefix stability, transactional apply**.

### Tests the phase underweights (add to relevant task tests)

- Dirty repo with pre-existing red tests (2E-2 baseline).
- Model mutates, verify red, model claims done in prose without a new tool call (2E-1 + 2E-2 together).
- `commit` of empty tree must not count as mutation (2E-1).
- Tier D completion with two fences and one prose paragraph (2E-6).
- Map refresh after apply does not reuse the old prefix cache key (2E-3).
- Localize cold-index: generate still starts (2E-3).
- Intent false-negative: "the rate limiter tests are failing" must be code-change (2E-1).

### What is correctly left out of 2E

Installed-API index, insight memory, Chronicle replay, Docker-around-worktrees, reproduction tests as mandatory workflow, multi-agent debate, hippocampus memory. Stay out. Grep shape and harness commit are bundled into PR 1/PR 2. Control-plane table is PR 1. Working set, command graph, and incremental verify are 2F (after 2E gate passes).

Do not add tools. Do not add a second model. Do not fine-tune until you have a pile of *passing* Fox traces under the new loop. Do not grow `AGENTS.md` or challenge-ladders as a substitute for the gate. Compression stays a multiplier on a short, localized attempt — not a way to afford 15 grep turns.


---

## Phase 2F — Harness Law Refinements

> The remaining Aider/SWE-agent behaviors that 2E does not cover. Still harness law, still no extra model. Do not start until 2E-1/2E-2 actually kill the empty-exit trace on the 8B Llama benchmark.
>
> **Gate**: 2E-1 must fail closed on the 8B Task 3 trace before 2F work begins.

---

### 2F-1. Harness-Owned Commit (Git as the Unit of Work)

**Problem**: 2E hides `commit` as a tool but does not say the harness commits after a green apply. Aider's loop is edit → apply → lint → **commit**. Without this: rollback granularity is lost, the selector in 2E-7 has nothing clean to cherry-pick, and "best state" in 2E-2's rollback stays hand-wavy.

**What to build**:
- After successful apply + (optional) green verification, the harness creates a commit with a deterministic message (`fox: edit <file> (<tool>)`). The model never invents `git commit`.
- Empty diff → no commit. This is the 8B "committed unchanged files" cousin.
- Each harness commit is a checkpoint the exit-gate rollback (2E-2) can target. "Last green" = the commit hash after the most recent green verify.
- The 2E-7 selector cherry-picks from these commits, not from dirty worktree state.

**Files to modify**: [`src/session/processor.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/processor.ts) (post-apply commit hook), [`src/tool/commit.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/commit.ts) (reuse internal commit logic), [`packages/core/src/checkpoint.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/checkpoint.ts) (checkpoint ↔ commit hash mapping).

**Tests**: Successful edit → harness commit created with deterministic message. Empty diff after apply → no commit. Rollback targets the correct commit. Model cannot override harness commit message.

---

### 2F-2. Search ACI: Files + Counts, Not Hunks

**Problem**: `grep`/`search` dumps every match into context. SWE-agent measured that this interface change alone improved results. 2E-4 paginates `read` and formats empty bash; it does not change grep output shape. Dumping every match is how weak models drown.

**What to build**:
- Default `grep`/`search` returns `{path, n_hits, 1–2 preview lines}` per file. NOT full hunks.
- Full hunks only with `context=true` parameter or a follow-up `read` on the specific file.
- Cap total results at ~20 files. Summarize remainder as `"... and N more files"`.
- This is a tool output format change, not a new tool.

**Files to modify**: [`src/tool/grep.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/grep.ts) (output formatter), tool schema (add `context` parameter).

**Tests**: Broad grep → returns file + count + preview, not full hunks. `context=true` → returns full hunks. Cap at 20 files.

---

### 2F-3. Cheap-First Verify + Incremental Touch-Set

**Problem**: 2E-2 specifies exit-time verification and fresh-verify skip. This task implements the proper 3-stage incremental pipeline that avoids double-running full test suites and makes verification wall-time proportional to what changed, not the whole project.

**What to build**:
1. **Stage 1 (on apply)**: Tree-sitter / syntax check on the applied file. Already partially in 2E-4's syntax gate; this makes it the formal first stage.
2. **Stage 2 (on apply, if stage 1 passes)**: Lint/tsc on **touched files only** (not the full project). Use `tsc --noEmit <touched files>` or equivalent. Fast, catches 80% of errors.
3. **Stage 3 (at exit, if stages 1+2 are green)**: Full verification pipeline once. Skip if last mutation-tool verify is fresh on the same HEAD (no new mutations since).
4. One flake retry before consuming a repair budget slot.

**Files to modify**: [`packages/core/src/verification.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/verification.ts) (incremental pipeline), [`src/session/processor.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/processor.ts) (touch-set tracking).

**Tests**: Edit one file → stage 2 runs tsc on that file only, not the full project. Stage 3 skipped if stage 2 covered the same HEAD. Flake retry: first fail + second pass → no budget consumed.

---

### 2F-4. Unified Control-Plane Table

**Problem**: 2E-1 and 2E-2 introduce `max_empty_exit_retries` (2) and `max_repair_turns` (3). These will fight existing oscillation / doom-loop / max-steps caps. The cross-cutting design section in 2E describes the table; this task implements it as a tested module.

**What to build**:
- One module: `src/session/control-plane.ts`.
- One function: `resolveExitCondition(state) → "continue" | "break" | "rollback"`.
- One table:

| Condition | Action | Budget | Notes |
|---|---|---|---|
| Empty exit (no mutation on code-change task) | Inject reflection, `continue` | `max_empty_exit_retries` (2) | Reflection names allowed edit tool |
| Verify fail (new regressions only) | Inject reflection, `continue` | `max_repair_turns` (3) | Cheap stages first; baseline filters pre-existing |
| Syntax reject (edit tool) | Tool error return | Per-tool, not loop-level | Compare error count to pre-edit |
| Oscillation (A→B→A→B hash ring) | Warning + `break` | 3 oscillations | Hash ring buffer of recent edit diffs |
| Compaction overflow | Compact + `continue` | Existing compaction logic | Already in loop.ts |
| Max steps | `break` with warning | Existing step cap | Already in loop.ts |

- **Combination tests**: empty exit + verify fail in same turn. Verify fail + oscillation. Budget exhaustion on one axis while another is still open. These are the tests 2E underweights.

**Files to create**: `src/session/control-plane.ts`.
**Files to modify**: [`src/session/prompt/loop.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt/loop.ts) (replace inline exit logic with `resolveExitCondition` call).

**Tests**: 6 individual condition tests + 4 combination tests (see above). Budget exhaustion exits cleanly. Two conditions triggering simultaneously → higher-priority wins.

---

### 2F-5. `/add` Working Set as a First-Class Session Object

**Problem**: 2E-5 pins localize hits into the prefix. But Aider's durable advantage is the human (or harness) *keeping* files in the prompt across turns. Without a persistent working set, 2E-6's whole-file format only works on the first turn — after turn 1, the pinned files may have rotated out.

**What to build**:
- **Session working set** = localize pins ∪ files successfully mutated by the harness ∪ explicit `/add` ∪ explicit `--file` flag.
- Stable across turns until `/drop` or session end.
- Working set files are always included in `buildCodeContextBlock()` (2E-3) pinned body budget. They have priority over localize-only pins.
- `/add <path>` and `/drop <path>` commands in the TUI.
- Working set is what makes 2E-6 possible after turn 1: the model's edited file stays in the prefix for the next completion.

**Files to create**: `src/session/working-set.ts` (session-scoped file set with add/drop/list).
**Files to modify**: [`src/session/code-context.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/code-context.ts) (from 2E-3; working set feeds into pinned bodies), TUI command registry.

**Tests**: `/add` file → appears in prefix on next turn. `/drop` → removed. Mutated file auto-added to working set. Working set survives across turns. Budget overflow → localize pins truncated before working set pins.

---

### 2F-6. Project Command Graph as Session Law

**Problem**: Fox sniffs `package.json` scripts but the model can still invent `pytest -q` in a Bazel repo, or `npm test` in a Bun project. The verification pipeline and bash policy should use only detected commands, not model-invented ones.

**What to build**:
- On session start, detect and persist `{typecheck, test, lint, build}` commands from project config (`package.json`, `Makefile`, `pyproject.toml`, `Cargo.toml`, etc.).
- The verification pipeline (2E-2, 2F-3) uses **only** these detected commands. No LLM guessing.
- Bash policy: if the model runs a test/lint command that doesn't match the detected graph, append a warning: "Detected test command is `bun run test`, not `npm test`. Use the detected command."
- User can override via `fox.jsonc` config or `/set test_command <cmd>`.

**Files to modify**: [`packages/core/src/verification.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/verification.ts) (consume detected commands), [`src/session/processor.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/processor.ts) (capture on session start).
**Files to create**: `src/session/project-commands.ts` (detection + persistence).

**Tests**: Bun project → detects `bun run test`, not `npm test`. Model runs `npm test` → warning injected. `fox.jsonc` override respected. Multiple config sources detected in priority order.

---

### 2F-7. Fold or Freeze `general`/`explore` Agents

**Problem**: Fox's `general` and `explore` agents are same-model clones with all tools and no harness discipline — the exact pattern that makes Goose's subagents ineffective. They dilute the loop's authority over exit/verify/commit. Keeping them alongside the hardened 2E loop creates two paths: the disciplined path (main agent with exit gate) and the undisciplined path (subagent with all tools, no gate).

**What to build**:
- **Fold `general` into the main agent**. The main agent already has all tools; `general` adds nothing. Remove the agent definition.
- **Freeze `explore`**: convert from "agent with all tools" to a **read-only preset** that restricts the tool surface to `read`, `grep`, `glob`, `lsp`, `bash` (no mutation tools). This makes it genuinely useful for exploration without the risk of unverified writes.
- **Do not add new agent personas.** Scout = a capped parent tool (PR 3 graph queries). Scribe = fence-parse format (PR 4). Runner = verify pipeline (PR 1). None of these are agents.
- Audit any session code that dispatches to `general`/`explore` and ensure it routes through the exit gate.

**Source**: Competitive analysis — Goose weakness #5 ("subagents unclutter chat; they do not own apply").

**Files to modify**: Agent definitions in `src/foxcode/agents/`, `src/session/prompt/loop.ts` (remove general dispatch), session tools resolution.

**Tests**: Main agent with code-change task → full exit gate applies. `explore` preset → mutation tools not in surface. No agent path bypasses `resolveExitCondition()`.

---

## Phase 2G — Infrastructure & Traces

> Still no supervisor model. These multiply infrastructure quality, not loop correctness. Do after 2F, when you have green traces from the hardened loop.
>
> **Gate**: 2E+2F produce passing traces on the 8B benchmark before 2G starts.

---

### 2G-1. Installed-Surface Index

**Problem**: Agents invent APIs from training data. The 2026 version is Pydantic v1 code in a v2 repo, or `express@4` patterns in an `express@5` project.

**What to build**:
- Parse what is importable in this venv / `node_modules`: name, version, top-level exports with signatures.
- Inject ~20–40 tokens per relevant package into the code-context block: "you have `foo==3.2`, `Bar` is `Bar(x: int)`."
- **Fail-closed on missing symbols**: after apply, if the patch references an identifier the installed index does not know, reject the edit and show the nearest real export. Static check, not LLM.

**Files to create**: `src/session/installed-index.ts`.

**Tests**: `node_modules/express` → detects version + top exports. Patch references non-existent export → rejected with suggestion.

---

### 2G-2. Insight Memory (MTL), Not Chat Dumps

**Problem**: Raw trajectory storage barely helps and can hurt (Kim et al. 2026). 94% of the gain was procedural meta-knowledge, not replayed algorithms.

**What to build**:
- After a *verified* success or a repeated failure class, write a 3-line insight with file pointers: "write a repro first," "don't patch tests to silence," "preserve export signatures."
- Retrieve 3–5 insights by repo + task type. No embedding of whole chats.
- Admission rule: only admit insights cited to a trajectory span you still have (content hash). Uncited memories become prompt poison.

**Files to modify**: existing `@foxcode/memory` package.

**Tests**: Verified success → insight written. Retrieval by repo + task type returns relevant insights. Uncited insight → rejected.

---

### 2G-3. Worktree + Process Isolation

**Problem**: 2E-7 isolates git via worktrees. Ports, DB connections, and processes still collide across parallel attempts.

**What to build**:
- Unique `PORT` / `TMPDIR` / `DATABASE_URL` suffix per attempt worktree.
- Container wrap as opt-in `--isolate=docker`.
- Required before defaulting `--attempts 3` on anything that boots a server.

**Files to modify**: `src/session/multi-attempt/worktree.ts` (from 2E-7).

**Tests**: Two parallel attempts → different PORT values. Docker isolation → each attempt in its own container.

---

### 2G-4. Harness Replay (Chronicle-Style)

**Problem**: Without replay, you cannot verify that loop changes (2E/2F) don't regress. You guess with fixtures that don't measure "did we edit the right file."

**What to build**:
- Record model I/O + tool envelopes (already persisted in SQLite).
- Cut-point replay: replay `loop.ts` / edit apply / exit gate against a frozen Llama empty-exit fixture with new harness code.
- Not user-facing. This is harness CI.

**Files to create**: `test/harness-replay/` directory with replay runner.

**Tests**: Replay the 8B empty-exit trace against 2E loop → must reject exit. Replay a successful trace → must allow exit.

---

### 2G-5. Attempt Selector Using Repro Flip

**Problem**: 2E-7 marked `--repro-first` as stretch. With 2F-1's harness commits, this becomes viable.

**What to build**:
- Before patching, generate a failing repro test/script on HEAD.
- After patching, require it to flip to passing.
- Use repro flip as rank-0 signal in the 2E-7 selector. Still no LLM judge.
- Opt-in `--repro-first` flag.

**Files to create**: `src/session/multi-attempt/repro.ts`.

**Tests**: Repro test generated → fails on HEAD → passes after patch → attempt ranked highest. Repro that doesn't flip → attempt penalized.

---

### 2G-6. Two-Model Dispatch (Parent/Editor on Separate Hardware)

**Problem**: Aider's architect/editor assumes two API tiers to the same cloud. Fox's environment is two physical GPUs with different resident models (H200 for planning, RTX 6000 for fast edits). The tier system (2E-4) and fence-parse (2E-6) provide the foundation, but there's no mechanism to route the parent's plan to a *different model* on *different hardware* for the editing step.

**What to build**:
- **`EditSpec` output format**: When the parent model (write-banned, S/A tier on H200) completes planning, it emits an `EditSpec` — a structured description of what to change (`{files, intent, approach}`) that the harness can route.
- **Editor dispatch**: The harness routes the `EditSpec` + pinned file content to the editor model (C/D tier on RTX 6000). The editor produces fenced file output (2E-6 format). The harness applies, verifies, and commits.
- **Model routing config**: `fox.jsonc` config for mapping tiers to providers/endpoints: `{ "parent": { "provider": "openai-compat", "endpoint": "http://h200:8000/v1" }, "editor": { "provider": "openai-compat", "endpoint": "http://rtx6000:8000/v1" } }`.
- **Constraint**: Parent cannot write (no mutation tools). Editor cannot search (no `grep`/`read` — it gets pinned files from the harness). This is Aider's architect/editor mapped to physical hardware.

**Source**: Competitive analysis — Aider weakness #7 ("architect/editor is two API roles, not two GPUs").

**Files to create**: `src/session/model-dispatch.ts` (routing logic), `src/session/edit-spec.ts` (EditSpec type + parser).
**Files to modify**: `src/session/prompt/loop.ts` (two-model orchestration), `src/foxcode/config/config.ts` (model routing config).

**Tests**: Parent emits EditSpec → editor receives pinned files + spec → produces fence → harness applies. Parent cannot call mutation tools. Editor cannot call search tools. Single-model fallback works (both parent and editor are the same model).

---

### 2G-7. Selective Compaction (Compact Outputs, Not Map/Errors)

**Problem**: Fox's compaction (and Goose's) summarizes the entire conversation uniformly. This destroys the code-context block that was cached in the KV prefix, and erases error messages the model needs to recover from a bug. The H200's prefix cache is expensive to refill.

**What to build**:
- **Tiered compaction**: When context limit is approaching, compact in this order:
  1. **Tool output payloads** (grep results, read output, bash stdout) — summarize to `{tool, file, status, 1-line summary}`.
  2. **Old assistant prose** (explanations, planning text older than N turns) — summarize to 1 sentence.
  3. **Never compact**: system prefix (code-context block, map, pins), error messages from verification failures, mutation journal entries.
- **Compaction boundary**: The code-context block is in the system prefix. It is never part of conversation compaction. Error messages from the last 2 verification failures are pinned (not compacted) so the model can still see what went wrong.
- **Metric**: After compaction, the KV prefix cache key should still hit (the system prefix didn't change).

**Source**: Competitive analysis — Goose weakness #2 ("compact at 80% destroys the prefix you paid to cache").

**Files to modify**: Compaction logic in `src/session/prompt/` (tiered compaction rules), `src/session/code-context.ts` (mark as non-compactable).

**Tests**: Compaction fires → tool outputs summarized → system prefix unchanged → KV cache key still hits. Error messages from last 2 verify failures survive compaction. Old prose compacted. Code-context block never touched.

---

### What is explicitly not scheduled yet

- Guardian Layers 1–3, F-classifier, Wingman `/enhance`
- Learned PRM / trajectory critic as the primary selector
- SWE-Gym SFT / RL on Fox traces (only after hundreds of *passing* 2E+2F traces)
- Hippocampus / MemGPT paging
- GraphRAG-in-Neo4j
- Auto-Skill / auto-rule generation
- Multi-agent debate

SFT on Fox-format successful trajectories becomes rational **after** 2E+2F produce green traces. It is not a harness task.

---


## Phase 3 — Guardian (Autonomy Intelligence Layer)

> The dual-agent oversight system. 4-layer architecture (Programmatic Controller → Classifier → Decision Engine → Corrector)
> with L0–L3 authority postures. Needed for `--auto` / headless / `/goal` modes.
> Depends on Phase 2 foundation being in place. Ship incrementally — Layer 0 (programmatic)
> first, then LLM layers, then GUI.

See: `fox-code-cli/docs/research/2026-09-24T08-39_guardian-role.md`.

### Phase 3A-1 — Guardian Visibility (L0 + L1)

> **Layer 0 (programmatic) first, then LLM layers, then GUI easiest → hardest.**

**Layer 0: Programmatic Controller (no LLM, ship first):**

- [ ] **15. Guardian Config + Decision Logging + CLI** — Config loading (`fox.jsonc` guardian section, CLI flags, defaults). `GuardianDecisionLog` schema → session metadata. `fox guardian-log` CLI. Preset postures per project.
- [ ] **15b. Programmatic Controller: Counters + Boundaries** — Retry/repair budget counters. Doom loop detection (N identical errors → stop). Oscillation detection (A→B→A→B hash ring buffer). File boundary enforcement (diff files ∩ allowed set). Cost/token budget tracking. Context size monitoring. Progress tracking (completed steps vs plan).
- [ ] **15c. Programmatic Controller: Process Hooks + Baselines** — Auto-lint after file write (run `lint_command`, feed errors to Worker). Auto-test after significant edits (compare to baseline). Test/lint/build baseline capture at task start. Fallback behavior (Guardian failure → conservative posture).

**Layers 1–3: LLM Engine (ship after Layer 0 is solid):**

- [ ] **16. Guardian Classifier + Decision Engine** — Layer 1 (action model, constrained decoding via XGrammar, F1–F16). Layer 2 (deterministic posture × severity × confidence lookup table). Confidence model (logprobs). Context injection correction (lightest, needed for L1 advise).
- [ ] **17. Trip-Wires + Pre-Task Analysis + Human Intent Review (F16)** — Semantic scope analysis (beyond Layer 0 file boundaries). F16 human intent review (elevated thresholds).

**GUI (easiest → hardest, after engine works):**

- [ ] **18a. GUI Tier 1 (Trivial)** — Status bar (`🛡️ Wingman · ready`), Wingman↔Guardian naming transition, `/guardian <posture>` commands, `/guardian off`, `Esc` drops to L1.
- [ ] **18b. GUI Tier 2 (Easy)** — `/guardian status` panel (posture, trip-wires, recent decisions, confidence), warning panel, `/scope` (scope radar), `/context` (context health).
- [ ] **18c. GUI Tier 3 (Medium)** — User-invokable Wingman commands: `/enhance`, `/plan`, `/verify`, `/refine`, `/scope narrow`. Ready-to-use prompts, one-click override.
- [ ] **18d. GUI Tier 4 (Hard)** — Wingman auto-propose: auto-detect bad prompt → offer `/enhance` with accept/edit/ignore. The autocomplete behavior. Ship *after* manual commands are proven.

### Phase 3A-2 — Guardian Light Corrections (L2)

**Engine:**

- [ ] **19. L2 Correction Engine** — Strategy redirect, plan rewrite, snapshot rollback. Watchdog fiber (continuous monitoring between checkpoints). Session-local adjustment (override tracking, nag prevention).
- [ ] **20. Multi-Model Routing (LLM-based)** — Guardian classifies failure types and recommends model tier changes. Complements the deterministic routing from Phase 2C.

**GUI (easiest → hardest):**

- [ ] **20a. L2 Posture + Mid-Session Switching** — L2 `guard` posture. `/guardian guard`, `Esc` drops posture. Auto-correct low-severity, stop on medium/high.
- [ ] **20b. Wingman Live Monitoring GUI** — Progress pulse ("3 of 7 steps done"), `/context compact`, `/trajectory`, live trajectory commentary, one-click interventions ("Redirect strategy?"), silent trip-wire highlights. Ghost suggestions (prototype — high UX risk).

### Phase 3A-3 — Guardian Full Autonomy (L3)

- [ ] **21. L3 Engine + Posture** — Diff rejection + rewrite (heaviest correction). L3 `autopilot` posture. Headless BLOCKED policy (timeout, notification, `snapshot_and_abort`). Pre-commit review gate.

### Phase 3B — Task Decomposition + Wingman Memory

- [ ] **22. Guardian Phase B — Task Decomposition** — Guardian owns goal decomposition into task graphs with dependencies and acceptance criteria. Extends `todowrite` with status tracking and task supersession.

**Deferred GUI (ships after 3A is battle-tested):**

- [ ] **22b. Wingman Preference Memory + /memory + /learn** — `/memory` (show/forget/export preferences), `/learn "<constraint>"` (teach explicitly, `--repo` to persist as rule). Cross-session pattern detection ("Overridden 'major drift' 3 times — loosen rule?"). Diff digest + retrospective nudges.
- [ ] **22c. Wingman Auto-Discovery (Skills, Rules, Config)** — Detect repeating patterns and offer to productize: repeated workflows → Skill (`.agents/skills/`), repeated preferences → Rule (`.agents/rules/`), repeated severity overrides → Config change (`fox.jsonc`). Conservative — never auto-create, always offer, always let user edit before saving.
- [ ] **22d. Wingman Chat Side-Channel** — Lightweight way to ask Wingman questions ("Is this on track?") without breaking the main Worker flow.

### Phase 3C — Multi-Worker

- [ ] **23. Guardian Phase C — Multi-Worker** — Multiple doer sessions executing tasks in parallel, Guardian managing load balancing, branch isolation, and result aggregation.

---

## Phase 4 — Architecture, Security & UX

> Infrastructure hardening, sandboxing, and long-horizon features.

- [ ] **24. OS-Level Sandboxing (BP 10)** — Container/sandbox isolation for agent execution. Mutations happen in isolated environments, not the user's working tree.
- [ ] **25. MCP Sidecar Security (BP 8)** — Secure MCP tool execution with capability-scoped permissions and audit logging.
- [ ] **26. Long-Horizon Project Memory (BP 7)** — Persistent memory across sessions for ongoing projects. The agent remembers prior context, decisions, and established patterns.
- [ ] **27. Snapshot ↔ Oscillation Integration (3d)** — Layer snapshot tracking into oscillation detection without coupling it into the core loop.
- [ ] **28. Mini-TUI Decoupling** — Extract the TUI into a standalone package for embedding in other tools.
- [ ] **29. ACP Multi-Root & Diff Cards** — VS Code extension support for multi-root workspaces and visual diff review.
- [ ] **30. Cross-Session Checklist State Machine** — Persist task checklists across sessions with state tracking.
- [ ] **31. TUI Live Telemetry Dashboard (BP 13)** — Real-time token usage, cost, and performance metrics in the TUI.
