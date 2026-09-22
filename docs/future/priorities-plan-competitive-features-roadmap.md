### 🟡 **What Needs Attention (Not Problems — Just Strategic Risks)**

> **Status**: Reconciled as of 2026-09-22. Revised to incorporate the Guardian Agent
> concept from [`autonomous-dual-agent-design.md`](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/future/autonomous-dual-agent-design.md).
> Multi-Model Routing (BP 4) demoted from Tier 1 — the guardian subsumes
> deterministic routing decisions with flexible LLM-based reasoning.

#### **1. ~~Phase 2 Has Too Many "Core" Items~~** → ✅ RESOLVED
Phase 2 has been split into **Phase 2A (Autonomy Core)** and **Phase 2B (Refinement & Performance)**.

Phase 2A contains only the items that complete the autonomous closed loop.
Phase 2B contains items that improve speed, quality, and UX but don't block autonomy.

#### **2. Regression Detection Requires Careful Test Baseline Management**
The document says:

> "Baseline snapshot: ~50 tokens (stored in-memory, not sent to model)."  

This is correct — but baseline invalidation rules must be explicit:

- When do you refresh the baseline?  
- How do you handle flaky tests?  
- How do you handle test suites with nondeterministic output?

This blueprint is deceptively complex.

> **Captured in roadmap**: Demoted to Tier 2. The guardian can classify regressions
> from compressed test output without a formal baseline-tracking system. Baseline
> tracking becomes a refinement that provides structured input to the guardian.

#### **3. ~~Multi‑Model Routing Needs Guardrails~~** → Subsumed by Guardian
The deterministic routing state machine (Blueprint 4) is **subsumed by the
guardian agent**. The guardian classifies failure types and recommends model
tier changes with more flexibility than hard-coded escalation rules.

If the guardian proves insufficient for routing, deterministic fallbacks
can be added in Tier 2 as a complement.

> **Captured in roadmap**: Demoted from Tier 1 to Tier 2.

#### **4. Snapshot ↔ Oscillation Integration Is Non‑Trivial**
The document warns:

> "Oscillation detection is intentionally pure and stateless… integrating snapshots requires careful layering."  

This is a correct concern. You must avoid coupling snapshot logic into the core loop.

> **Captured in roadmap**: Remains in Tier 2. Oscillation detector works standalone;
> the guardian adds semantic oscillation detection on top; snapshot integration
> is a refinement.

---

## 🧭 Priority Tiers (Revised 2026-09-22)

Based on the [reference architecture](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/future/autonomous-agent-workflow.md), the [dual-agent design](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/future/autonomous-dual-agent-design.md), and the [Challenge Ladder results](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/fox-challenge-ladder-report.md):

### 🔴 **Phase 1B — Compression Hardening (NEW — Blocks Phase 2A)**

> Added 2026-09-22 based on Challenge Ladder results (287.4/300, 95.8%).
> Must complete before Phase 2A because the autonomous loop generates
> multi-step traces that need correct compression. Target: 298+/300.

1. **GitOps Preservation Rule** — Protect branch names, commit messages, author/date lines in multi-step traces. Reduces gitops-workflows over-compression from 94.3% to safe levels. (+9.5 pts)
2. **Stability Fixes** — Fix non-deterministic compression in `test-t1-02` and `diff-t1-08`. Likely Set/Map iteration order or threshold edge cases. (+2.0 pts)
3. **GAIA Keyword Fix** — Fix `gaia-t4-09` where "checkout" is stripped by a compression rule. (+1.0 pt)
4. **Score Tracking Infrastructure** — `tools/fox-challenge-scoreboard.ts`, JSON results to `docs/challenge-history/`.
5. **CI Gate for Challenge Score** — Add `test:challenge` to CI with minimum score ≥285.
6. **Heuristic Workload Classification (BP 12)** — *Promoted from Tier 2.* Challenge Ladder shows 0% compression on most Tier 3/4 content. Better classification unlocks safe compression on more content types.

