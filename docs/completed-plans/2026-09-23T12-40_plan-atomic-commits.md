# Plan: Atomic Task-Completion Commits

> **Task**: Phase 2A #4 from [`current-tasks.md`](../master-plan/current-tasks.md)
> **Goal**: Platform-level commit flow with LLM-generated messages, replacing ad-hoc `git commit` via bash tool.

## Background

Today, Fox has two related but disconnected systems:

1. **Commit message generation** ([`src/foxcode/commit-message/generate.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/commit-message/generate.ts), 234 lines) — Uses a small model to generate conventional commit messages from `git diff`. Has a well-structured system prompt and uses `CommitMessageRuntime.generate()`.

2. **VCS module** ([`src/project/vcs.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/project/vcs.ts), 481 lines) — Tracks file changes, provides diffs and stats. Used for snapshot tracking but not for committing.

3. **Bash tool** — Currently the only way the LLM commits code. It runs raw `git add . && git commit -m "..."` which is fragile, produces inconsistent messages, and doesn't track metadata.

The goal is a **`commit` tool** that the LLM can call as a first-class operation with proper staging, message generation, and metadata.

## Proposed Changes

### 1. [NEW] `packages/core/src/tool/commit.ts` (~120 lines)

New tool definition:

```typescript
export const CommitTool = Tool.make({
  name: "commit",
  description: "Commit staged changes with a generated or provided commit message. Automatically stages modified tracked files and generates a conventional commit message from the diff.",
  input: Schema.Struct({
    message: Schema.optional(Schema.String).annotate({
      description: "Optional commit message. If not provided, one will be generated from the diff.",
    }),
    files: Schema.optional(Schema.Array(Schema.String)).annotate({
      description: "Optional list of specific files to stage. If not provided, all modified tracked files are staged.",
    }),
    amend: Schema.optional(Schema.Boolean).annotate({
      description: "If true, amend the previous commit instead of creating a new one.",
    }),
  }),
  output: Schema.Struct({
    hash: Schema.String,
    message: Schema.String,
    filesChanged: Schema.Number,
    insertions: Schema.Number,
    deletions: Schema.Number,
  }),
})
```

### 2. [NEW] `src/tool/commit.ts` (~150 lines)

Tool handler implementation:

```typescript
// 1. Check for changes (git status --porcelain)
// 2. Stage files (git add <files> or git add -u)
// 3. Generate commit message if not provided
//    - Use CommitMessageRuntime.context() for git context
//    - Use CommitMessageRuntime.generate() for LLM message
// 4. Execute git commit -m "<message>"
// 5. Parse output for hash, stats
// 6. Return structured result
```

Key design decisions:
- **No force push** — commit only, never push (user controls when to push)
- **Safe staging** — only tracked files by default (`git add -u`), never `git add .`
- **Message generation** — reuses existing `CommitMessageRuntime` (uses small model)
- **Error handling** — clear errors for "nothing to commit", "merge conflict", etc.

### 3. [MODIFY] [`src/tool/index.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/index.ts) or tool registration

Register the `commit` tool in the standard tool set. Since this is a mutation tool, it should be registered similarly to `write`, `edit`, etc.

### 4. [MODIFY] [`packages/core/src/v1/config/config.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/v1/config/config.ts)

Add config option for commit behavior:

```typescript
commit: Schema.optional(Schema.Struct({
  auto_stage: Schema.optional(Schema.Boolean).annotate({
    description: "Automatically stage modified tracked files before commit. Defaults to true.",
  }),
  sign: Schema.optional(Schema.Boolean).annotate({
    description: "GPG-sign commits. Defaults to false.",
  }),
  prefix: Schema.optional(Schema.String).annotate({
    description: "Prefix for generated commit messages (e.g., 'fox: '). Defaults to none.",
  }),
})),
```

### 5. [NEW] `test/commit.test.ts` (~80 lines)

Tests using a temporary git repo:

| Test | Scenario | Expected |
|------|----------|----------|
| `commits with provided message` | message: "fix: something" | Commit created with that message |
| `commits with generated message` | no message, has diff | Commit created with LLM-generated message |
| `stages specific files` | files: ["a.ts"] | Only a.ts in commit |
| `errors on no changes` | clean working tree | Error: "nothing to commit" |
| `amend mode` | amend: true | Amends previous commit |
| `returns structured output` | any commit | hash, filesChanged, insertions, deletions |

## Verification

```bash
# Run commit tests
CI=true timeout 30s bun test test/commit.test.ts --timeout 30000

# Typecheck
timeout 45s bun run typecheck

# Full test suite
timeout 180s bun run test
```

## Architecture Notes

- The `commit` tool is a **process-scoped application tool** (registered in `application-tools.ts`, not per-Location)
- It needs `Git` service access — follow the pattern in `src/tool/apply_patch.ts` for git integration
- The commit message generator already exists and is well-tested — reuse it, don't rewrite
- Permission: this tool should require user confirmation in non-autonomous mode (use `Permission.Service`)
- The `Verification.MUTATION_TOOLS` set should be updated to include `"commit"` so verification can run after commits
