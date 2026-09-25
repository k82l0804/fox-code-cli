Fox does not win by becoming a nicer Aider or a slimmer Goose. It wins by taking **Aider’s harness discipline** and **Goose’s autonomy**, then exploiting the places each refused to specialize: **air-gap, 131k local inference, KV-stable context, and code as a graph rather than a chat.**

---

## What each one actually is

**Aider** is a pair-programmer with a compiler-like edit loop: map in the prefix, files you `/add`, parseable patches, lint, commit. That loop is why it beats Fox today. It is *not* a long-horizon repo agent. Maintainers themselves say it is not optimized for large repos; the map is shallow tags + PageRank; weak models get the map **turned off** so they do not try to edit it. Local use is an afterthought (Ollama windows, whole-file only). Development cadence has gone quiet (last release Aug 2025; no commits in the 90 days to Sep 2026).

**Goose** is a general agent runtime: MCP, recipes, desktop, subagents, hooks. Coding is one skill among many. Context strategy is “summarize at 80%.” Tool-pair summarization has been aggressive enough to erase the error that would have let the model recover; huge tool JSON has livelocked sessions (truncate → retry → 1000-turn cap). There is no Aider-style working set or repo map. Quality on code is “whatever model you bolted on.” Air-gap is possible; the product gravity is cloud MCP.

**Fox today** is Goose-shaped (ReAct + tools + subagents on one model) with Aider-shaped *parts* not wired to the loop. That is the worst of both until Slice A lands.

---

## Aider’s weaknesses Fox should steal

| Aider gap | Why it hurts | Fox counter |
|---|---|---|
| Human must `/add` | Model cannot see what you did not pin; large tasks die or you over-pin and drown the window | Harness localize (graph + BM25) **then** pin. `/add` remains, it is not the only on-ramp |
| Map is signatures + PageRank, capped ~1k, **disabled for weak models** | Weak local models get *less* structure | Weak/editor models get **more** map + full pinned bodies; they do not get edit tools (2E-6). They cannot “edit the map” if they never emit tools |
| Not a repo navigator | Multi-hop “who calls this after rename” is grep-and-hope | `callers` / `callees` / `importers` as harness prelude, not a tool the model may skip |
| One conversation, one tree | Pass@1. No isolated retries | `--attempts N` on worktrees + deterministic selector. Aider will not grow this; the repo is cold |
| Pair loop, weak autonomy | Users who want “fix the failing tests in this package” still babysit | Same Aider gates (no prose exit, verify, harness commit) **without** requiring a human to name every file |
| Python + GitPython | Large packfiles, mmap limits, slow map on monorepos | You already live in a TS CLI with an indexer. Stay off GitPython’s path; map from the AST index, not from packing every blob |
| Architect/editor is two **API** roles | In an air gap you have H200 + 6000, not Sonnet+Haiku | Parent write-banned on H200; editor format on the 6000. That is Aider’s best idea aimed at hardware Aider never designed for |
| Maintenance / local-model neglect | Whole-file is a footnote; 131k two-box serving is not a product | Make local 131k + prefix cache + compression the default path, not a provider checkbox |

Do **not** try to beat Aider at “smallest prompt that still SEARCH/REPLACEs.” They own that on Claude. Beat them at **repos they tell you to `--subtree-only`**, and at **models they disable the map for**.

---

## Goose’s weaknesses Fox should steal