### 🔺 **Tier 1 — Autonomy Core (Phase 2A)**

> These complete the autonomous closed loop AND add the guardian intelligence layer.

1. **Auto-Verification Pipeline (3a)** — Workflow Step 4. **Highest priority.** The foundation — the guardian needs verification results to reason about.
2. **Guardian Agent (Phase A)** — **NEW.** Dual-agent oversight layer in `processor.ts`:
   - **Intake Gatekeeper**: "Autonomy is a request, not a guarantee." Classifies incoming tasks (Structured Plan, Atomic/Safe, Ambiguous/Risky). If ambiguous, generates **Assisted Scaffold** with `[REQUIRED]` tags.
   - **Tool Profiles (`--tools=<profile>`)**: Replaces dangerous `--yolo` with explicit capability envelopes (`basic`, `write`, `system`, `dangerous`, `custom`).
   - **Command Triad**: Adds `/plan` (blueprint), `/refine` (sharpener), `/verify` (pre-flight audit & post-flight acceptance) across all agents, plus `/enhance` for fast chat rephrasing.
   - **Runtime Oversight**: Post-failure classification, pre-commit review gate, and progress checks. Enabled by default; falls back to doer's model if no guardian model is specified. Closes P5, P6, P8 in reference architecture.
3. **Turn-Supersession Context Pruning** — Workflow Step 7. Mechanical — guardian doesn't replace this.
4. **Atomic Task-Completion Commits** — Workflow Step 8. Mechanical — guardian triggers the commit gate but commit mechanics are still needed.
5. **Dynamic Context Window Discovery (4b)** — Infrastructure dependency.

**Changes from previous revision:**
- **Added**: Phase 1B (blocks Phase 2A)
- **Promoted**: BP12 (Workload Classification) from Tier 2 → Phase 1B.6

### 🔸 **Tier 2 — Refinement & Performance (Phase 2B)**

6. **Multi-Model Routing (4)** — *Demoted from Tier 1.* Deterministic fallback/complement to guardian routing decisions.
7. **Blast-Radius Regression Detection (3b)** — *Demoted from Tier 1.* Structured input to guardian, not a prerequisite.
8. **Auto-Lint (3c)**
9. **Snapshot ↔ Oscillation (3d)**
10. **Paginated Message Loading (11.2)**
11. **JSON Serialization Bypass (11.3)**
12. **LSP Confidence Scoring (6a)**
13. **Repo-Level Intent Detection**
14. ~~**Heuristic Workload Classification (BP 12)**~~ — *Promoted to Phase 1B.6*
15. **TUI Live Telemetry Dashboard (BP 13)**

### 🔹 **Tier 3 — Architecture & UX (Phase 3)**

16. **Guardian Phase B — Task Decomposition** — Guardian owns goal decomposition into task graphs with dependencies and acceptance criteria. Extends `todowrite`.
17. **OS-Level Sandboxing (BP 10)**
18. **MCP Sidecar Security (BP 8)**
19. **Long-Horizon Project Memory (BP 7)**
20. **Mini-TUI Decoupling**
21. **ACP Multi-Root & Diff Cards**
22. **Cross-Session Checklist State Machine**

### 🔮 **Tier 4 — Future Vision**

23. **Guardian Phase C — Multi-Worker** — Multiple doer sessions executing tasks in parallel, guardian managing load balancing.

---

## 🧱 Final Verdict

The plan is tighter with Phase 1B. The Challenge Ladder proved that Fox's
compression is 95.8% correct, but the autonomous loop (Phase 2A) will generate
exactly the kind of multi-step traces where the remaining 4.2% matters.

Fixing compression *before* building autonomy on top of it avoids debugging
compression issues through the autonomy layer. Phase 1B is ~1 day of work
and removes the single biggest risk from Phase 2A's success.

The revised flow:
```
Phase 1 (✅ Done) → Phase 1B (Compression) → Phase 2A (Autonomy) → Phase 2B → Phase 3
```

