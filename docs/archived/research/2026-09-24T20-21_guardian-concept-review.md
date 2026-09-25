Guardian is a strong product concept and a weak answer to why Aider beats Fox. The spec is unusually clear. The “game-changing” claim is mostly Layer 0 wearing a 16-class LLM supervisor.

## Verdict

Ship **Layer 0 as harness law**. Do not ship Layers 1–3, F16, Wingman autocomplete, or the TUI command surface until the Worker loop already refuses to stop on prose.

If Layer 0 is done properly, you will have stolen the part of Aider that actually wins benches: *the harness owns apply / lint / test / stop*. Everything above Layer 0 is a second agent watching a first agent that still does not have a closed control loop. That is expensive theater.

The spec even says this:

> Layer 0 … is what tools like Aider do for their entire supervisory layer.

That sentence is the design. The rest of the document tries to build a company around it.

---

## What is actually good

**The posture model (L0–L3) is the right product idea.** Interactive vs `--auto` is not two codepaths. It is one supervisor with a dial. That matches how people use coding agents.

**“When the human steps back, something sits in their chair”** is correct. Goose and Fox both die in the gap between raw ReAct and hard circuit breakers. Aider never had that gap because it never gave the model the stop button.

**Layer 0’s checklist is the right checklist.** Counters, file bounds, lint/test after writes, baselines, oscillation, repair budget. Fox already has pieces of this (`verification.ts`, `oscillation.ts`, `repair-budget.ts`, snapshots). They are attached to tool *results*, not to loop *control*. Guardian Layer 0 is “move those from footnotes into `loop.ts`.” That is the Aider port.

**Corrections as injected tool-output, Worker-blind**, is the right mechanism if you ever need an LLM supervisor. Do not give the Worker a `consult_guardian` tool.

**Degrade more conservative on Guardian failure** is the only acceptable fallback. Good.

**False positives hurt more than false negatives in TUI.** That caveat is more important than half the architecture. Protect it.

---

## Where the idea is confused

### 1. You are supervising the symptom

Aider does not win because Claude is watched by a second model. Aider wins because:

- the repo map and files are in the prompt before generation
- the completion *is* the edit
- lint/test run whether the model asked or not
- empty diff + “all tests pass” is rejected by construction

Fox loses because `loop.ts` breaks when `finish && !hasToolCalls`. An 8B Worker can run `bash`, commit nothing, and exit. Guardian Layer 1 classifying that as F8/F9 *after the fact* is slower and less reliable than:

```
if claimed_done && (no_mutation || tests_still_red):
    reflect; continue
```

That is ten lines in the Worker loop. Guardian v4.0 is seventy pages around those ten lines.

### 2. Layer 0 is specified as “easy first phase.” It is the product.

The delivery plan puts E0a–E0o under “Visibility (L0 + L1)” as if logging and lint hooks are scaffolding for the classifier. They are not. They *are* Aider. If you treat them as prelude to xLAM + XGrammar + Wingman chat, you will gold-plate the wrong layer and ship the useful one half-wired — which is the state Fox is in today: verification exists, loop exit ignores it.

### 3. Two LLMs do not fix one bad loop

Context asymmetry (Guardian at 3–8k, Worker at 80–120k) is sold as a feature. It is also why Guardian will be wrong a lot:

- F8/F9 (misread logs/tests) need the actual log. You compressed it.
- F1 (unsafe diff) needs the diff and surrounding code. A 500-token classifier will rubber-stamp or false-positive.
- F10 (wrong file) needs the map Aider already put in the Worker prompt. Guardian cannot see files the Worker never read.
- F11/F12 (plan quality) is a planning problem. Better to make the Worker plan in a structured format the harness can check than to have a second model rewrite plans.

You will spend tokens arguing with yourself.

### 4. “Worker must not know Guardian exists” fights correction

Plan rewrite injects: *“Your plan has been updated. Follow the revised plan below.”* That is a visible supervisor. Fine. Then don’t also claim stealth. Pick one:

- stealth: only append evidence-bearing notes to tool output (Aider reflections)
- explicit: a control plane that can stop/rewrite

Mixing them makes evals and user mental models messy.

### 5. F1–F16 is too wide for a first classifier

Half of those classes are Layer 0 if you instrument the Worker:

| Class | Do this instead of an LLM |
|---|---|
| F2 hallucinated path | `exists()` before apply |
| F3/F4 drift | allowed-file set from `/add` + map |
| F5/F6 over-edit | diff stat caps, export-signature tripwire |
| F7 runaway | oscillation + identical-error counter (you have this) |
| F13 tool misuse | tier filter + format fallback (you have the start) |
| F15 catastrophic | permission + path denylist + `rm -rf` patterns |

