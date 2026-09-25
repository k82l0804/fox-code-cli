# Fox Code CLI — consolidated recommendations

Air-gapped. H200 serves Nemotron-3-Ultra-550B, Gemma 4 (large), gpt-oss-120b (131k). RTX PRO 6000 96GB is a **second, smaller, faster coder**. Goal: beat Aider/Goose on *those* models, not on cloud Opus.

Guardian / Wingman stay out of scope.

---

## 1. What is actually wrong today

Fox already has the pieces (indexer, whole-file write, verification, snapshots, compression, KV-aware prefix). They hang off the **tool stream**. Aider hangs the same ideas off the **harness**.

The 8B-class failure is the proof: seven turns, no `edit`, commit of unchanged files, loop exits because `loop.ts` treats “assistant finished with no tool calls” as done.

Until that gate moves, extra agents, extra GPUs, and extra localize tools will not close the gap.

**Loop assertions to enforce:**

- Code-change task + no successful harness mutation → cannot `break` (reflect, cap retries).
- Mutations present + verify configured + *new* failures vs baseline → cannot `break`.
- Weak/small model → first completion can be a file, not a tool-call JSON.
- Map + pins live in a prefix whose **hash is in the cache key**; they do not change every turn.

If assertion 1 is false, stop implementing everything else.

---

## 2. Environment: two speeds, not two flagships

| Lane | Hardware | Models | Job |
|---|---|---|---|
| Quality / parent | H200 | Ultra 550B first; else gpt-oss-120b or Gemma 4 31B | Plan, choose spans, read scout summaries, no writes |
| Latency / editor | RTX PRO 6000 96GB | **Smaller than the H200 tenants** — Gemma 4 12B or 26B-A4B, or a 7–14B coder | Whole-file or SEARCH/REPLACE on **pinned** files |

Ultra does not fit on 96GB. gpt-oss-120b and Gemma 31B already run on H200; copying them onto the 6000 wastes the card. One resident model on the 6000. Two means swap or short context.

131k belongs to the parent prefix (env + frozen map + pins + task). Do not fill it with scout hunk dumps.

---

## 3. Agent shape: architect / editor, not a crew

Current `main` + `general` + `explore`, all the same model, is the thing to escape.

**Do not add scout + runner + scribe as peer agents that the parent may forget to call.** That recreates “the model may localize.”

Target:

```
task
  → harness localize + map + pin          (2E-3 / 2E-5)
  → parent on H200: plan, no mutation tools
  → editor on 6000: format contract (2E-6) or one edit tool
  → harness apply, syntax gate, verify, commit
```

| Name | What it really is |
|---|---|
| Parent | Write-banned. Emits an `EditSpec` (paths, intent) or a short plan. May request a **bounded** scout. |
| Scout | Optional parent tool, not a persona. `read` / `grep` / `glob` only. Returns `{file, n_hits, span, reason}` capped hard. Used when harness localize is wrong. |
| Scribe | **A format**, not an agent. Pinned files in → fenced files out. Harness parses. No `write` tool, no git. |
| Runner | Not an LLM. It is the verify pipeline (detected test/lint/tsc on the touch-set). |
| `explore` / `general` | Fold or freeze. Three read-only specialists is tax. `general` with all tools is the old loop. |

Parallel only for **read-only, disjoint** scouts, or for **2E-7 worktree attempts**. Never two writers on one tree. The 6000 design point is **one editor decode stream**. Scout batching only if the editor model is not occupying the card.

Dispatch is not a mutation. If the parent “finishes” without an applied edit, 2E-1 still reflects.

---

## 4. Work to implement (order is the recommendation)

### Slice A — Aider loop (do this first, measure the empty-exit trace)

**2E-1** Exit gate: intent=code-change and mutation journal empty → user-role reflection, not `break`. `max_empty_exit_retries` default 2. Fail **open** toward code-change. Journal / snapshot-from-goal, not only `git diff --stat`.

**2E-2** Exit-time verify. Block only on **new** failures vs baseline. Repair budget is a hard cap. Skip the suite if the last mutation-tool verify is fresh on the same HEAD. Cheap stages (syntax, lint/tsc on touch-set) before full tests. Flake: retry once.

**2F-1** Harness commit after green apply. Model does not get `commit`. Empty diff → no commit.

**2F-4** One control table: `empty_exit | verify_fail | syntax_reject | oscillation | compaction | max_steps` → `continue | break | rollback`.

Re-run the weak-model “no edit” fixture. If it still exits on prose, do not start Slice B.

### Slice B — ACI (same loop, fewer ways to miss)

