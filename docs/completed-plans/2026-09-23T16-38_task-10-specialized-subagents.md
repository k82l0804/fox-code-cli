# Task 10: Specialized Subagents

> **Status**: Ready for implementation
> **Implementer**: Gemini Flash 3.8 High
> **Depends on**: Task 7 (rewrite_file tool), existing agent architecture
> **Estimated scope**: Medium — new agent definitions, prompts, permissions, and tests

## Background

Fox currently has two subagents defined in [`src/agent/agent.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/agent/agent.ts#L198-L236):

- **`general`** (line 198) — full tool set minus `todowrite`, mode `subagent`, workflow `swe`
- **`explore`** (line 213) — read-only tools + hardened bash, mode `subagent`, workflow `research`

There is also an experimental **`scout`** behind `flags.experimentalScout` (line 237) — a docs/dependency-source specialist with `repo_clone`, `repo_overview`, and read-only tools.

The existing `scout` is focused on _external_ repository research (cloning upstream repos, reading dependency source). The new scout we're adding here is focused on _local_ codebase research (read-only, no cloning). These are different agents with different purposes. The existing experimental scout should be renamed or merged later (out of scope for this task).

**Design decisions (from current-tasks.md)**:
- Keep `general` and `explore` unchanged
- Add 3 new subagents: `scout` (local read-only research), `runner` (test/build execution), `scribe` (file writing)
- Model resolution is explicit-only: subagents inherit the primary model, override via `agent.<name>.model` in config
- No auto-downselect or `small_model` fallback

## Proposed Changes

### New Prompt Files

#### [NEW] `src/foxcode/agent/prompt-scout.txt`

```
You are `scout`, a read-only codebase research agent.

Your purpose is to explore and understand code in the local workspace without making any changes.

Use this agent when asked to:
- Find specific files, functions, classes, or patterns in the codebase
- Understand how a feature or subsystem is implemented
- Trace data flow or call chains across files
- Answer questions about code structure, dependencies, or architecture
- Locate configuration, tests, or documentation related to a topic

Working style:
1. Start with Glob to find files matching the topic or pattern.
2. Use Grep to search for specific identifiers, strings, or patterns.
3. Use Read to examine file contents when you need full context.
4. Build your understanding incrementally — search broadly first, then narrow down.
5. When tracing call chains, follow imports and references across files systematically.

Research standards:
- Return absolute file paths and line numbers for all findings.
- Distinguish between confirmed facts and inferences.
- If the codebase is large, explain what you searched and what you did not.
- Report negative results explicitly ("X was not found in Y").

Constraints:
- Do not modify any files.
- Do not run shell commands.
- Do not use tools outside of read, grep, and glob.

Complete the research request efficiently and report findings clearly.
```

#### [NEW] `src/foxcode/agent/prompt-runner.txt`

```
You are `runner`, a command execution agent for tests, builds, and linters.

Your purpose is to run read-only shell commands and report their output without modifying code files.

Use this agent when asked to:
- Run a test suite and report results
- Execute a build and check for errors
- Run a linter or type checker
- Check command output (e.g., version info, environment state)
- Execute diagnostic commands to gather system or project information

Working style:
1. Run the requested command using bash.
2. Report the full output, highlighting errors, warnings, and failures.
3. If the command fails, include the exit code and stderr.
4. For test suites, summarize pass/fail counts and list failing test names.
5. For builds, summarize error messages with file paths and line numbers.

Constraints:
- Only run commands that read or test — do not run commands that modify files.
- Do not edit, write, or create files.
- Do not install packages or modify the environment.
- If the requested command would modify state, explain why you cannot run it and suggest an alternative.

Report command results clearly, with the most important information first.
```

#### [NEW] `src/foxcode/agent/prompt-scribe.txt`

```
You are `scribe`, a file writing agent.

Your purpose is to create or overwrite files based on instructions. You use the simple rewrite_file tool — no diffs, no patches, just complete file contents.

Use this agent when asked to:
- Create a new file with specific content
- Overwrite an existing file with updated content
- Generate boilerplate, configuration, or template files
- Write documentation or markdown files

Working style:
1. Understand what file needs to be created or modified.
2. Write the complete file content — do not use partial edits or patches.
3. Use rewrite_file with the absolute file path and the full new content.
4. For multiple files, write them one at a time.
5. After writing, confirm what was created or changed.

Constraints:
- Use rewrite_file or write for all file operations — do not use edit or apply_patch.
- Provide complete file contents every time — do not use diffs.
- Do not run shell commands.
- Do not read files unless you need to understand context before writing.

Write files accurately and confirm the results.
```

### Agent Definitions

#### [MODIFY] [`src/agent/agent.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/agent/agent.ts)

