Your gut is right. The *product* is right. The current framing still has a few places that will make Guardian look like “another agent” instead of the thing that makes long unattended runs actually ship.

## The verdict

Pursue it. Not as a competitor to Aider or Goose. As a **reliability harness for hours-long autonomous coding**, with the human spending intelligence on the plan and the merge, and almost nowhere in between.

That is no longer a speculative bet. The industry independently converged on the same shape this year: plan first, run unattended, review in a *separate* context, persist progress on disk, hard-stop on loops and budgets. OpenAI’s Auto-review, Anthropic’s separate-window grader, DoorDash’s antagonistic reviewer, Ralph-style fresh-context loops, and “plan quality determines how long you can leave it alone” are all the same idea from different angles.

Fox already has the hard pieces most of those systems fake: transactional patches, oscillation hashing, repair budget, adaptive compression, snapshots, goal states. Guardian is the missing *intelligence* layer between “raw doer” and “circuit breaker.” That gap is real. Your README already names it cleanly: in interactive mode the human *is* the guardian; in `--auto` nobody is.

## What is already correct — keep this

**1. Autonomy is a request, not a guarantee.**  
That sentence should be the product slogan. Most CLIs treat `--auto` / `--yolo` as “stop asking.” You treat it as “ask the Guardian whether this task is even allowed to run unattended.” That is the right inversion.

**2. Hard-coded vs. LLM is the correct split.**  
SHA-256 A→B→A, identical-call doom loops, repair counters, timeouts, snapshots — never give those to an LLM. Failure classification, strategy choice, semantic drift, “is this actually done” — never hard-code those. You already drew that table. Do not blur it.

**3. Sliding authority (advise / enforce / surrogate).**  
One analyzer, three permission policies. That is how you avoid building two products. Interactive Fox should *feel* like it has a wingman. Headless Fox should *be* that wingman with a kill switch.

**4. Context asymmetry.**  
Doer at 80–120k, Guardian at 3–8k, compaction owned by the Guardian, plan contract pinned. This is the actual invention. Same-window self-review is how agents rubber-stamp themselves. A lean reviewer with a frozen plan is how they don’t.

**5. Plan → gate → unattended implement.**  
That is the only loop that survives contact with speed. Once the doer is moving faster than you can read, reviewing *code* is the wrong human job. Reviewing *intent* is the right one.

## What to change in the concept

### 1. Stop saying “same model, same logic.”

That line undercuts the design.

The *analysis shape* can be the same. The *context, prompt, incentives, and optionally the model* must not be. A Guardian that shares the doer’s transcript will inherit the doer’s rationalizations. Every serious system that works here uses a **fresh window + frozen artifacts** (plan, diff, test output, file list) — not the doer’s inner monologue.

Perfected rule:

- Guardian never sees the doer’s chain-of-thought.
- Guardian sees: pinned plan contract, milestone list, diff stat, test/typecheck result, oscillation flags, token/milestone velocity.
- Optionally a *weaker/cheaper or different* model. Independence beats raw IQ. A mid-tier model with a clean brief outperforms a frontier model that is arguing with itself.

If you keep one model for cost, keep **two contexts**. That is non-negotiable.

### 2. The product is the Plan Contract, not the Guardian.

Guardian is infrastructure. What the user *buys* is: “I can write a plan good enough that I can walk away.”

Make the contract a first-class object, not a prompt prefix:

- goal in one sentence
- in-scope files / packages
- out-of-scope files (hard tether)
- acceptance tests (commands + expected signal)
- rollback anchor (commit SHA / snapshot id)
- blast-radius budget (max files, max lines, forbidden paths)
- definition of done that is *binary*

`/plan` + `/refine` + Guardian intake gate should refuse to start `--auto` unless those fields are filled. Vague prompt → Assisted Scaffold with `[REQUIRED]` / `[MISSING]`. You already have this. Promote it from design-doc idea to the *only* way `--auto` starts.

If the plan is weak, Guardian cannot save the run. If the plan is sharp, a dumb doer plus circuit breakers will often finish. That is the leverage.

### 3. Soften the “humans lack the intelligence” line.

Humans are the bottleneck on **speed, stamina, and working memory**, not on taste or accountability.

Agents already outrun review. Faros-style data this year is ugly: review time explodes when agents accelerate writing. That is your verve, and it is true.

What humans still uniquely own:

- whether the plan is the *right problem*
- constraints that were never written down
- “tests pass and the design is still wrong”
- merge / ship / liability

If Guardian is sold as “smarter than you at judging the work,” it will overclaim and you will ship confident slop. If it is sold as **“I watch the run at machine speed so you only spend judgment at plan and merge,”** it is honest and defensible.

Wingman, not replacement. Surrogate for *attention*, not for *ownership*.

### 4. Escalation is a feature, not a failure.

`flag_for_human` / `stop` / wake-up audit need to be first-class UX, not an apology.

Unattended runs should end in one of four states:

| State | Meaning |
|---|---|
| `done` | Plan contract satisfied, tests green, Guardian approved |
| `blocked` | Needs a human decision (ambiguous spec, policy, design fork) |
| `failed-safe` | Circuit breaker or Guardian stop; workspace rolled to snapshot |
| `needs-review` | Looks done, Guardian is unsure — here is the walkthrough |

