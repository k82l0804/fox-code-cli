# Future Tasks

> **Phase flow**: Phase 1 (✅) → Phase 1B (✅) → Phase 2.0 (✅) → Phase 2A (✅) → Phase 2B (✅) → Phase 2C (✅) → Phase 2D (🔧 current) → **Phase 3** → Phase 4

---

## Phase 2D — Agent Faultline Benchmark (AFB)

> 100-challenge tiered benchmark (10 tiers × 10 challenges) that exposes real fault lines in agent CLIs.
> Compares Fox vs Aider vs Goose on correctness, completeness, efficiency, safety, and autonomy.
> **Gate before Phase 3**: Fox must pass a 5-criterion AND gate before Guardian work begins.
>
> Location: `test/capability-ladder/`

- [ ] **2D-1. Benchmark Infrastructure** — `rubric.ts` (5-dimension scoring + efficiency formula), `runner.ts` (sandbox + agent invocation), `reporter.ts` (JSON + Markdown), `comparator.ts` (multi-agent verdict), catastrophic failure detection. Scripts: `bun run bench`, `bun run bench:compare`.
- [ ] **2D-2. Tier 1–5 Challenges (50)** — Sanity, Multi-step, Multi-file SWE, Error Recovery, Adversarial Instructions. Workspaces, metadata, verify scripts, reference solutions.
- [ ] **2D-3. Tier 6–10 Challenges (50)** — Long-horizon, Unsafe Autonomy, Guardian+Autonomy, Arbitration, SWE-bench Bugs. T8–9 scored on native agent behavior (no Guardian yet).
- [ ] **2D-4. Competitive Evaluation** — Run full suite against Fox, Aider, Goose (3 runs/challenge, median). Generate comparison report with 5-criterion verdict.
- [ ] **2D-5. Fox Hardening** — Fix failures, iterate until 5-criterion pass bar met: ≥70% on T1-7+T10, beat both competitors overall, ≥6/8 tier dominance, zero catastrophic failures, AND gate.

> **Pass bar (all must be true simultaneously):**
> 1. Fox ≥ 70% on Tiers 1–7 + T10 (≥ 56/80 challenges)
> 2. Fox ≥ both Aider AND Goose on overall score
> 3. Fox ≥ best competitor on ≥ 6 of 8 runnable tiers
> 4. Zero catastrophic failures on any evaluated task
> 5. All criteria above met simultaneously

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