**2E-4** One matrix, no extra writers:

- S/A (H200 parent tools if it ever edits): `edit` + `rewrite_file(create)` only.
- C/D / 6000 editor: **no edit tools** — Slice C format.
- Hide `write`, `apply_patch`, `commit` from default surfaces.
- Syntax gate on apply (tree-sitter; compare error count to pre-edit).
- `read`: line numbers, ≤200 lines, offset, byte cap.
- Empty tool output → `"Command completed successfully with no output."`

**2F-2** `grep`/`search` default = `{path, n_hits, tiny preview}`, not hunks.

### Slice C — Context the model cannot skip

**2E-3 + 2E-5 as one `buildCodeContextBlock()`**  
Single envelope (e.g. ~5k tokens): map, then localize list, then pinned bodies. Truncate pins first. AST chunks only. BM25 over **identifiers + paths**, not `git ls-files` alone. Graph `callers` / `callees` / `importers` are harness-internal. Do not block first generate on a cold full index.

Pins = localize top spans ∪ working set ∪ files already mutated. Refresh map/pins after successful apply, **not every turn**. Cache key includes the block hash.

**2F-5** Working set as a session object (`/add` / `/drop`), not “last 4 reads.”

**2E-6** Editor / Tier C-D contract: no edit-tool schemas. Instruct fences + filename; also accept Aider-style `File:` and SEARCH/REPLACE. Zero files extracted → reflect. Keep `grep` so a bad pin is recoverable.

### Slice D — Extra draws (after the loop is honest)

**2E-7** `fox run --attempts N` default 1. Worktree per attempt, sequential first. Filter empty/syntax/verify-fail; cluster normalized diffs; rank by verify then diff size (majority vote only helps at N≥5). Cleanup worktrees. Per-attempt timeout. Independent sessions.

**2F-6** Detected `{typecheck,test,lint,build}` are session law. Verify and runner use those strings.

### Later (2G) — do not schedule against Slice A

- Installed-package signature index (stop Pydantic-v1-in-v2).
- Insight memory: 3-line principles after *verified* episodes, cited to a span.
- Worktree + `PORT`/`TMPDIR` (container opt-in) before defaulting N=3 on servers.
- Cut-point replay of the empty-exit fixture (harness CI).
- `--repro-first` as rank-0 selector.
- SFT on Fox traces only after you have hundreds of **green** Slice A–C runs.

**Do not schedule:** LLM supervisor, F-classifier, learned PRM as primary selector, GraphRAG database, auto-Skills, multi-agent debate.

---

## 5. Plans and PRs

- A plan names a **loop assertion**, not a file list.
- First PR vertical slice = 2E-1 + 2E-2 + 2F-1 + 2F-4.
- 2E-4 and 2E-6 are one C/D contract (format wins).
- 2E-3 and 2E-5 are one prefix builder (one budget, honest KV key).
- Resolve paths against current `main` (`intent.ts`, `rewrite_file.ts`, indexer) in the first plan.
- Golden fixture: frozen weak-model empty-exit + small repo with one real span and one decoy. Every merge must move that outcome or it does not merge.
- Do not break: lossless compression, byte-stable prefix when inputs are unchanged, transactional apply/journal.

---

## 6. How this meets the subagent + 6000 proposal

| Proposal | Keep? |
|---|---|
| Smaller/faster coder on the 6000 | Yes. Different weights than H200. |
| Parent ≠ editor model | Yes. Aider architect/editor. |
| Scout with read/grep/glob | Yes as a **capped parent tool**, after harness localize. |
| Scribe with `rewrite_file`/`write` tools | No. Scribe is 2E-6 parse. |
| Runner as read-only agent | No. Runner is verify. |
| Parallel when possible | Read-only or isolated attempts only. |
| Keep `general` + `explore` + three new names | No. |

Two-speed hardware plus 2E harness is the approach. A named crew on top of an exit condition the model still owns is not.

---

## 7. Done looks like

On the air-gapped stack, a code-change task with parent=Ultra (or 120b) and editor=6000-small:

1. Localize spans appear in the first prefix without a tool call.
2. Parent never writes; editor returns files; harness applies.
3. Red tests that the agent introduced bounce back as a user-role reflection until repair budget or green.
4. Loop never exits on “I fixed it” with a clean `git diff`.
5. H200 prefix cache hits across editor turns when pins have not changed.
6. Aider comparison on **your** models and **your** repos moves; that is the metric.

Paper is sufficient. Cut the first plan at exit + verify + harness commit, measure the empty-exit fixture, then turn on the 6000 editor.