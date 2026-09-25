# Current Plans — Phase 2E: SOTA Harness & Localization

**Target implementer**: Gemini 3.8 Flash High

**Ship order**: PR 1 → PR 2 → PR 3 → PR 4 → PR 5 (see [current-tasks.md](../master-plan/current-tasks.md) for gates)

> **Key rule**: Plans name the **loop assertion** they enforce, not the files they touch.
> Every plan includes a "non-goals / do not break" section preserving: local-first, prefix stability, transactional apply.

| Plan | PR | Tasks | Status |
|------|-----|-------|--------|
| [PR 1: Exit Gate + Verify + Commit + Control Plane](./2026-09-25T04-55_pr1-exit-gate-verify-commit.md) | PR 1 | 2E-1 + 2E-2 + 2F-1 + 2F-4 | ⏳ Pending |
| [PR 2: ACI Matrix + Grep Shape](./2026-09-25T04-56_pr2-aci-matrix-grep-shape.md) | PR 2 | 2E-4 + 2F-2 | ⏳ Pending |
| [PR 3: Code Context Block](./2026-09-25T04-57_pr3-code-context-block.md) | PR 3 | 2E-3 (includes 2E-5) | ⏳ Pending |
| [PR 4: Weak-Model Fast Path](./2026-09-25T04-58_pr4-weak-model-fast-path.md) | PR 4 | 2E-6 | ⏳ Pending |
| [PR 5: Multi-Attempt v1](./2026-09-25T04-59_pr5-multi-attempt.md) | PR 5 | 2E-7 | ⏳ Pending |

## Dependency Order

```
PR 1 (exit gate + verify + commit + control plane)
  └─► PR 2 (ACI matrix + grep shape)
        └─► PR 3 (code context block)
              └─► PR 4 (weak-model fast path)
                    └─► PR 5 (multi-attempt)
```

**Do not start PR N+1 until PR N's gate passes.** Do not plan all of 2E then start at 2E-3 because the indexer is interesting — implement in order.