A Guardian that always “continues” is a yes-man. A Guardian that can *pause well* is a companion. The wake-up audit you designed (dirty files, active plan, completed steps, suggested prompt) is the most human thing in the whole doc. Build that early.

### 5. Verification is the real immune system. Guardian is the adaptive layer.

Do not let LLM review become the primary quality gate. Order of operations:

1. Deterministic: tests, typecheck, lint, oscillation, repair budget, path tether, blast radius
2. Structural: diff vs plan contract, files outside milestone, snapshot delta
3. Guardian: classify *why* it failed, whether “done” is real, whether strategy should change
4. Human: only on `blocked` / `needs-review` / merge

A2 (pre-commit review) should be allowed to say “tests are green and this still violates the plan.” That is the whole point. It should *not* be allowed to override a red test suite.

### 6. Name the anti-goals.

Write these at the top of the design and keep them:

- Not a better pair-programmer than Aider
- Not a general desktop agent like Goose
- Not a federation of 12 personas
- Not “Yolo but with a poem about safety”
- Not self-review in the same window

Fox wins if someone can start a 2–6 hour job, leave, and come back to a workspace that is either *correct against a contract* or *cleanly stopped with a briefing*. That is a narrower, harder, more valuable product.

## Perfected concept (use this)

**Fox is a local-first coding harness that treats autonomy as a gated privilege.**  
You and the tools produce a Plan Contract. The Guardian accepts or rejects that contract. After acceptance, a Doer implements against the contract with no human in the loop. Deterministic circuit breakers stop loops and wreckage. The Guardian — a small, separate-context reviewer — steps in only at decision points: intake, failure classification, progress drift, compaction, and completion. When it cannot honestly stand in for you, it stops and writes the briefing you would have wanted. You remain accountable for the plan and the merge. Guardian exists because agent coding is now faster than human supervision, and because context compression plus hallucination is what kills long runs — not lack of another coding model.

That is the verve, tightened.

## The loop, stripped to what you should ship in 2A

```
/enhance → /plan → /refine
        ↓
Guardian intake
  structured + safe → run
  ambiguous        → scaffold, refuse --auto
        ↓
Doer turns (tools bounded by profile)
  every mutation → verify (tests/types)
  on fail        → Guardian A1 (fix / switch strategy / stop)
  every N turns  → Guardian A3 (continue / refocus / stop)
  context fat    → Guardian compaction directive (pin contract, drop tactics)
        ↓
green + doer says done
        ↓
Guardian A2 review (fresh context, artifacts only)
  approve          → atomic commit + walkthrough
  request_changes  → back to doer with a bound
  flag_for_human   → wake-up audit, clean pause
```

Circuit breakers sit under all of this and can fire without asking Guardian.

That is enough. Phase C multi-node federation will eat the solo-dev year and is not required to prove the thesis.

## The risks that actually decide if this is worth it

**Correlated failure.** Same weights, same repo dialect, same “be helpful” prior → Guardian agrees with a wrong doer. Mitigate with frozen artifacts, a hostile review prompt (“find reasons this is *not* done”), and a cheap second opinion on `approve`.

**Plan theater.** Beautiful plans that don’t constrain the doer. If out-of-scope file edits don’t halt the run, the contract is decoration.

**Latency tax.** 3–5 Guardian calls/session is the right budget. If A3 runs every turn, you built a second doer. Keep Guardian calls tiny and rare.

**False confidence.** The scariest failure is green tests + approved review + wrong product behavior. Your only honest mitigation is binary acceptance criteria *you* wrote, plus `needs-review` when the diff is large relative to the plan.

**Scope gravity.** You already have compression, patches, ACP, TUI, routing. Guardian will try to become an operating system. 2A is three gates + plan object + compaction directive + wake-up audit. Everything else is a later phase that you only earn after overnight runs stay coherent.

## Is it worth pursuing?

Yes — if you measure the right thing.

Do not measure “smarter than Claude Code.” Measure:

- **Unattended half-life:** how long can `--auto` run before a human *must* touch it, on *your* repos
- **Safe-stop rate:** fraction of bad runs that end in `failed-safe` or `blocked` instead of a dirty tree
- **False-done rate:** Guardian `approve` that you would have rejected
- **Plan-gated start rate:** how often `--auto` is refused and the scaffold was actually useful
- **Token/milestone velocity:** the breaker you already described — spend without progress is the hallucination signature

If those numbers move, this is a real product. If they don’t, Guardian is commentary.

Aider is a git-native pair programmer. Goose is a general MCP agent. Claude Code / Codex are strong doers with emerging review add-ons. Nobody in that set is *primarily* “the human’s attention, automated, for local long runs, with a contract you can pin.” That is still open. Being a solo developer with local models, compression already working, and a transactional workspace is not a limitation here — it is the constraint that forces the right architecture.

Build the Plan Contract and the three gates. Keep the circuit breakers sovereign. Make the Guardian a small, slightly hostile, separate-context stand-in for your attention. Leave federation and multi-model routing for after the first overnight run that you trust enough to sleep through.

That is the concept, perfected. Your gut is pointing at the right hole. Just don’t let Guardian become another doer.