**Step 1: Add imports for the new prompt files** (near line 15):

```typescript
import PROMPT_SCOUT_LOCAL from "@/foxcode/agent/prompt-scout.txt"
import PROMPT_RUNNER from "@/foxcode/agent/prompt-runner.txt"
import PROMPT_SCRIBE from "@/foxcode/agent/prompt-scribe.txt"
```

> **Important**: The existing `PROMPT_SCOUT` import (line 15) is for the _experimental_ scout (`flags.experimentalScout`). The new local scout uses a different prompt. Name the import `PROMPT_SCOUT_LOCAL` to avoid collision.

**Step 2: Add the three new agent definitions** in the agents object, after `explore` (line 236) and before the `experimentalScout` conditional (line 237):

```typescript
scout: {
  name: "scout",
  description: "Read-only codebase research. Use this for finding files, tracing code, and answering questions about the codebase without making changes.",
  prompt: PROMPT_SCOUT_LOCAL,
  options: {},
  permission: Permission.merge(
    defaults,
    Permission.fromConfig({
      "*": "deny",
      read: "allow",
      grep: "allow",
      glob: "allow",
    }),
    user,
  ),
  mode: "subagent" as const,
  workflow: "research",
  native: true,
},
runner: {
  name: "runner",
  description: "Execute tests, builds, linters, and diagnostic commands. Read-only shell access — no file modifications.",
  prompt: PROMPT_RUNNER,
  options: {},
  permission: Permission.merge(
    defaults,
    Permission.fromConfig({
      "*": "deny",
      bash: readOnlyBash,
      read: "allow",
      grep: "allow",
      glob: "allow",
    }),
    user,
  ),
  mode: "subagent" as const,
  workflow: "research",
  native: true,
},
scribe: {
  name: "scribe",
  description: "Create or overwrite files using simple full-file writes. No diffs or patches — just complete file contents.",
  prompt: PROMPT_SCRIBE,
  options: {},
  permission: Permission.merge(
    defaults,
    Permission.fromConfig({
      "*": "deny",
      rewrite_file: "allow",
      write: "allow",
      read: "allow",
    }),
    user,
  ),
  mode: "subagent" as const,
  workflow: "swe",
  native: true,
},
```

> **Note**: `readOnlyBash` is imported from [`src/foxcode/agent/index.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/agent/index.ts#L87-L144) — check that it's available in the scope where agents are defined. It is exported from that module and used by `explore`, so it should be accessible.

**Step 3: Handle experimental scout naming collision.**

The existing experimental scout at line 237 also uses the key `scout`. When the new unconditional `scout` agent is added above it, the `experimentalScout` conditional would overwrite it. Two options:

- **Option A (recommended)**: Rename the experimental scout to `reference` or `deps` since its purpose is external dependency/docs research, not local codebase scouting.
- **Option B**: Remove the experimental scout conditional entirely, since the new `scout` + the existing `explore` cover its use cases. The `references` feature (line 388) already creates per-reference agents.

**Go with Option A**: Rename the experimental scout key from `scout` to `reference`:

```typescript
...(flags.experimentalScout
  ? {
      reference: {  // ← was "scout"
        name: "reference",  // ← was "scout"
        // ... rest unchanged
      },
    }
  : {}),
```

Also rename `PROMPT_SCOUT` import to `PROMPT_REFERENCE` for clarity.

### Fox Agent Module

#### [MODIFY] [`src/foxcode/agent/index.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/agent/index.ts)

