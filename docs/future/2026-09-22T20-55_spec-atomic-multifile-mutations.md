# 🦊 Architectural Specification: Atomic Multi-File Mutations

> **Document Version:** 1.0.0  
> **Date:** 2026-09-22T20:55:00-04:00  
> **Target Subsystem:** `packages/core/src/tool/tools/patch.ts`, `packages/core/src/tool/tools/batch-write.ts`  
> **Reference Benchmark:** [`../2026-09-22T20-40_competitive-agent-benchmark-aider-goose.md`](../2026-09-22T20-40_competitive-agent-benchmark-aider-goose.md)

---

## 1. Problem Statement & Motivation

In **Task 1 (Job Queue Engine)**, the task required scaffolding three interrelated files:
1. `src/queue.ts` (core engine)
2. `test/queue.test.ts` (test suite)
3. `src/index.ts` (executable demo)

### The Serial Tool Bottleneck
In Fox's current tool architecture, `edit` and `write` operate on **exactly one file per invocation**. When generating new services or refactoring cross-file interfaces, the agent must either:
- Take 3 to 6 separate turns to create each file sequentially, or
- Invoke `bash` with complex `cat << 'EOF' > ...` commands, bypassing Fox's snapshot, rollback, and validation safeguards.

In contrast, **Aider generated all 3 files in a single unified diff patch block in 80 seconds**, saving multiple LLM round-trips.

---

## 2. Proposed Architecture: Multi-File Atomic Transactions

We expand Fox's mutation layer to support **atomic multi-file transactions** through two coordinated enhancements:

```
                  ┌────────────────────────────────────────┐
                  │      ATOMIC MULTI-FILE TRANSACTION     │
                  └───────────────────┬────────────────────┘
                                      │
                         [Pre-Commit Shadow Snapshot]
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
       [Path A: `apply_patch`]                         [Path B: `batch_write`]
   Multi-file unified diff format                 Array of {path, content}
   `diff --git a/file1 b/file1`                   for zero-to-one scaffolding
   `diff --git a/file2 b/file2`
              │                                               │
              └───────────────────────┬───────────────────────┘
                                      │
                                      ▼
                           [Validation Pipeline]
                       • Path safety check (no `../`)
                       • File lock acquisition
                       • Syntax & encoding check
                                      │
                         ┌────────────┴────────────┐
                        ALL OK                   ANY ERROR
                         │                          │
                         ▼                          ▼
               [Commit All Files]         [Atomic Rollback]
               Emits single combined      Working tree restored;
               git snapshot entry         zero broken files left
```

---

## 3. Tool Enhancements

### 3.1 Enhancing `apply_patch` (`packages/core/src/tool/tools/patch.ts`)
Update Fox's native unified diff parser so that a single unified patch text can contain multiple file headers:
```diff
diff --git a/src/queue.ts b/src/queue.ts
new file mode 100644
--- /dev/null
+++ b/src/queue.ts
@@ -0,0 +1,100 @@
+export class TaskQueue { ... }
diff --git a/test/queue.test.ts b/test/queue.test.ts
new file mode 100644
--- /dev/null
+++ b/test/queue.test.ts
@@ -0,0 +1,50 @@
+import { test, expect } from "bun:test"
```

### 3.2 Introducing `batch_write` (`packages/core/src/tool/tools/batch-write.ts`)
For zero-to-one scaffolding without git diff notation:
```typescript
export const BatchWriteInput = Schema.Struct({
  files: Schema.Array(
    Schema.Struct({
      path: Schema.String,
      content: Schema.String,
      mode: Schema.optional(Schema.Literals(["create", "overwrite"])),
    })
  ),
  description: Schema.optional(Schema.String),
})
```

---

## 4. Key Guarantees: Atomicity & Rollback Safety

1. **Transactional Shadow Commit**:
   Before modifying any bytes on disk, Fox captures a single snapshot of all target paths via `.fox/snapshots/`.
2. **All-or-Nothing Mutation**:
   If writing File 3 fails (e.g. disk full, permission denied, or invalid TypeScript syntax when strict checking is on), Files 1 and 2 are automatically reverted to their pre-turn state.
3. **Turn Economy Impact**:
   Reduces multi-file app scaffolding from **3–6 turns down to 1 turn**, cutting wall-clock generation latency by **40%–60%**.
