# Fox CLI — Competitive Features Roadmap

> **Status**: Revised 2026-09-23. Phases 1B and 2.0 complete.
> Phase 2 now consolidates **all foundation work** — infrastructure, model
> intelligence, subagents, routing, and performance. Guardian pushed to Phase 3.
> Phase 4 covers architecture, security, and long-horizon features.
>
> **Design principle**: *Build everything that makes Fox better for every user
> in every session before building the autonomy layer.* The Guardian depends on
> this foundation — better verification, smarter context, specialized subagents,
> and tier-aware routing all feed the Guardian when it's built.
>
> **References**:
> - [Reference Architecture](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/future/2026-09-22T15-16_autonomous-agent-workflow.md)
> - [Guardian Design](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/future/2026-09-22T15-16_autonomous-dual-agent-design.md)
> - [Challenge Ladder](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/2026-09-22T15-54_fox-challenge-ladder-report.md)
> - [Competitive Analysis](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/reports/2026-09-23T10-07_competitive-analysis-product-features.md)

---

## Strategic Risks

#### **1. ~~Phase 2 Has Too Many "Core" Items~~** → ✅ RESOLVED
Phase 2 is organized into three sub-phases: **2A (Core Infrastructure)**, **2B (Model Intelligence & Subagents)**, **2C (Routing & Refinement)**. All are foundation work — no autonomy-layer dependencies.

#### **2. Regression Detection Requires Careful Test Baseline Management**
Baseline invalidation rules (refresh timing, flaky tests, nondeterministic output) must be explicit. The guardian can classify regressions from compressed test output without a formal baseline, but structured baseline tracking provides better signal.

#### **3. ~~Multi‑Model Routing Needs Guardrails~~** → Phase 2C
System-driven model routing (`recommendModelForTask`) replaces the old Blueprint 4 state machine. Deterministic tier-based routing first; the Guardian adds LLM-based routing decisions later.

#### **4. Snapshot ↔ Oscillation Integration Is Non‑Trivial**
Oscillation detection is pure and stateless. Snapshot integration requires careful layering to avoid coupling into the core loop. Deferred to Phase 4 refinement.

---

## 🧭 Phases (Revised 2026-09-23)

### ✅ **Phase 1B — Compression Hardening** → COMPLETE (2026-09-22)

> Challenge Ladder: **334/334 (100.0%)**. All 6 items resolved.
> Suite expanded from 300 → 334 fixtures. 3 bugs found and fixed.

1. ~~**GitOps Preservation Rule**~~ → ✅ Done
2. ~~**Stability Fixes**~~ → ✅ Done
3. ~~**GAIA Keyword Fix**~~ → ✅ Done
4. ~~**Score Tracking Infrastructure**~~ → ✅ Done (`tools/challenge-snapshot.ts` + `docs/challenge-history/`)
5. ~~**CI Gate for Challenge Score**~~ → ✅ Done (`test:challenge` in `package.json`)
6. ~~**Heuristic Workload Classification (BP 12)**~~ → ✅ Done (delivered as Phase 2.0 Adaptive Compression)

### ✅ **Phase 2.0 — Adaptive Compression** → COMPLETE (2026-09-22)

> Content classifier + 3 new risk-gated transforms. Token savings: **15.8% → 19.1%** (+3.3pp).
> 279 smoke tests pass. Zero regressions. Sub-millisecond overhead.

1. ~~**Content Classifier (`compression-levels.ts`)**~~ → ✅ Done
2. ~~**Timestamp Stripping (Level 1)**~~ → ✅ Done
3. ~~**Boilerplate Header Stripping (Level 1)**~~ → ✅ Done
4. ~~**Repeated Pattern Collapsing (Level 2)**~~ → ✅ Done
5. ~~**Pipeline Integration + Safety Rails**~~ → ✅ Done
6. ~~**Guardian-Ready Interface (`CompressionPolicyOverride`)**~~ → ✅ Done

---

### 🔺 **Phase 2 — Foundation** ← CURRENT PRIORITY

