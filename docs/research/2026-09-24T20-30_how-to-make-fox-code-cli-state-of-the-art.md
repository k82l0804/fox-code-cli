Assume the Aider-shaped loop work is done and there is no LLM Guardian. What is left that actually separates a SOTA coding CLI from “another OpenCode fork with compression”?

Three things competitors still under-ship: **localization quality**, **selection under extra compute**, and **an execution environment the agent cannot lie about**. Most of the usable research in 2025–2026 is in those three buckets. Multi-agent supervisors and hippocampus memory blogs are not.

---

## 1. Localization is still the bottleneck. Treat it as a pipeline, not a tool.

Wrong file → everything downstream is theater. Agentless, LocAgent, SweRank, CoSIL all show the same split: **find the span, then patch**, and localization accuracy moves resolve rate more than a fancier ReAct loop.

What is production-ready:

- **Hierarchical localize**: file → module → function → edit span. Agentless did this with cheap prompts plus repo structure; you already have an AST indexer. Do not wait for the Worker to `grep`. Run localize as a deterministic prelude, pin the spans, then let the Worker edit. That is not “Aider map in the prefix.” It is a search problem with a ranked candidate list.
- **Heterogeneous code graph**: files / classes / functions + imports / calls / inheritance. LocAgent’s graph walk (entity search + multi-hop neighbors) is the piece grep will never do: “who calls this after a rename.” Fox’s `lookup_symbols` is the stub. Expose `callers`, `callees`, `importers`, `impact(path)` as first-class tools with hard result caps.
- **Hybrid retrieve, AST chunks only**: BM25 + optional small local embedding + graph, fused with RRF. Chunk on tree-sitter function/class boundaries, never 500-character windows. JetBrains, Claude Context, Locus, codebase-memory-mcp all converged here in 2026. Grep stays for exact identifiers; semantic search is for “refund when coupon expires.”
- **SweRank-style rerank**: a small local reranker over 20 hits beats another frontier call that reads five files. Ready if you accept an extra 100–300ms on first retrieve.

What is not ready: training your own LocAgent-32B unless you want a research sidecar. Use the graph + BM25 now; fine-tune later on Fox traces.

Competitors: Aider’s map is shallow (signatures + PageRank). Goose/OpenCode/Cline still lead with grep/glob/read. Cursor’s index is closed. A local CLI that answers structural questions in ~100 tokens instead of three `read`s is still rare.

---

## 2. Pass@1 is a product bug. SOTA is sample-and-select.

On SWE-bench, extra attempts plus a **non-LLM selector** beat a smarter single trajectory. Agentless: sample N patches (one greedy, rest T=0.8), drop anything that fails syntax or existing tests, generate a **reproduction test**, rank by “fails before / passes after + fewest regressions,” majority-vote normalized diffs. That stack is old and still the honest scaling law.

What Fox can ship that CLIs mostly do not:

- **Worktree per attempt, not per chat.** Cursor and Claude Code have `/worktree`. Almost no open CLI makes “3 attempts, 3 trees, one winner” the default for `fox run`. Isolation of *files* is necessary; isolation of **ports / DB / processes** is the part people skip and then declare worktrees “enough.” For real tests, wrap the tree in a container or at least a unique `PORT`/`TMPDIR`.
- **Patch clustering before any judge.** Normalize whitespace/comments, hash, vote. Ties broken by: reproduction test, then lint, then diff size. No second model.
- **Reproduction-first.** First artifact is a test (or script) that fails on HEAD and states the bug. The patch is accepted only if that test flips. Agentless called this out; almost no interactive CLI forces it. This is the single highest-leverage workflow change after the loop fixes you already know.
- **Best-of-N for local models specifically.** Your A100/5090 setup makes this cheap. DeepSeek-class models plus 8–32 parallel short trajectories is how open weights close on Opus, not a 200-step ReAct novel. Serving (prefix cache, concurrent attempts) matters as much as the agent.

Not ready: learned process-reward models / trajectory critics as the *primary* selector. SWE-Gym verifiers work in papers; they rot across repos and need constant retraining. Use tests as the PRM.

---

## 3. ACI: fewer, stricter tools. This is still free accuracy.

SWE-agent’s result has not expired: the same model with a designed interface beat raw bash by a lot. mini-SWE-agent’s later point is the corollary — a tiny ACI can beat a cathedral. Fox’s registry is already a cathedral (`edit`, `write`, `apply_patch`, `rewrite_file`, `fetch_repo_map`, `lookup_symbols`, `lsp`, `task`, `skill`, …). That is a selection problem for 30B models.

Ready, boring, high yield:

- **One edit tool per tier.** Surgical XOR whole-file. Not four writers.
- **Bounded viewer, not `cat`.** 100-line windows, line numbers, `scroll`, in-file search. SWE-agent measured this.
- **Search returns files + counts, not hunks**, until the agent asks for a file. Dumping every match blows context and confuses local models.
- **Empty success is a sentence.** `"command produced no output"` beats `""`.
- **Edit that fails syntax does not apply.** Tree-sitter / `tsc` / compiler as a gate on the tool, not a later suggestion.
- **LSP for navigation, grep for text.** `definition` / `references` / `diagnostics` should be the default hop. You have the tool; the prompt still teaches grep-first.

This is not Guardian. It is HCI for a non-human user.

---

## 4. Make the environment the source of truth

Agents still invent APIs from training data. The 2026 version of that bug is Pydantic v1 code in a v2 repo.

Ready:

- **Installed-surface index.** Parse *what is importable in this venv/node_modules*: signatures, overloads, versions. Inject 20 tokens of “you have `foo==3.2`, `Bar` is `Bar(x: int)`.” This is closer to `agent-coderag` than to RAG-over-your-src.
- **Fail-closed on missing symbols** after apply: if the patch references an identifier the index does not know, reject and show the nearest real one. That is static, not an LLM.
- **Project command graph.** You already sniff `package.json` scripts. Persist “this repo’s real test/typecheck/lint incantations” as session law so the Worker cannot invent `pytest -q` in a Bazel tree.

Competitors mostly hope the model `cat`s `package.json`.

---

## 5. Memory that transfers is principles, not transcripts

Kim et al. 2026 (Memory Transfer Learning): raw trajectories barely help and can hurt; **insights** (“write a repro first,” “don’t patch tests to silence,” “preserve export signatures”) transfer. 94% of the gain was procedural meta-knowledge, not algorithms. Smaller store beat AgentKB/ReasoningBank.

Ready:

- After a *verified* success or a repeated failure class, write a 3-line insight with a pointer to the repo files involved. Retrieve 3–5 insights by repo + task type. No embedding of whole chats.
- Admit a memory only if it is cited to a trajectory span you still have (even a content hash). Uncited memories become prompt poison. The HMAC/NLI stack in “verifiable memory” is heavier than you need; the *admission rule* is the idea.

Not ready: hippocampus agents, cross-vendor memory buses, auto-Skill generation. Those are product narratives.

Fox already has memory packages. The mistake would be storing diffs and “we used edit on processor.ts.”

---

## 6. The harness should be testable like a compiler

Chronicle (Sep 2026): record non-deterministic boundaries (model I/O, tool I/O), replay from a cut point with new harness code. That is how you stop guessing whether a loop change helped.

AgentLens: score the *trajectory* (instruction following, tool use, verify, recover), not only pass/fail. Use it on Fox itself.

This is not user-facing SOTA. It is how you *get* to SOTA without lying to yourself with 334 compression fixtures that do not measure “did we edit the right file.”

Ready: record tool envelopes + model messages you already persist in SQLite; add cut-point replay for `loop.ts` / `edit.ts` / verification. Do this before any more challenge-ladder theater.

---

## 7. Fine-tune the local Worker on Fox traces (optional moat)

SWE-Gym: a few hundred real tool trajectories + tests lifted a 32B OpenHands agent by ~14 points. Rejection sampling + a verifier then gives test-time scaling. You have the hardware and you generate traces every day.

Ready if you treat it as a **Fox-ACI specialist**, not a general coder: SFT on (successful Fox tool sequences + your edit format). Do not start with RL. Sky-RL-style online RL is still a lab sport.

This is the one place a second model is justified without being Guardian: a small **outcome classifier** trained on “did hidden tests pass,” used only to pick among N finished worktrees. Still second to real tests.

---

## What competitors are leaving on the table

| Gap | Who almost does it | Who does not |
|---|---|---|
| Structural graph queries as default nav | LocAgent, some MCP indexers | Aider, Goose, OpenCode, Cline |
| Reproduction test as admission ticket | Agentless (batch) | Every interactive CLI |
| Best-of-N + worktree + container | Cursor `/best-of-n` (closed), a few swarms | Open CLIs; they parallelize *chats*, not *attempts* |
| ACI minimalism | mini-SWE-agent, SWE-agent | Everyone else (tool sprawl) |
| Installed API truth | Almost nobody | Everyone |
| Insight-level memory with admission rules | Papers | Mem0-style slurries |
| Trajectory replay for harness CI | Chronicle (new) | Nobody shipping |
| Local-model BoN as the product | Serving papers | CLIs still market “one smart loop” |
| Honest eval (public vs private SWE-bench gap is now large) | Scale Pro v2 commentary | README scoreboards |

Fox’s existing bets — lossless compression, byte-stable prefix, transactional journal, shadow checkpoints — are real, and they are **multipliers on the above**, not substitutes. Compression on a 15-turn grep tour is the wrong optimum. Compression on 3 localized files + 8 parallel short attempts is the right one.

---

## Research: ship / wait / ignore

**Ship now (implementations exist, gains reproducible):**

- Agentless localize → patch → validate (Xia et al.)
- LocAgent / CoSIL-style graph hops
- AST chunk + hybrid BM25/vector + RRF
- SWE-agent ACI rules (viewer, lint-on-edit, terse search)
- Worktree (+ container) isolation
- Reproduction tests as oracles
- Normalized-diff majority vote
- Insight memory (MTL), not trajectory dumps
- Installed-package signature index

**Wait until you have traces and tests:**

- SWE-Gym SFT on Fox format
- Small reranker (SweRank class)
- Cut-point replay (Chronicle) as Fox CI
- Learned attempt selector only as backup to tests

**Ignore for a coding CLI in 2026:**

- Multi-agent debate / supervisor LLMs
- Hippocampus / MemGPT paging as the core
- GraphRAG with a heavy DB
- Outcome-supervised RL in the inner loop
- Auto-Skill / auto-rule generation
- Anything that needs the Worker to “know it is being watched”

---

## A Fox-shaped SOTA stack (no Guardian, no Aider-rerun)

```
task
  → localize (graph + BM25 + rerank) → pin spans
  → write/keep a reproduction test that fails on HEAD
  → N short attempts in worktrees (optional containers)
       each: bounded ACI, LSP nav, one edit tool
  → filter: syntax, typecheck, repro flips, no new baseline regressions
  → cluster remaining diffs, vote
  → apply winner, commit, done
  → write 0–1 insight if the episode taught a reusable rule
```

That is closer to Agentless + LocAgent + SWE-agent ACI + Cursor isolation than to OpenCode-plus-compression. It also matches how the 2026 leaderboards actually move: **better place to edit, more draws, a test that cannot be talked into green.**

If you only pick three after the loop work: **graph localize, repro-first admission, N isolated attempts with a deterministic selector.** Everything else is polish or a paper.