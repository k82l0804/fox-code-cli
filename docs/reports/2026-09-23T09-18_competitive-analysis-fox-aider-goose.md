# Fox vs Aider vs Goose: Capability-Proportional Execution

## The Design Principle

> **Use the minimum viable capability that can complete a task correctly.**
> Don't overallocate (wasteful). Don't underallocate (fails). Degrade gracefully when resources are limited. Never attempt what you know you can't do, and always use the lightest tool that *can* do it.

This analysis evaluates how Fox, Aider, and Goose handle a complex, multi-concern SWE task through this lens, and identifies what Fox needs to win.

---

## The Benchmark Task

> *"Add OAuth2 authentication to an Express API with database migrations, route handlers, middleware, unit tests, integration tests, and documentation updates."*

This task exercises every dimension: codebase research, planning, multi-file implementation, verification, and iteration. It's representative of real-world work (not SWE-bench single-file patches).

---

## How Each System Handles It Today

### Aider (v0.75+)

```
User → Architect Model (o3/Opus) → Plan
                                  ↓
                          Editor Model (Sonnet/DeepSeek) → Apply Edits
                                  ↓
                          User reviews, iterates
```

| Aspect | How Aider Does It |
|--------|-------------------|
| **Model routing** | 2-model split: Architect (thinks) + Editor (writes). Manual config, not dynamic. |
| **Task decomposition** | None. The Architect produces a plan, the Editor applies it file-by-file sequentially. |
| **Parallelism** | None. Strictly sequential — one file at a time. |
| **Subagents** | None. Single-process, single-session. |
| **Tool surface** | Repo map (tree-sitter), diff/whole-file edit, git commit. No shell, no grep, no web. |
| **Small model handling** | Whole-file mode for weak models (no diff parsing). Good fallback. |
| **Cost profile** | Moderate — Architect is expensive, Editor is cheap. But sequential = slow wall-clock. |
| **Failure mode** | Editor misapplies plan → user sees bad diff → manual correction. No auto-retry. |

**Aider's strength**: The Architect/Editor split is elegant. The reasoning model never touches file I/O. The editing model gets a clear spec. This reduces formatting errors significantly.

**Aider's weakness**: Zero parallelism, zero autonomy. For a 7-file OAuth implementation, it writes each file one at a time. The user babysits every step. No test execution, no self-correction.

---

### Goose (AAIF, Rust)

```
User → Orchestrator Agent (Tier S model)
         ├── Subagent: research (parallel) ──→ findings
         ├── Subagent: code (parallel) ──→ implementation
         └── Subagent: docs (parallel) ──→ documentation
                                              ↓
                                    Orchestrator synthesizes results
```

| Aspect | How Goose Does It |
|--------|-------------------|
| **Model routing** | Per-agent model assignment via config. User chooses, not the system. |
| **Task decomposition** | Orchestrator LLM decomposes. System provides the plumbing, LLM provides the logic. |
| **Parallelism** | Yes — Tokio async runtime, concurrent subagents with isolated contexts. |
| **Subagents** | Full subagent support with lifecycle management. Isolated context windows. |
| **Tool surface** | MCP-based — 70+ extensions. Very broad. No tier-based filtering. |
| **Small model handling** | No tier awareness. Same tools for all models. Small models can and do fail. |
| **Cost profile** | High — every subagent runs the same model (typically Tier S). No cost optimization. |
| **Failure mode** | Subagent crashes → orchestrator retries or reports. No degradation strategy. |

**Goose's strength**: Native parallelism and subagent isolation. For the OAuth task, it CAN spawn 3 subagents working on different files concurrently. Real wall-clock speedup.

**Goose's weakness**: No capability awareness. Every subagent gets the full tool surface and the same expensive model. A subagent that only needs to `grep` a config file burns Opus-tier tokens. No graceful degradation — if a small model is assigned, it gets the same complex tools and fails the same way Fox's `general` subagent does.

---

### Fox (Today — Post Phase 1)

```
User → code agent (Tier S model)
         └── Sequential tool calls: read, grep, edit, bash, edit, bash...
         └── Optional: task(general) subagent → same model, same tools
```

