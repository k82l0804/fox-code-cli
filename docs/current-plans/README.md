# Current Plans — Phase 2D: Agent Faultline Benchmark (AFB)

Implementation plans for each task in [current-tasks.md](../master-plan/current-tasks.md).

**Target implementer**: Gemini Flash 3.8 High

**Recommended execution order**: 2D-1 → 2D-2 → 2D-3 → 2D-4 → 2D-5

| Plan | Task | Status |
|------|------|--------|
| [Task 2D-1: Benchmark Infrastructure](2026-09-23T22-41_task-2d-1-benchmark-infrastructure.md) | `rubric.ts`, `runner.ts`, `reporter.ts`, `comparator.ts`, catastrophic failure detection, scripts | ✅ Completed |
| [Task 2D-2: Tier 1–5 Challenges](2026-09-24T04-47_task-2d-2-tier-1-5-challenges.md) | 50 challenges (Sanity, Multi-step, Multi-file, Error Recovery, Adversarial) | ✅ Completed |
| [Task 2D-3: Tier 6–10 Challenges](2026-09-24T05-00_task-2d-3-tier-6-10-challenges.md) | 50 challenges (Long-horizon, Unsafe Autonomy, Guardian+Autonomy, Arbitration, SWE-bench) | ✅ Completed |
| [Task 2D-4: Competitive Evaluation](2026-09-24T06-07_task-2d-4-competitive-evaluation.md) | Multi-agent benchmarking (Fox, Aider, Goose) + reporting | 🔄 In Progress |
| [Task 2D-5: Fox Hardening](2026-09-23T22-09_task-2d-5-fox-hardening.md) | Defect resolution, pass bar iteration (≥70%, beats competitors, zero catastrophic) | ⏳ Pending |