| Goose gap | Why it hurts | Fox counter |
|---|---|---|
| Generalist loop | Tools for Drive/Jira/browser compete with `edit`. Coding ACI is whoever wrote the developer extension | One coding ACI. No MCP in the air-gap product surface. `general`/`explore` as they exist now are Goose-in-miniature — fold them |
| Compact-at-80% | Summaries destroy the prefix you paid H200 to cache; recovery context disappears | Compaction is last resort. Prefer pin/drop + journal. When you compact, compact **tool payloads**, not the frozen map |
| Tool output is untrusted sludge | Huge writes truncate mid-JSON and retry forever | Bounded viewer, grep-as-file+count, syntax gate, empty-output sentence, parse-fail circuit breaker (3 identical failures → stop). Goose filed this as P1 in 2026; you can ship it as law |
| No working set | Session is a transcript. After compact, the model has a story about files, not the files | Session working set + localize pins in the system prefix |
| Subagents unclutter chat; they do not own apply | Same-model clones with all tools | Scout is a capped read tool. Scribe is a format. Runner is verify. Parent cannot write |
| Recipes ≠ verify | YAML workflows do not know your `tsc` vs Bazel | Detected command graph as session law |
| Host-native, MCP-shaped | Wrong default for a banned-cloud shop | Zero cloud providers in the binary. Extensions that need net do not exist |
| Git is “basic” | History is not a unit of work | Harness commit per green apply (steal this from Aider, not Goose) |

Do **not** try to beat Goose at “agent OS + 70 MCP servers.” In your environment that is a liability. Beat them at **the coding loop they treated as one skill.**

---

## The wedge (where Fox is allowed to be unique)

Three constraints they do not share and you cannot pretend you do not have:

1. **Cloud is banned.** Aider’s leaderboard and Goose’s MCP directory assume Anthropic/OpenRouter. Your bake-off is Ultra / Gemma-4 / gpt-oss-120b on H200. Whoever’s loop is honest on *those* models wins the only eval that matters.
2. **131k is real and KV is expensive.** Aider resends chat files; Goose summarizes them away. Fox’s compression + frozen prefix + `sysCache` is the only design that treats H200 prefill as the scarce resource. Every feature that churns the system prefix is an own-goal.
3. **Two GPUs with different jobs.** Aider’s architect/editor is two prompts to one API. Goose’s subagents are two prompts to one model. You can physically put judgment on H200 and decode on the 6000. That only pays if the editor sees **pins**, not a tool catalog.

That is the architecture: **Aider’s state machine, Goose’s willingness to run unattended, neither product’s context policy, on hardware they did not build for.**

```
Aider:  map + /add + parse + lint + commit          ← keep, automate the /add
Goose:  just keep calling tools until compact       ← reject
Fox:    localize → pin → parent plan → editor format
        → apply/syntax → verify-new-failures → commit
        → KV prefix frozen unless pins change
```

---

## How that shows up in product, not slides

Against **Aider** in a demo: same repo Aider wants `--subtree-only` on. You do not `/add`. First completion from the 6000 is a patch to the right span. Pre-existing red tests do not block. Weak model never emits tool JSON. That is a visible win.

Against **Goose** in a demo: same long session. Goose hits 80% and summarizes away the file the bug was in, or retries a truncated write. Fox still has the pins, a journal, and a 3-strike parse cap. Git log is one commit per green apply, not a blob of agent noise.

Against **both** on your bench: the frozen 8B/small-coder empty-exit fixture. Aider often works because the format is the loop. Goose often “finishes.” Fox must match Aider’s done-condition and beat Goose’s context death.

---

## What not to copy (or you become them)

- Aider’s “disable map for weak models.” That is how local users lose.
- Aider’s single-attempt religion.
- Goose’s MCP/recipe surface as the identity.
- Goose’s same-model subagent tree (`general` + `explore` + scout + scribe + runner).
- Anyone’s compact-as-default.
- Cloud-shaped evals as the north star.

---

## Win condition, one paragraph

Aider will stay better at “I already know the two files, use Claude, give me a commit” until their repo wakes up — and even then they will not grow graph localize, worktree BoN, or a 6000 editor format. Goose will stay better at “talk to Jira and a browser.” Fox wins the **air-gapped, large-repo, local-131k coding loop**: harness-owned done/verify/commit, structure the model cannot skip, parent that cannot write, editor that cannot search, context that does not get summarized into amnesia. That is not a third general agent. It is the coding compiler Aider started and stopped, running on the machines Goose treats as just another provider.