> Everything that makes Fox better for **every user, every session**.
> No autonomy/Guardian dependencies. Organized into three sub-phases.

#### **Phase 2A — Core Infrastructure**

> Verification, context management, commits, and performance.

1. **Multi-Command Auto-Verification Pipeline (3a)** — Extend `verification.ts` to run typecheck → tests → lint as a configurable sequence. Today Fox runs only the single best-priority command. Multi-command gives the LLM richer feedback per edit cycle. Subsumes Auto-Lint (3c).
2. **Turn-Supersession Context Pruning** — Extend `supersede.ts` to cover more stale context patterns. Keeps long sessions lean and the model sharp. Mechanical — no LLM intelligence required.
3. **Dynamic Context Window Discovery (4b)** — Query model/provider for actual context limits. Feed into compaction thresholds for proactive overflow prevention instead of reactive recovery.
4. **Atomic Task-Completion Commits** — Platform-level commit flow with generated messages, metadata, and optional walkthrough — replacing ad-hoc `git commit` via bash. Useful in interactive mode ("fox, commit what you just did").
5. **Paginated Message Loading (11.2)** — Performance: loading large sessions is slow today. Every user benefits.
6. **JSON Serialization Bypass (11.3)** — Performance: reduces serialization overhead. Every user benefits.

#### **Phase 2B — Model Intelligence**

> Tier-aware tool surfaces, small model safety, and specialized subagents.
> Builds on the [Model Capability Tier System](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/model-tier.ts) (Phase 1 complete: 94 tests, `resolveTier()` cascade, step capping).

7. **Whole-File Rewrite Mode (Tier D)** — New `rewrite_file` tool for tiny models. No diff, no hunk parsing — full-file overwrite. Deliberately simple so small models can write code without failing on edit schemas.
8. **Tool Surface Filtering by Tier** — Hide complex tools (`task`, `write`, `edit`, `apply_patch`, `skill`) from Tier C/D models. Only safe single-invocation tools remain. Config: `tools_filter_by_tier: true` (default). The `general` subagent stops being a liability.
9. **Runtime Tier Reclassification** — Promote C→B on first successful tool call. Demote B→C after 2 consecutive failures. Only C↔B transitions. Per-session, not persisted. Config: `dynamic_tier_reclassification: true` (default).
10. **Specialized Subagents** — Replace the failing `general` subagent with 3 purpose-built agents for small models:

    | Subagent | Tools | Min Tier | Purpose |
    |----------|-------|----------|---------|
    | **scout** | `read`, `grep`, `glob` | C | Read-only codebase research |
    | **runner** | `bash` (read-only commands) | C | Execute tests, builds, linters |
    | **scribe** | `rewrite_file`, `write` | B | Write/overwrite single files |

    The LLM picks the right subagent for the task. Existing agents (`code`, `debug`, `explore`, `ask`) remain for primary model use.

#### **Phase 2C — Routing & Refinement**

> System-driven model selection and quality-of-life improvements.

11. **System-Driven Model Routing** — `recommendModelForTask(agentMode, availableModels[])` — system picks cheapest viable model for each subtask. Tier-based: research on Tier C, planning on Tier A/S, implementation on Tier B+.
12. **Blast-Radius Regression Detection (3b)** — Baseline test tracking to distinguish "I broke this" from "this was already broken." Structured input for future Guardian.
13. **LSP Confidence Scoring (6a)** — Language-aware edit confidence. The parity matrix shows AST/symbol index as a top gap.
14. **Repo-Level Intent Detection** — Classify task scope and blast radius from the goal description before planning.

---

### 🔸 **Phase 3 — Guardian (Autonomy Intelligence Layer)**

> The dual-agent oversight system. Needed for `--auto` / headless / `/goal` modes.
> Depends on Phase 2 foundation being in place.

#### Phase 3A — Guardian Core

