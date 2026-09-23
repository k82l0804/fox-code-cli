# Future Tasks

> **Phase flow**: Phase 1 (✅) → Phase 1B (✅) → Phase 2.0 (✅) → Phase 2A (✅) → Phase 2B (✅) → Phase 2C (🔧 current) → **Phase 3** → Phase 4

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