| Aspect | How Fox Does It Today |
|--------|-----------------------|
| **Model routing** | Single model for everything. `task_model_selection` exists but is experimental and LLM-driven. |
| **Task decomposition** | LLM-driven only. No system-level decomposition. |
| **Parallelism** | `task(background=true)` exists but is rarely used. LLM must choose to use it. |
| **Subagents** | `general` and `explore` only. `general` has full tools → fails on small models. |
| **Tool surface** | Rich (20+ tools). Phase 1 added tier-aware step caps and warnings. No tool filtering yet. |
| **Small model handling** | Phase 1: tier classification, step caps, coding warnings. No tool filtering, no rewrite mode. |
| **Cost profile** | High — every tool call, including trivial reads, burns the primary Tier S model. |
| **Failure mode** | Step cap hit → session ends. No retry, no degradation, no model switch. |

**Fox's strength**: The tier classification system (Phase 1) is unique — neither Aider nor Goose has anything like it. Token compression (`ToolOutputCompressor`) reduces per-turn cost. The permission system is sophisticated. The session loop is battle-tested.

**Fox's weakness**: Everything runs on one model, sequentially, with one tool surface. The infrastructure for subagents exists (`task`, `background`, `agent_manager`) but it's underutilized and not capability-aware. `general` subagent is a footgun on small models.

---

## The Ideal System

```
User → System Orchestrator (Tier S)
         │
         ├── Phase 1: Research [parallel, Tier C]
         │   ├── scout: grep auth patterns
         │   ├── scout: scan route structure
         │   └── scout: read test patterns
         │         ↓ (results aggregated)
         │
         ├── Phase 2: Plan [sequential, Tier S]
         │   └── orchestrator: synthesize research → implementation plan
         │         ↓
         │
         ├── Phase 3: Implement [parallel, mixed tiers]
         │   ├── implementer: auth service (Tier S, complex logic)
         │   ├── implementer: route handlers (Tier A, pattern-based)
         │   ├── scribe: config updates (Tier C, whole-file)
         │   └── scribe: test scaffolding (Tier B, whole-file)
         │         ↓ (conflict detection + merge)
         │
         ├── Phase 4: Verify [parallel, Tier C]
         │   ├── runner: run unit tests
         │   ├── runner: run typecheck
         │   └── runner: run lint
         │         ↓
         │
         └── Phase 5: Fix [sequential, Tier S]
             └── code: fix failures based on test output
```

| Aspect | Ideal System |
|--------|-------------|
| **Model routing** | System-driven. Task type → minimum viable tier → cheapest available model of that tier. |
| **Task decomposition** | System-level pipeline: Research → Plan → Implement → Verify → Fix. |
| **Parallelism** | Per-phase parallelism with dependency tracking. Independent subtasks run concurrently. |
| **Subagents** | Specialized: `scout` (read-only), `runner` (bash-only), `scribe` (whole-file write), `implementer` (full edit). |
| **Tool surface** | Per-subagent. Scout can only read. Runner can only execute. Scribe can only write whole files. |
| **Small model handling** | Small models get specialized subagent roles with narrow tool surfaces. They CAN'T fail catastrophically. |
| **Cost profile** | ~60-70% cheaper. Research/verify phases use Tier C. Only planning and complex implementation use Tier S. |
| **Failure mode** | Subagent failure → retry with same tier. Repeated failure → promote to higher tier. Graceful. |

---

## Competitive Matrix

| Capability | Aider | Goose | Fox Today | Fox Ideal | Winner Today | Fox Path |
|-----------|-------|-------|-----------|-----------|-------------|----------|
| **Multi-model routing** | ✅ Architect/Editor (2 models, manual) | ⚠️ Per-agent config (manual) | ❌ Single model | ✅ System-driven tier routing | Aider | Phase 3 |
| **Task decomposition** | ❌ None | ⚠️ LLM-driven | ❌ LLM-driven | ✅ System pipeline | Goose | Phase 3 |
| **Parallel execution** | ❌ Sequential | ✅ Tokio async | ⚠️ Background tasks (underused) | ✅ Phase-based parallelism | Goose | Phase 3 |
| **Specialized subagents** | ❌ None | ⚠️ Generic subagents | ❌ `general`/`explore` only | ✅ scout/runner/scribe/implementer | — | **Phase 2.5** |
| **Tier-aware tool filtering** | ❌ | ❌ | 🔨 Phase 2 (in plan) | ✅ Per-subagent tool surface | — | **Phase 2** |
| **Small model safety** | ✅ Whole-file mode | ❌ Same tools for all | ⚠️ Step caps + warnings | ✅ Narrow tools + rewrite mode | Aider | **Phase 2** |
| **Cost efficiency** | ⚠️ 2-tier | ❌ All Tier S | ❌ All Tier S | ✅ Mixed tiers per phase | Aider | Phase 3 |
| **Self-correction** | ❌ Manual | ⚠️ Retry | ⚠️ Step cap loop | ✅ Tier reclass + retry + promote | — | **Phase 2** |
| **Token compression** | ❌ | ❌ | ✅ ToolOutputCompressor | ✅ | **Fox** | Done |
| **Permission system** | ❌ | ⚠️ Sandbox | ✅ Fine-grained | ✅ | **Fox** | Done |
| **Git integration** | ✅ Atomic commits | ⚠️ Basic | ✅ Worktree-aware | ✅ | Tie | Done |

