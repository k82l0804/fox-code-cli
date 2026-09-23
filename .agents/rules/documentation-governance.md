# Documentation Governance: Single Source of Truth

## The Master Plan (`docs/master-plan/`)

The `docs/master-plan/` directory is the **single source of truth** for all Fox CLI task planning. It contains exactly four living documents:

| Document | Contains | Rule |
|----------|----------|------|
| **`current-tasks.md`** | The active sub-phase (e.g., Phase 2A) | Only items being worked on NOW |
| **`future-tasks.md`** | All planned future phases and items | Ordered by phase (2B → 2C → 3 → 4) |
| **`done-tasks.md`** | Completed phases with delivery dates | Items move here when finished |
| **`deferred-tasks.md`** | Parked items — NOT in any phase | Identified but consciously not scheduled |

### How Items Move

```
                    ┌─────────────────┐
  Discovered ──────►│ future-tasks.md │ (assigned to a phase)
                    └────────┬────────┘
                             │ phase becomes current
                             ▼
                    ┌─────────────────┐
                    │current-tasks.md │ (actively being worked on)
                    └────────┬────────┘
                             │ completed
                             ▼
                    ┌─────────────────┐
                    │  done-tasks.md  │ (with completion date)
                    └─────────────────┘

  Discovered but ──►┌──────────────────┐
  not planned       │deferred-tasks.md │ (parked, can be promoted later)
                    └──────────────────┘
```

### When a Sub-Phase Completes

1. Move all items from `current-tasks.md` to `done-tasks.md` with a completion date
2. Move the next sub-phase from `future-tasks.md` into `current-tasks.md`
3. Update the phase flow line in both docs

## Implementation Plans (`docs/plans/`)

Individual features may need their own implementation plans. These go in `docs/plans/` with ISO timestamp prefixes (e.g., `2026-09-23T12-00_multi-cmd-verification.md`). These are snapshot documents — they describe how a specific feature will be built.

## What Goes Where

| Directory | Purpose | Editable? |
|-----------|---------|-----------|
| `docs/master-plan/` | Task state (current/future/done/deferred) | ✅ Actively maintained |
| `docs/plans/` | Feature implementation plans | Created per-feature, read-mostly after |
| `docs/future/` | Reference architectures, design specs | Read-mostly (updated when designs evolve) |
| `docs/reports/` | Analysis results, benchmarks | Read-only after creation |
| `docs/handoffs/` | Session handoff notes | Read-only after creation |
| `docs/archived/` | Superseded documents | Never edited |

## Reconciliation Rule (CRITICAL)

When a conversation discovers or defers a capability:

1. If it belongs in a phase → add it to `future-tasks.md` (or `current-tasks.md` if it's the active phase)
2. If it's not ready for a phase → add it to `deferred-tasks.md`
3. **Every task MUST be in exactly one of these four documents** — no orphans

## Anti-Patterns

- ❌ Creating a new "roadmap" or "priorities" document alongside master-plan/
- ❌ Adding items to `docs/future/` blueprints without reconciling to master-plan/
- ❌ Deferring items in a conversation without adding them to `deferred-tasks.md`
- ❌ Having the same item in multiple master-plan documents