15. **Guardian Agent (Phase A)** — Dual-agent oversight layer in `processor.ts`:
    - **Intake Gatekeeper**: "Autonomy is a request, not a guarantee." Classifies incoming tasks (Structured Plan, Atomic/Safe, Ambiguous/Risky). If ambiguous, generates **Assisted Scaffold** with `[REQUIRED]` tags.
    - **Tool Profiles (`--tools=<profile>`)**: Replaces `--yolo` with explicit capability envelopes (`basic`, `write`, `system`, `dangerous`, `custom`).
    - **Command Triad**: `/plan` (blueprint), `/refine` (sharpener), `/verify` (pre-flight + post-flight), `/enhance` (fast chat rephrasing).
    - **Runtime Oversight**: Post-failure classification, pre-commit review gate, progress checks every N turns. Closes P5, P6, P8 in reference architecture.
16. **Multi-Model Routing (LLM-based)** — Guardian classifies failure types and recommends model tier changes. Complements the deterministic routing from Phase 2C.

#### Phase 3B — Task Decomposition

17. **Guardian Phase B — Task Decomposition** — Guardian owns goal decomposition into task graphs with dependencies and acceptance criteria. Extends `todowrite` with status tracking and task supersession.

#### Phase 3C — Multi-Worker

18. **Guardian Phase C — Multi-Worker** — Multiple doer sessions executing tasks in parallel, Guardian managing load balancing, branch isolation, and result aggregation.

---

### 🔹 **Phase 4 — Architecture, Security & UX**

> Infrastructure hardening, sandboxing, and long-horizon features.

19. **OS-Level Sandboxing (BP 10)** — Container/sandbox isolation for agent execution. Mutations happen in isolated environments, not the user's working tree.
20. **MCP Sidecar Security (BP 8)** — Secure MCP tool execution with capability-scoped permissions and audit logging.
21. **Long-Horizon Project Memory (BP 7)** — Persistent memory across sessions for ongoing projects. The agent remembers prior context, decisions, and established patterns.
22. **Snapshot ↔ Oscillation Integration (3d)** — Layer snapshot tracking into oscillation detection without coupling it into the core loop.
23. **Mini-TUI Decoupling** — Extract the TUI into a standalone package for embedding in other tools.
24. **ACP Multi-Root & Diff Cards** — VS Code extension support for multi-root workspaces and visual diff review.
25. **Cross-Session Checklist State Machine** — Persist task checklists across sessions with state tracking.
26. **TUI Live Telemetry Dashboard (BP 13)** — Real-time token usage, cost, and performance metrics in the TUI.

---

### Phase 1 Remaining (Status: Complete in CLI)

- ~~**Named Shadow Checkpoints & /undo**~~ → ✅ **COMPLETE** (`packages/core/src/checkpoint.ts`, `fox checkpoint list/create/undo/diff`).
- ~~**Local Model Profiles & Prompts Matrix**~~ → ✅ **COMPLETE** (`model-profiles.json`, `--profile` flag, non-Chinese open weights: Llama 3.1/3.3, Codestral/Mistral, Gemma 2/4, Nemotron, GPT-OSS).
- **ACP Metadata Debounce & Batching** — Deferred to companion `fox-acp-client` VS Code extension repository. Does not block CLI.

---

## 🧱 Summary

Phase 1B and Phase 2.0 are complete. Fox's compression is **100% correct**
across 334 fixtures with **19.1% token savings**.

**Phase 2 (Foundation)** is the current priority — everything that makes Fox
better for daily use: multi-command verification, model intelligence (tier
filtering, rewrite mode, specialized subagents), system-driven routing, and
performance. This is the **largest phase** because it's the most impactful
for every user.

**Phase 3 (Guardian)** builds on Foundation to add the autonomy intelligence
layer — the dual-agent oversight system for `--auto` and headless operation.

**Phase 4 (Architecture)** hardens the platform with sandboxing, security,
persistent memory, and UX improvements.

```
Phase 1 (✅) → Phase 1B (✅) → Phase 2.0 (✅) → Phase 2 (Foundation) 🔧 → Phase 3 (Guardian) → Phase 4 (Architecture)
```
