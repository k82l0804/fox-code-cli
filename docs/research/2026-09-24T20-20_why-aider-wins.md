Looking at `k82l0804/fox-code-cli`, the gap is not “Aider has more tools.” It is where the harness sits in the loop. Fox is still a ReAct tool loop that **exits when the model stops calling tools**. Aider is an edit-apply-verify loop that **does not take the model’s word for done**.

Your own bench already captured the failure mode. On Llama 3.1 8B / Task 3, Aider passed in one turn; Fox ran 7 turns, never called `edit`, committed unchanged files, and said the tests passed. That is a loop-control bug, not a model-quality bug.

---

## What Fox’s loop actually does

`src/session/prompt/loop.ts` is a classic OpenCode/Kilo ReAct loop:

1. Load messages, compact if overflowing.
2. Resolve tools for the model tier.
3. Call the LLM with tools.
4. If the last assistant message has `finish` and **no live tool calls**, **break**.
5. Otherwise continue.

The exit gate is here:

```217:237:src/session/prompt/loop.ts
if (
  lastAssistantMsgRef?.finish &&
  !["tool-calls"].includes(lastAssistantMsgRef.finish) &&
  ...
  !hasToolCalls &&
  lastAssistantMsgRef.parentID === lastUser.id &&
  userBeforeAssistant
) {
  ...
  break
}
```

There is no check that:

- a file was mutated
- SEARCH/REPLACE actually applied
- lint/tests are green
- the claimed fix differs from HEAD

Aider’s `base_coder.py` does the opposite after every completion: parse edits → apply → commit → lint → optional test → if any of those fail, set `reflected_message` and force another generation (max 3). The model cannot end the turn by narrating success.

That single difference explains most of the head-to-head.

---

## The five Aider behaviors Fox does not do

### 1. Repo structure is a tool call, not prefix context

Fox already has an indexer and `fetch_repo_map` / `lookup_symbols`. They are **tools**. The model must decide to call them. Aider injects a PageRank-trimmed map into **every** prompt before generation, ~1k tokens, no tool call required.

Worse for local models: `src/foxcode/model-tier.ts` puts `fetch_repo_map` and `lookup_symbols` in `TIER_COMPLEX_TOOLS`, so Tier C/D models **cannot even call the map**. Those are the models that need it most.

Aider: weak model sees signatures on turn 0.  
Fox: weak model greps, or guesses, or stops.

### 2. Working-set files are not in the prompt

Aider `/add`s files and pastes their full text into a stable prefix block. The completion *is* the edit against text the model already has.

Fox’s first action is almost always `read` / `grep` / `glob`. That is a second task (tool schema + path + wait + next generate) before any patch exists. Local models drop the original request across those hops. Your 8B trace is exactly that: bash/test theater, no `edit`.

`rewrite_file` is the right idea (Aider’s `whole` format), but it is still a tool the model must choose. Aider switches the **generation format** to whole-file for weak models. The model never has to emit a function call.

### 3. “Done” is model-declared, not harness-verified

Fox already built the verification layer in `packages/core/src/verification.ts` and wired it in `src/session/processor.ts`. It is good code. It is hooked in the wrong place.

It only runs **after** `edit` / `apply_patch` / `write` / `commit`:

```74:79:packages/core/src/verification.ts
export const MUTATION_TOOLS = new Set(["edit", "apply_patch", "write", "commit"])
```

```667:691:src/session/processor.ts
if (autoVerifyEnabled) {
  ...
  outputText = `${outputText}\n\n${feedback}`
}
```

So:

- No mutation → no verify → model says “fixed” → loop exits.
- Verify result is appended to a **tool result**. It does not create a harness reflection the way Aider’s `reflected_message = lint_errors` does.
- Repair budget warns; it does not reject a stop.
- `bash` with exit 0 on an unchanged tree still counts as success (`recordSuccess`).

Aider never asks the model “are you done?” The harness runs lint/test and only then stops.

### 4. Edit application is optional tool use, not the completion contract

