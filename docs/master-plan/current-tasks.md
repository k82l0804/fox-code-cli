# Current Tasks — Phase 2F: Harness Law Refinements

> **Phase flow**: Phase 1 (✅) → Phase 1B (✅) → Phase 2.0 (✅) → Phase 2A (✅) → Phase 2B (✅) → Phase 2C (✅) → Phase 2D (✅) → Phase 2E (✅) → **Phase 2F** 🔧 → Phase 2G → Phase 3 → Phase 4
>
> The remaining Aider/SWE-agent behaviors that 2E does not cover. Still harness law, still no extra model.
> 2E-1/2E-2 killed the empty-exit trace on the 8B Llama benchmark — this phase builds on that foundation.
>
> **Note**: 2F-1 (Harness-Owned Commit), 2F-2 (Search ACI), and 2F-4 (Unified Control-Plane Table) were
> implemented in Phase 2E as they were architecturally inseparable from the exit gate and ACI matrix.
> See [done-tasks.md](./done-tasks.md) for details.

---

- [ ] **2F-3. Cheap-First Verify + Incremental Touch-Set** — 3-stage incremental verification: tree-sitter syntax check on apply → lint/tsc on touched files only → full suite at exit. Skip stage 3 if last mutation-tool verify is fresh on same HEAD. One flake retry before consuming a repair budget slot.

- [ ] **2F-5. `/add` Working Set as a First-Class Session Object** — Session working set = localize pins ∪ mutated files ∪ `/add` ∪ `--file`. Stable across turns until `/drop` or session end. Working set files have priority over localize-only pins in `buildCodeContextBlock()`. `/add <path>` and `/drop <path>` TUI commands.

- [ ] **2F-6. Project Command Graph as Session Law** — Detect and persist `{typecheck, test, lint, build}` commands from project config on session start. Verification uses only detected commands, not model-invented ones. Bash policy warns on mismatched commands. User override via `fox.jsonc` or `/set test_command`.

- [ ] **2F-7. Fold or Freeze `general`/`explore` Agents** — Fold `general` into main agent (it adds nothing). Freeze `explore` as a read-only preset (no mutation tools). No new agent personas. Audit all session paths route through `resolveExitCondition()`.

---

> **Execution order**: 2F-3 → 2F-5 → 2F-6 → 2F-7
>
> 2F-3 (incremental verify) is foundational — it makes the verification feedback loop fast enough for the
> working set changes in 2F-5. 2F-6 (project commands) refines what verification runs. 2F-7 (agent fold)
> is a cleanup task that depends on all prior harness law being in place.
>
> **Gate**: All 2E success criteria hold. 781 tests pass. Typecheck clean.
