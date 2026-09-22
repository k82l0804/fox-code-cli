**The ideal workflow for an autonomous software (SW) agent is a *spec-driven, gated, iterative loop* that treats a high-quality specification as the single source of truth.**

This approach has become the dominant pattern among teams shipping reliable agentic coding systems (GitHub’s internal analysis of 2,500+ agent configs, Addy Osmani’s work, Anthropic’s agent design principles, and multiple production playbooks all converge on variants of it).

### Core Principles
- **Spec is king** — Code is temporary; the specification is permanent and version-controlled.
- **Small, verifiable units of work** — Prefer many tight, independently testable tasks over large open-ended ones.
- **Tight feedback loops** — Tests, linters, builds, and acceptance criteria act as the primary “oracle.”
- **Human ownership of the outer loop** — Humans set intent, approve plans, and gate high-risk actions; the agent owns the inner loop.
- **Explicit boundaries** — Always / Ask-first / Never rules prevent the agent from wandering.
- **Observability & auditability** — Every step produces structured artifacts (plans, diffs, test results, decision logs).

### Ideal End-to-End Workflow

```text
1. Intent / Requirements Capture
2. Specify          ← human + agent co-create living spec
3. Plan             ← agent produces technical plan + task breakdown
4. Tasks            ← small, ordered, independently testable units
5. Implement        ← agent executes one task at a time
6. Verify           ← automated tests + self-checks + acceptance criteria
7. Review           ← human or specialized review agent
8. Iterate / Refactor
9. Ship / Commit
```

You only advance to the next major phase after the current one is validated. This prevents the common “house-of-cards” failure mode.

#### Phase Details

| Phase | Primary Owner | Key Artifacts | Success Criteria |
|-------|---------------|---------------|------------------|
| **Specify** | Human + Agent | Spec document (Markdown / structured) | Clear objective, behaviors, constraints, acceptance criteria, boundaries |
| **Plan** | Agent (reviewed by human) | Technical plan, architecture notes, file-level changes | Plan is complete, consistent with constraints, and reviewable |
| **Tasks** | Agent | Ordered list of small tasks (15–45 min of agent work each) | Each task has explicit inputs, outputs, and testable acceptance criteria |
| **Implement** | Agent | Code + tests + docs | Task passes its own tests and does not violate boundaries |
| **Verify** | Agent + CI | Test results, coverage, lint, build | All automated checks green; acceptance criteria met |
| **Review** | Human or specialized agent | Diff review, security/UX notes | Human (or high-confidence review agent) signs off |
| **Ship** | Agent (gated) | Commit / PR | Clean history, updated spec if needed |

### Ideal Spec Structure (the document the agent actually consumes)

A high-performing agent spec is **not** a traditional PRD. It is a focused, executable brief. The most effective ones cover these areas (often called the SCOPE method or the six core areas from GitHub’s research):

1. **Clear Objective** — One-sentence statement of what must be produced.
2. **Behavioral Description** — How the feature/system should behave from the user’s or system’s perspective (inputs → outputs → side effects).
3. **Constraints & Boundaries**
   - Files / modules that are off-limits
   - Patterns that must / must not be used
   - Always / Ask-first / Never rules
4. **Integration Points** — Exact places the new work must connect to existing systems.
5. **Project Conventions**
   - Directory structure
   - Code style (prefer real snippets over prose)
   - Testing commands and coverage targets
   - Git workflow (branch naming, commit format, PR rules)
6. **Phases & Dependencies** — Ordered stages (Foundation → Core logic → Interface → Polish).
7. **Examples & Test Cases** — Concrete sample inputs/outputs or test expectations.
8. **Acceptance Criteria** — Explicit, machine-checkable pass/fail conditions.
9. **Self-checks** — Instructions for the agent to verify its own work before declaring done.

Keep individual task specs short and focused (one well-written page is often ideal). Large features are broken into hierarchical epics → features → stories → tasks.

### Supporting Architecture Elements for High Autonomy
- **Isolated execution environment** (container, sandbox, or dedicated worktree).
- **Strong tool interface** (file read/write, shell, test runner, git, search) with clear documentation.
- **Memory / context management** — Persistent project memory (e.g., `AGENTS.md`, CLAUDE.md, ADRs) + short-term task context.
- **Deterministic outer orchestration** — Prefer a reliable orchestrator for admission, context hydration, pre-flight checks, and finalization; only the core reasoning step is fully agentic.
- **Multi-agent specialization** (optional but powerful) — Architect, Implementer, Tester, Reviewer, Security agents with strict handoff contracts.
- **Guardrails** — Token budgets, step limits, irreversible-action gates, and human escalation paths.

### Practical Tips for Maximum Reliability
- Start with a high-level vision and let the agent expand it into a detailed spec (then critically review).
- Prefer tests-first or acceptance-criteria-first within each task.
- Make the agent produce a short plan *before* editing code on non-trivial tasks.
- Treat the spec as a living document — update it when requirements change rather than fighting the agent with ad-hoc prompts.
- Measure success by goal achievement + test pass rate, not just “code looks plausible.”

This workflow balances autonomy with control. Fully open-ended agents without a strong spec and verification harness tend to drift, while pure deterministic pipelines lack the flexibility needed for real software work. The gated, spec-centric loop currently offers the best practical trade-off for production use.