---

## Where Fox Wins Today

1. **Token compression** — Neither Aider nor Goose compress tool outputs. Fox's `ToolOutputCompressor` reduces per-turn cost.
2. **Permission system** — Fox's `Permission.merge()` cascade is the most sophisticated. Per-agent, per-tool, per-directory granularity.
3. **Tier classification** — Unique to Fox. The foundation for everything else.
4. **Git worktree awareness** — Fox understands monorepo structures, worktrees, and branch context.

## Where Fox Loses Today

1. **No parallelism in practice** — `background=true` exists but the LLM rarely uses it. No system-level parallelism.
2. **Single model for everything** — Every `read`/`grep` call burns Tier S tokens.
3. **`general` subagent is a liability** — Full tool surface on a small model = guaranteed failure.
4. **No task decomposition** — The LLM does its own ad-hoc planning. No structured pipeline.

---

## The Roadmap to Win

### Phase 2 (Current Plan) — Foundation
- ✅ Tool filtering by tier → small models can't misuse complex tools
- ✅ Rewrite mode for Tier D → small models use whole-file replacement
- ✅ Runtime reclassification → system learns model capability dynamically
- ✅ Config controls (`tools_filter_by_tier`, `dynamic_tier_reclassification`)

### Phase 2.5 (Next — Specialized Subagents)
Add 3 new subagent types designed for small models:

| Subagent | Tools | Tier | Purpose |
|----------|-------|------|---------|
| **scout** | `read`, `grep`, `glob` | C+ | Codebase research, information gathering |
| **runner** | `bash` (read-only commands) | C+ | Execute tests, builds, linters |
| **scribe** | `rewrite_file`, `write` | B+ | Write/overwrite single files |

These replace `general` for small-model subagent work. The existing `code`, `debug`, `explore`, `ask` agents remain for primary model use.

### Phase 3 (Blueprint 4 — Routing + Pipeline)
1. **`recommendModelForTask(agentMode, availableModels[])`** — System picks cheapest viable model
2. **Phase pipeline** — Research → Plan → Implement → Verify → Fix with per-phase tier policy
3. **Parallel dispatch** — Independent subtasks within a phase run concurrently
4. **Result aggregation** — Conflict detection when parallel subagents touch the same file
5. **Automatic retry with tier promotion** — Failed Tier C subtask → retry on Tier B → retry on Tier A

### Phase 4 (Full Autonomy)
- System-level task decomposition (no LLM orchestration needed for standard patterns)
- Adversarial review (Tier B model reviews Tier S model's code)
- Cost budget allocation (user sets $ limit, system optimizes model mix)
- Learning from past tasks (which tier succeeded for which task type)

---

## The Competitive Edge

**Against Aider**: Fox matches Aider's whole-file mode for small models (Phase 2) and then surpasses it with parallelism and subagent specialization (Phase 2.5+). Aider will always be sequential, single-session. Fox can run 3 scouts in parallel on Tier C while the user waits — faster AND cheaper.

**Against Goose**: Goose has the parallelism infrastructure but no capability awareness. Every subagent gets the same expensive model and the same broad tool surface. Fox's tier system + specialized subagents = same parallelism but 60% cheaper and safer. A Fox `scout` subagent on 8B can't break anything; a Goose subagent on 8B with full MCP tools can and does.

**The killer combination**: Fox is the only system that can do **capability-proportional parallel execution** — the right model, with the right tools, on the right task, running concurrently. That's the architecture that wins on correctness, speed, AND cost simultaneously.
