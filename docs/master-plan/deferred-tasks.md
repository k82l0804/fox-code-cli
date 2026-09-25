# Deferred Tasks

> Items we've identified and want to keep around, but are **not assigned to any phase**.
> They may be promoted to a phase later, or may stay parked indefinitely.
>
> Each entry records where the item originated so it's never lost.

---

- [ ] **MCP Tool Staleness Per-Step Check** — MCP servers can add/remove tools mid-session; `checkMcpStaleness` utility implemented but not wired into loop. Needs MCP.Service version counter or Effect type workaround. *Origin: [Blueprint 11.1 (`8d3ee5e0`)](file:///home/k82l0804/.gemini/antigravity-ide/brain/8d3ee5e0-5c40-4c1c-80d0-660c7ace72b1/walkthrough.md)*

- [ ] **Cost-Budget Execution with Tier Optimization** — User sets a cost budget ($), system optimizes model mix across phases. Includes automatic retry with tier promotion and adversarial cross-review. *Origin: [Competitive Analysis (`fed08079`)](file:///home/k82l0804/.gemini/antigravity-ide/brain/fed08079-5ecf-4e39-91ee-6efe4d4f00c0/competitive_analysis.md)*

- [ ] **ACP Metadata Debounce & Batching** — Deferred to companion `fox-acp-client` VS Code extension repository. Does not block CLI. *Origin: Phase 1 planning*

- [ ] **2D-4. Competitive Evaluation (Automated Runner)** — Run full AFB benchmark suite against Fox, Aider, Goose (3 runs/challenge, median). Generate comparison report with 5-criterion verdict. Infrastructure (runner, rubric, comparator, challenges) is built; deferred pending testing framework decisions. Strategic analysis completed via research docs. *Origin: Phase 2D current-tasks*

- [ ] **2D-5. Fox Hardening (Benchmark-Driven)** — Fix Fox failures discovered during T1–10 automated runs. Iterate until 5-criterion pass bar met. Superseded strategically by Phase 2E (SOTA Harness) which addresses the root causes the research identified. *Origin: Phase 2D current-tasks*

- [ ] **Guardian Multi-Worker Federation (Old Phase 3C)** — Multiple doer sessions executing tasks in parallel under Guardian orchestration. Parked until solo unattended reliability is proven. *Origin: Guardian v4.0 spec (`2026-09-24T08-39_guardian-role.md`)*

- [ ] **Guardian 16-Class Fine-Tuned Action Classifier (Old Layer 1)** — Constrained decoding (XGrammar / xLAM) action model for turn-by-turn supervisory classifications. Superseded by asymmetric prompt-based review on frozen artifacts (Plan Contract + diff). *Origin: Guardian v4.0 spec (`2026-09-24T08-39_guardian-role.md`)*

- [ ] **Wingman Natural Language Autocomplete in TUI (Old GUI Tier 4)** — Real-time prompt/task autocomplete offering keystroke-accepted `/enhance` suggestions in interactive mode. Parked in favor of manual commands (`/plan`, `/refine`). *Origin: Guardian v4.0 spec (`2026-09-24T08-39_guardian-role.md`)*
