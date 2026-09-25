# Current Plans — Phase 2F: Harness Law Refinements

**Target implementer**: Gemini 3.8 Flash High

**Execution order**: 2F-3 → 2F-5 → 2F-6 → 2F-7

> **Note**: 2F-1, 2F-2, and 2F-4 were implemented in Phase 2E (pulled forward as architecturally
> inseparable from the exit gate and ACI matrix). See [done-tasks.md](../master-plan/done-tasks.md).

| Plan | Task | Status |
|------|------|--------|
| [2F-3: Incremental Verify](./2026-09-25T16-30_2f3-incremental-verify.md) | Cheap-First Verify + Incremental Touch-Set | ⏳ Pending |
| [2F-5: Working Set](./2026-09-25T16-30_2f5-working-set.md) | `/add` Working Set as First-Class Session Object | ⏳ Pending |
| [2F-6: Project Commands](./2026-09-25T16-30_2f6-project-commands.md) | Project Command Graph as Session Law | ⏳ Pending |
| [2F-7: Agent Fold/Freeze](./2026-09-25T16-30_2f7-fold-freeze-agents.md) | Fold or Freeze `general`/`explore` Agents | ⏳ Pending |

## Dependency Order

```
2F-3 (incremental verify)
  └─► 2F-5 (working set)
        └─► 2F-6 (project commands)
              └─► 2F-7 (agent fold/freeze)
```