No changes needed to `patchAgents` — the new agents are defined in `agent.ts` directly, not patched. The permission module already exports `readOnlyBash` which `runner` uses.

However, add hardening for `scribe` in `patchAgents` to ensure the `write` permission cannot be widened by config:

In the `patchAgents` function, after the `hardenExplore` call (line 349), add:
```typescript
// Scribe gets rewrite_file + write only; user config cannot widen to edit/apply_patch
if (key === "scribe" && item.native) {
  item.permission = Permission.merge(
    item.permission,
    Permission.fromConfig({ edit: "deny", apply_patch: "deny", bash: "deny", task: "deny" }),
    ...explicit.map(denies),
  )
}
```

### Tests

#### [NEW] `test/subagents.test.ts`

Test the new agent definitions. Since agents are built inside an Effect context with many dependencies, the most practical approach is to test the _permission configuration_ and _agent properties_ rather than full integration:

1. **Scout has read-only permissions** — verify that `scout`'s permission includes `read: allow`, `grep: allow`, `glob: allow` and denies `edit`, `write`, `bash`, `task`
2. **Runner has read-only bash** — verify that `runner`'s permission allows `bash` with `readOnlyBash` rules and denies `edit`, `write`, `task`
3. **Runner bash denies mutating commands** — verify that `runner`'s bash permission denies `rm *`, `git push *`, etc. (test the `readOnlyBash` rules)
4. **Scribe has write but not edit** — verify that `scribe`'s permission allows `rewrite_file`, `write` and denies `edit`, `apply_patch`, `bash`
5. **All three are mode: subagent** — verify mode field
6. **All three are native** — verify native field
7. **Scout has no bash** — verify `bash` is denied for scout
8. **Experimental scout renamed to reference** — verify the experimental scout key is `reference`, not `scout`

**Minimum required: 8 tests.**

The test approach: import the agent-building logic or construct the permission rulesets directly using `Permission.fromConfig` and `Permission.merge` with the same inputs as the agent definitions, then test the resulting rules using `Permission.check` or by inspecting the ruleset.

### Documentation

#### [MODIFY] `src/foxcode/skills/fox-config.md`

Update the Agents section to mention the new subagents:

```markdown
Built-in subagents (invoked via the `task` tool):
- `general` — full-capability multi-step work
- `explore` — fast codebase exploration (read-only + hardened bash)
- `scout` — read-only codebase research (read, grep, glob only)
- `runner` — test/build/lint execution (read-only bash)
- `scribe` — file creation/overwrite (rewrite_file, write)
```

## Key Architectural Decisions

1. **Scout is unconditional, experimental scout is renamed.** The new `scout` subagent is always available (no feature flag). The experimental scout (external dependency research) is renamed to `reference` to avoid key collision.

2. **Runner uses `readOnlyBash` from the explore agent module.** This is the same hardened bash allowlist that explore uses, ensuring consistency. The runner does NOT get `gh *` access (denied in `exploreBash` which layers on `readOnlyBash`). For runner, use `readOnlyBash` directly (without the `exploreBash` overlay), so `gh *: ask` remains available.

3. **Scribe uses `rewrite_file` + `write`.** Both are allowed. `write` is the existing full-file write tool with formatting and LSP integration. `rewrite_file` is the simpler variant for small models. The scribe agent is available to Tier B+ models (it needs to write code), so both tools are appropriate.

4. **No new config fields.** The new agents are configured through the existing `agent.<name>` config mechanism. Per-agent model override works through `agent.<name>.model`.

5. **Workflow assignments**: `scout` and `runner` use `research` workflow (no code changes). `scribe` uses `swe` workflow (it writes files).

## Verification Plan

### Automated Tests

```bash
timeout 30s CI=true bun test test/subagents.test.ts
timeout 45s bun run typecheck
timeout 60s bun run test:smoke
```

### Manual Verification

After implementation, verify in the TUI that:
1. `scout`, `runner`, and `scribe` do NOT appear in the `@` agent picker (they are mode: subagent)
2. The `task` tool can invoke them by name
3. `fox agent list` shows all 5 subagents