Aider: one completion must be SEARCH/REPLACE, udiff, or whole file. Parse failure is a reflection with the exact unmatched lines.

Fox: the model may emit prose and stop. `edit` / `apply_patch` have a real transactional journal and confidence scoring — better plumbing than Aider in isolation — but they only matter if the model calls them. The 8B run never did.

Architect/editor split: you have a `scribe` agent that only uses `rewrite_file`. Aider runs that split **inside one user turn** automatically (plan model → editor model). Fox requires the primary agent to delegate, which small models do not do.

### 5. Git is a tool, not the unit of work

`commit` is in the tool registry and is a Tier C/D complex tool (hidden from weak models). Aider commits after every successful apply in the harness. That gives:

- revert
- “what changed” as `git show` instead of re-reading files
- a cheap done-check: if `git diff` is empty, you did not fix anything

Your 8B case (“1 commit” of unmodified files) would be a hard fail if the loop required a non-empty diff plus green tests.

---

## Why this hurts Fox more than the compression work helps

The compression engine, byte-stable system-prompt cache (`sysCache`, `toolDefCache` in `loop.ts`), oscillation detector, and shadow checkpoints are aimed at **long ReAct trajectories**. Aider mostly refuses to have those trajectories.

| | Aider | Fox today |
|---|---|---|
| Context before generate | map + full chat files | env + AGENTS.md + tools; files via `read` |
| Action | completion = patch | completion = maybe tools |
| Verify | harness, every apply | after mutation tools only |
| Stop | apply+lint+test succeed | model `finish` without tool calls |
| Weak-model mode | switch edit format to `whole` | hide complex tools, hope it calls `rewrite_file` |
| KV prefix | stable map+files | stable system/tools; file bodies live in the **tail** as tool results |

So Fox can reuse the system-prompt KV cache and still lose, because the *decision-relevant* tokens (the file to edit) arrive after the first generation. Aider puts those tokens in the cached prefix.

Compressing tool output is the right optimization for Goose-style loops. It does not fix “the model never entered the edit path.”

---

## What to change, in the order that would move the Aider numbers

These are harness changes in `loop.ts` / `processor.ts`, not more transforms.

**A. Gate loop exit (highest leverage, small patch)**  
Before `break` on a finished assistant message:

- if the user task looks like a code change, require at least one successful mutation this turn, **or**
- run the verification pipeline now (not only after mutation tools), **or**
- if `git diff` is empty and tests still fail / baseline still red, inject a reflection user message and `continue`.

That alone would have stopped the 8B “I fixed it” exit. You already wrote this in the bench doc as “turn-level anti-hallucination assertion.”

**B. Inject a bounded repo map into the system prefix every turn**  
Reuse the existing indexer. Do not wait for `fetch_repo_map`. Keep it in the cached system block so KV still hits. For Tier C/D, inject *more* map, not less, and drop `edit`/`apply_patch` in favor of whole-file as the **only** generation path.

**C. Weak-model fast path = Aider `whole`, not fewer tools**  
When `resolveTier` is C/D, do not send tool schemas for edit/patch/read-the-world. Send: map + candidate file bodies + “output the full new file.” Parse that as `rewrite_file` in the harness. Tool calling is what 8B chokes on; Aider already abandoned it for that class.

**D. Make verify a reflection, not a footnote**  
If `formatPipelineFeedback` is non-green, set something equivalent to Aider’s `reflected_message` and refuse `finish`. Cap with `max_repair_turns` the way you already track budget — but **enforce** it in `loop.ts`, not as text the model can ignore.

**E. Optional: `/add` working set**  
After map + identifier mentions, pin 1–4 files into the prefix. Then surgical `edit` is cheap and cache-stable. Exploration tools become fallback when the map was wrong, not the default first 6 turns.

---

Fox already has the pieces Aider uses (indexer, whole-file write, lint/test runner, repair cap, git). They are attached to the **tool stream**. Aider attached them to the **harness**. Until `loop.ts` will not exit on prose, Aider will keep winning the tasks where the right file is sitting on disk and the job is “change it correctly.”