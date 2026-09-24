# Current Tasks — Phase 2D: Agent Faultline Benchmark (AFB)

> **Phase flow**: Phase 1 (✅) → Phase 1B (✅) → Phase 2.0 (✅) → Phase 2A (✅) → Phase 2B (✅) → Phase 2C (✅) → **Phase 2D** 🔧 → Phase 3 → Phase 4
>
> 100-challenge tiered benchmark (10 tiers × 10 challenges) that exposes real fault lines in agent CLIs.
> Compares Fox vs Aider vs Goose with a rigorous 5-dimension scoring rubric.
> **Gate before Phase 3**: Fox must pass a 5-criterion AND gate before Guardian work begins.
>
> Location: `test/capability-ladder/`

---

- [ ] **2D-1. Benchmark Infrastructure** — `rubric.ts` (5-dimension scoring + efficiency formula), `runner.ts` (sandbox + agent invocation + token/time capture), `reporter.ts` (JSON + Markdown), `comparator.ts` (multi-agent verdict + 5-criterion pass bar), catastrophic failure detection. Scripts: `bun run bench`, `bun run bench:compare`.

- [ ] **2D-2. Tier 1–5 Challenges (50)** — Sanity, Multi-step, Multi-file SWE, Error Recovery, Adversarial Instructions. 50 workspaces, 50 `challenge.json`, 50 `verify.ts`, reference solutions. Run Fox against T1–5, fix failures.

- [ ] **2D-3. Tier 6–10 Challenges (50)** — Long-horizon, Unsafe Autonomy, Guardian+Autonomy, Arbitration, SWE-bench Bugs. 50 workspaces, 50 `challenge.json`, 50 `verify.ts`. T8–9 scored on native agent behavior (no Guardian yet).

- [ ] **2D-4. Competitive Evaluation** — Run full suite against Fox, Aider, Goose (3 runs/challenge, median). Generate comparison report with 5-criterion verdict. Publish to `docs/reports/`.

- [ ] **2D-5. Fox Hardening** — Fix Fox failures discovered during T1–10 runs. Iterate until 5-criterion pass bar met. Document architectural improvements.

---

> **Pass bar (all must be true simultaneously):**
> 1. Fox ≥ 70% on Tiers 1–7 + T10 (≥ 56/80 challenges scoring ≥ 7/10)
> 2. Fox ≥ both Aider AND Goose on overall score
> 3. Fox ≥ best competitor on ≥ 6 of 8 runnable tiers
> 4. Zero catastrophic failures on any evaluated task
> 5. All criteria above met simultaneously

> **Recommended execution order**: 2D-1 → 2D-2 → 2D-3 → 2D-4 → 2D-5
> (Infrastructure first, then challenges bottom-up, then evaluation, then hardening)

> **References**:
> - [Phase 2D Plan](file:///home/k82l0804/.gemini/antigravity-ide/brain/b76840f4-d827-4e96-9f45-6cb2fca03b67/phase-2d-plan.md)
> - [Existing Challenge Ladder Report](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/2026-09-22T15-54_fox-challenge-ladder-report.md)
> - [Competitive Benchmark Report](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/2026-09-22T20-40_competitive-agent-benchmark-aider-goose.md)
> - [Competitor Eval Script](file:///home/k82l0804/workarea/fox/fox-code-cli/tools/competitor-eval.sh)
