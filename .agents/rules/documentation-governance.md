# Documentation Governance: Single Source of Truth

## The Master Plan

**`docs/plans/<timestamp>_master-plan.md`** is the **single canonical roadmap** for Fox CLI.

- All phase definitions, priority ordering, and item assignments live here.
- No other document may declare phases, tiers, or priority ordering.
- When priorities change, edit the master plan directly — do not create parallel planning documents.

## The Deferred Items Ledger

**`docs/plans/<timestamp>_deferred-items.md`** is the **traceability companion** to the master plan.

- Every deferred capability discovered in a conversation MUST be added here.
- Every item MUST have a phase assignment that matches the master plan.
- Items are never removed — completed items are marked ✅, subsumed items note what replaced them.

## Reconciliation Rule (CRITICAL)

When a conversation defers, discovers, or reprioritizes a capability:

1. Add/update the item in `deferred-items.md`
2. Add/update the item in `master-plan.md`
3. Both changes MUST happen in the **same commit**

This prevents the failure mode where items are recorded in one document but never propagated to the other.

## What Goes Where

| Document | Purpose | Editable? |
|----------|---------|-----------|
| `docs/plans/*_master-plan.md` | Phases, priorities, what we're building | ✅ Actively maintained |
| `docs/plans/*_deferred-items.md` | Item traceability to originating sessions | ✅ Actively maintained |
| `docs/future/*.md` | Reference architectures, design specs, research | Read-mostly (updated when designs evolve) |
| `docs/reports/*.md` | Analysis results, benchmarks | Read-only after creation |
| `docs/handoffs/*.md` | Session handoff notes | Read-only after creation |
| `docs/archived/*.md` | Superseded documents | Never edited |

## Anti-Patterns

- ❌ Creating a new "priorities" or "roadmap" document alongside the master plan
- ❌ Adding items to `docs/future/` blueprints without reconciling to the master plan
- ❌ Editing phase structures in conversation artifacts without updating the master plan
- ❌ Deferring items in a walkthrough without adding them to `deferred-items.md`
