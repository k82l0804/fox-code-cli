# 2F-6: Project Command Graph as Session Law

> **Loop assertion**: The verification pipeline and bash policy use only detected project commands, not model-invented ones.

---

## Goal

Prevent the model from inventing test/lint commands (`npm test` in a Bun project, `pytest -q` in a Bazel repo). Detect project commands on session start, persist them, and use them as the single source of truth for verification.

## Key Code Locations

| File | Role |
|------|------|
| [`packages/core/src/verification.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/verification.ts) | `readPackageScripts()` (line ~375), `detectCommandPipeline()` (line ~156) |
| [`src/session/processor.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/processor.ts) | Session initialization, bash tool output processing |
| [`src/tool/shell.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/shell.ts) | Bash command execution |
| [`src/foxcode/config/config.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/config/config.ts) | Config file reading (`fox.jsonc`) |

## Proposed Changes

### 1. Project Command Detection (`src/session/project-commands.ts` — new)

```typescript
export interface ProjectCommands {
  typecheck?: { command: string; source: string }
  test?: { command: string; source: string }
  lint?: { command: string; source: string }
  build?: { command: string; source: string }
}

export async function detectProjectCommands(projectDir: string): Promise<ProjectCommands>
```

Detection priority:
1. `fox.jsonc` / `kilo.jsonc` config overrides (`autonomous.test_command`, `autonomous.typecheck_command`, `autonomous.lint_command`)
2. `package.json` scripts (via existing `readPackageScripts()`)
3. `Makefile` targets (`test`, `lint`, `check`)
4. `pyproject.toml` `[tool.pytest]` / `[tool.ruff]`
5. `Cargo.toml` → `cargo test`, `cargo check`

### 2. Persist on Session Start

In `processor.ts` (or `loop.ts` session init), call `detectProjectCommands()` once and store in session state. Make available to the verification pipeline.

### 3. Verification Pipeline Uses Detected Commands

Modify the verification hook in `processor.ts` to pass detected commands to `detectCommandPipeline()` instead of re-reading `package.json` every time. The existing `detectCommandPipeline()` already accepts override params — wire the detected commands through.

### 4. Bash Policy Warning

In `shell.ts`, after command execution, check if the command matches a known test/lint/build pattern that differs from detected commands:
- Model runs `npm test` but detected command is `bun run test` → append warning to output
- Model runs `python -m pytest` but detected command is `make test` → append warning
- Only warn, never block — the model might have a legitimate reason

### 5. `/set` Command Override

Add `/set test_command <cmd>`, `/set typecheck_command <cmd>`, `/set lint_command <cmd>` to allow user override within a session. Persisted in session state, not config file.

## Edge Cases

- No project config detected → no warnings, verification uses existing heuristics
- Multiple config sources → priority order above applies
- Model runs a variant (`bun test --filter=x`) → don't warn (prefix match, not exact match)
- Monorepo with multiple `package.json` → use the one in project root

## Verification Plan

- Unit: `detectProjectCommands()` on fixture dirs (Bun, npm, Python, Cargo, Makefile)
- Integration: Bun project → detects `bun run test`, not `npm test`
- Integration: model runs `npm test` → warning injected
- Integration: `fox.jsonc` override respected
- Integration: `/set test_command <cmd>` overrides detection
- Smoke: `bun run test:smoke` passes

## Non-Goals / Do Not Break

- Local-first: no network calls
- Prefix stability: command graph is NOT in the system prompt — it's session metadata
- Transactional apply: command detection is read-only
