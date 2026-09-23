# Future Tasks

> **Phase flow**: Phase 1 (✅) → Phase 1B (✅) → Phase 2.0 (✅) → Phase 2A (🔧 current) → **Phase 2B** → Phase 2C → Phase 3 → Phase 4

---

## Phase 2B — Model Intelligence

> Tier-aware tool surfaces, small model safety, and specialized subagents.
> Builds on the [Model Capability Tier System](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/model-tier.ts) (Phase 1 complete: 94 tests, `resolveTier()` cascade, step capping).

- [ ] **7. Whole-File Rewrite Mode (Tier D)** — New `rewrite_file` tool for tiny models. No diff, no hunk parsing — full-file overwrite. Deliberately simple so small models can write code without failing on edit schemas.
- [ ] **8. Tool Surface Filtering by Tier** — Hide complex tools (`task`, `write`, `edit`, `apply_patch`, `skill`) from Tier C/D models. Only safe single-invocation tools remain. Config: `tools_filter_by_tier: true` (default). The `general` subagent stops being a liability.
- [ ] **9. Runtime Tier Reclassification** — Promote C→B on first successful tool call. Demote B→C after 2 consecutive failures. Only C↔B transitions. Per-session, not persisted. Config: `dynamic_tier_reclassification: true` (default).
- [ ] **10. Specialized Subagents** — Replace the failing `general` subagent with 3 purpose-built agents for small models:

  | Subagent | Tools | Min Tier | Purpose |
  |----------|-------|----------|---------|
  | **scout** | `read`, `grep`, `glob` | C | Read-only codebase research |
  | **runner** | `bash` (read-only commands) | C | Execute tests, builds, linters |
  | **scribe** | `rewrite_file`, `write` | B | Write/overwrite single files |

  The LLM picks the right subagent for the task. Existing agents (`code`, `debug`, `explore`, `ask`) remain for primary model use.

---

## Phase 2C — Routing & Refinement

> System-driven model selection and quality-of-life improvements.

- [ ] **11. System-Driven Model Routing** — `recommendModelForTask(agentMode, availableModels[])` — system picks cheapest viable model for each subtask. Tier-based: research on Tier C, planning on Tier A/S, implementation on Tier B+.
- [ ] **12. Blast-Radius Regression Detection (3b)** — Baseline test tracking to distinguish "I broke this" from "this was already broken." Structured input for future Guardian.
- [ ] **13. LSP Confidence Scoring (6a)** — Language-aware edit confidence. The parity matrix shows AST/symbol index as a top gap.
- [ ] **14. Repo-Level Intent Detection** — Classify task scope and blast radius from the goal description before planning.

---

## Phase 3 — Guardian (Autonomy Intelligence Layer)

> The dual-agent oversight system. Needed for `--auto` / headless / `/goal` modes.
> Depends on Phase 2 foundation being in place.

### Phase 3A — Guardian Core

- [ ] **15. Guardian Agent (Phase A)** — Dual-agent oversight layer in `processor.ts`:
  - **Intake Gatekeeper**: "Autonomy is a request, not a guarantee." Classifies incoming tasks (Structured Plan, Atomic/Safe, Ambiguous/Risky). If ambiguous, generates **Assisted Scaffold** with `[REQUIRED]` tags.
  - **Tool Profiles (`--tools=<profile>`)**: Replaces `--yolo` with explicit capability envelopes (`basic`, `write`, `system`, `dangerous`, `custom`).
  - **Command Triad**: `/plan` (blueprint), `/refine` (sharpener), `/verify` (pre-flight + post-flight), `/enhance` (fast chat rephrasing).
  - **Runtime Oversight**: Post-failure classification, pre-commit review gate, progress checks every N turns. Closes P5, P6, P8 in reference architecture.
- [ ] **16. Multi-Model Routing (LLM-based)** — Guardian classifies failure types and recommends model tier changes. Complements the deterministic routing from Phase 2C.

### Phase 3B — Task Decomposition

- [ ] **17. Guardian Phase B — Task Decomposition** — Guardian owns goal decomposition into task graphs with dependencies and acceptance criteria. Extends `todowrite` with status tracking and task supersession.

### Phase 3C — Multi-Worker

- [ ] **18. Guardian Phase C — Multi-Worker** — Multiple doer sessions executing tasks in parallel, Guardian managing load balancing, branch isolation, and result aggregation.

---

## Phase 4 — Architecture, Security & UX

> Infrastructure hardening, sandboxing, and long-horizon features.

- [ ] **19. OS-Level Sandboxing (BP 10)** — Container/sandbox isolation for agent execution. Mutations happen in isolated environments, not the user's working tree.
- [ ] **20. MCP Sidecar Security (BP 8)** — Secure MCP tool execution with capability-scoped permissions and audit logging.
- [ ] **21. Long-Horizon Project Memory (BP 7)** — Persistent memory across sessions for ongoing projects. The agent remembers prior context, decisions, and established patterns.
- [ ] **22. Snapshot ↔ Oscillation Integration (3d)** — Layer snapshot tracking into oscillation detection without coupling it into the core loop.
- [ ] **23. Mini-TUI Decoupling** — Extract the TUI into a standalone package for embedding in other tools.
- [ ] **24. ACP Multi-Root & Diff Cards** — VS Code extension support for multi-root workspaces and visual diff review.
- [ ] **25. Cross-Session Checklist State Machine** — Persist task checklists across sessions with state tracking.
- [ ] **26. TUI Live Telemetry Dashboard (BP 13)** — Real-time token usage, cost, and performance metrics in the TUI.
