### 🟡 **What Needs Attention (Not Problems — Just Strategic Risks)**

> **Status**: Reconciled as of 2026-09-22. Phase 1B and Phase 2.0 now complete.
> Revised to incorporate the Guardian Agent concept from
> [`autonomous-dual-agent-design.md`](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/future/autonomous-dual-agent-design.md).
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

### 🔺 **Tier 1 — Guardian + Autonomy Core (Phase 2A)** ← CURRENT PRIORITY

> These complete the autonomous closed loop AND add the guardian intelligence layer.

1. **Auto-Verification Pipeline (3a)** — Workflow Step 4. **Highest priority.** The foundation — the guardian needs verification results to reason about.
2. **Guardian Agent (Phase A)** — Dual-agent oversight layer in `processor.ts`:
   - **Intake Gatekeeper**: "Autonomy is a request, not a guarantee." Classifies incoming tasks (Structured Plan, Atomic/Safe, Ambiguous/Risky). If ambiguous, generates **Assisted Scaffold** with `[REQUIRED]` tags.
   - **Tool Profiles (`--tools=<profile>`)**: Replaces dangerous `--yolo` with explicit capability envelopes (`basic`, `write`, `system`, `dangerous`, `custom`).
   - **Command Triad**: Adds `/plan` (blueprint), `/refine` (sharpener), `/verify` (pre-flight audit & post-flight acceptance) across all agents, plus `/enhance` for fast chat rephrasing.
   - **Runtime Oversight**: Post-failure classification, pre-commit review gate, and progress checks. Enabled by default; falls back to doer's model if no guardian model is specified. Closes P5, P6, P8 in reference architecture.
3. **Turn-Supersession Context Pruning** — Workflow Step 7. Mechanical — guardian doesn't replace this.
4. **Atomic Task-Completion Commits** — Workflow Step 8. Mechanical — guardian triggers the commit gate but commit mechanics are still needed.
5. **Dynamic Context Window Discovery (4b)** — Infrastructure dependency.

### 🔸 **Tier 2 — Refinement & Performance (Phase 2B)**

6. **Multi-Model Routing (4)** — *Demoted from Tier 1.* Deterministic fallback/complement to guardian routing decisions.
7. **Blast-Radius Regression Detection (3b)** — *Demoted from Tier 1.* Structured input to guardian, not a prerequisite.
8. **Auto-Lint (3c)**
9. **Snapshot ↔ Oscillation (3d)**
10. **Paginated Message Loading (11.2)**
11. **JSON Serialization Bypass (11.3)**
12. **LSP Confidence Scoring (6a)**
13. **Repo-Level Intent Detection**
14. **TUI Live Telemetry Dashboard (BP 13)**

### 🔹 **Tier 3 — Architecture & UX (Phase 3)**

15. **Guardian Phase B — Task Decomposition** — Guardian owns goal decomposition into task graphs with dependencies and acceptance criteria. Extends `todowrite`.
16. **OS-Level Sandboxing (BP 10)**
17. **MCP Sidecar Security (BP 8)**
18. **Long-Horizon Project Memory (BP 7)**
19. **Mini-TUI Decoupling**
20. **ACP Multi-Root & Diff Cards**
21. **Cross-Session Checklist State Machine**

### Phase 1 Remaining (Low Priority — Not Blocking)

These were originally Phase 1 items that haven't been completed. They're useful but don't block the autonomous loop:

- **ACP Metadata Debounce & Batching** — Add 150ms debounce to `fox-acp-client`. UX improvement only.
- **Named Shadow Checkpoints & /undo** — Surface `/undo` and `/diff` in TUI. Nice-to-have.
- **Local Model Profiles & Prompts Matrix** — Curate profiles for Qwen 2.5, DeepSeek R1/V3, Llama 3, Codestral.

### 🔮 **Tier 4 — Future Vision**

23. **Guardian Phase C — Multi-Worker** — Multiple doer sessions executing tasks in parallel, guardian managing load balancing.

---

## 🧱 Final Verdict

Phase 1B and Phase 2.0 are complete. Fox's compression is **100% correct**
across 334 fixtures with **19.1% token savings**. The foundation is solid.

The next critical milestone is **Phase 2A (Guardian + Autonomy)**. The
compression pipeline is Guardian-ready (`CompressionPolicyOverride` interface
already in place). The Guardian needs to be built.

The revised flow:
```
Phase 1 (✅ Done) → Phase 1B (✅ Done) → Phase 2.0 (✅ Done) → Phase 2A (Guardian) 🔧 → Phase 2B → Phase 3
```