What actually needs semantics: F1 unsafe, F8/F9 interpretation, F11/F12 plan, F16 prompt risk. That is a later product, not the Aider gap.

F16 in particular is a different product (prompt safety / scope coach). Putting it in the same enum as “Worker edited the wrong file” will make the classifier timid or annoying. Your own text says F16 is not a prompt-quality coach, then Wingman `/enhance` is exactly a prompt-quality coach. Those should not share a model call.

### 6. Confidence-from-logprobs is oversold

Constrained decoding renormalizes; you noted that. Consistency sampling on high/critical triples latency. Asking an 8B action model to output `failure_class` + `severity` and then treating P(token) as calibrated risk is how you get confident wrong stops. For a TUI default of L1, one bad stop and the user sets `--guardian=off`.

If you need a number, use **agreement with Layer 0 evidence**: “tests red AND no mutation” is confidence 1.0 with no LLM.

### 7. Watchdog fiber vs KV and latency

“Interrupt the Worker at any time” and “don’t add perceptible latency to every tool call” are in tension. A second fiber that can preempt apply is real systems work (cancellation, partial patches, journal rollback). You already have a transactional patch engine. Don’t put an async LLM in front of `apply` until Layer 0 pre-apply checks (path in allowed set, diff size, secret scan) are boring and fast.

Pre-apply LLM review of every diff will make Fox feel like the thing you forked away from: waiting on a cloud nanny.

### 8. Wingman autocomplete is a second startup

`/enhance` `/plan` `/verify` `/refine` `/scope` `/context` `/trajectory` `/memory` `/learn` plus ghost suggestions plus side-channel chat is Cursor-scale UX. It is not what makes the Worker beat Aider. It will eat the calendar that should go to:

- map in prefix
- working-set files in prefix
- whole-file generation mode for small models
- harness-owned stop

Your own caveat #5 says this. Believe it.

---

## Opportunity cost, stated bluntly

Aider’s loop is ~2000 lines of Python and twenty years of “the editor is the agent.” Guardian v4.0 is a control-theory paper plus a TUI product plus a memory product plus a skills product.

If the next two months go to classifier schemas and status-bar copy, Fox will still lose the 8B/31B coding benches, and you will have a supervisor of a Worker that still cannot reliably edit.

The competitive doc you already wrote named the two missing assertions. Guardian Layer 0 *is* those assertions. Guardian Layer 1 is a research project on top.

---

## A thinner Guardian that would actually be game-changing

Collapse v4.0 to this, in order:

**G0 — Worker loop law (this week)**  
In `loop.ts`, before `break` on `finish && !hasToolCalls`:

1. If the session looks like a code task and `git diff` is empty and the last verification/baseline is red → inject Aider-style reflection, `continue`.
2. If a mutation happened → run existing `Verification.executePipeline`, append feedback, if new regressions → `continue` until `max_repair_turns`.
3. If mutation tools were available and unused on a “fix the tests” goal → do not accept stop.

No new model. This is Aider. This is also §2.2 Layer 0 “process hooks” and “resolve.”

**G1 — Trip-wires without an LLM (same week)**  
Allowed files from explicit working set + map. Block apply outside the set (posture L2/L3 auto-block, L1 warn). Doom loop / oscillation already exist; **make them stop the loop**, not decorate `outputText`.

**G2 — Weak-model format switch (same week)**  
Tier C/D: do not supervise tool misuse. Remove tools. Generate whole files. Guardian cannot classify a model that never called `edit`.

**G3 — Optional cheap classifier, much later**  
Only F1 / F15 / “is this still the same task.” One constrained JSON object. Default posture L1. If acceptance rate of flags is <60%, turn it off. No F16, no Wingman memory, no live trajectory essay.

**G4 — Wingman prompt assist as a separate feature**  
`/enhance` is useful. It is not Guardian. Do not couple it to failure classes or autopilot.

Name the shipped thing **harness** until G3 exists. Calling Layer 0 “Guardian” makes it sound like you need xLAM to lint after a write.

---

## If you still want the full Guardian

Keep these constraints or it will become net negative:

- Circuit breakers cannot be disabled by `guardian.enabled` (you said this; enforce it in code).
- Layer 1 must be allowed to return `none` as the common case. Measure **silence rate**, not fire rate.
- Pre-apply LLM is opt-in and off by default. Path/size/secret checks are not.
- No mid-tool-call interrupt until Layer 0 cancel paths are tested against the patch journal.
- One decision log is enough UX for months. Status bar can wait.
- Do not use the Worker model as classifier “because it’s there.” A general coder will sermonize and burn the latency budget.

---

Guardian as *human-replacement policy around a closed loop* is the right long-term shape for `--auto`. Guardian as *the thing that makes Fox as good as Aider* is backwards. Close the Worker loop first. The seat the human vacates only matters if the Worker is already driving on rails.