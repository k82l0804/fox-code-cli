# 2F-7: Fold or Freeze `general`/`explore` Agents

> **Loop assertion**: No agent path bypasses `resolveExitCondition()`. Every code-change session routes through the hardened exit gate.

---

## Goal

Eliminate the undisciplined path. `general` is a same-model clone of the main agent with all tools and no harness discipline. `explore` has all tools including mutation. Both bypass the exit gate. Fold `general` into the main agent. Freeze `explore` as a genuinely read-only preset.

## Key Code Locations

| File | Role |
|------|------|
| [`src/agent/agent.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/agent/agent.ts) | Agent definitions (`general` at line ~201, `explore` at line ~216) |
| [`src/agent/prompt/explore.txt`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/agent/prompt/explore.txt) | Explore agent system prompt |
| [`src/session/prompt/loop.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt/loop.ts) | Exit gate — `resolveExitCondition()` call |
| [`src/foxcode/model-tier.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/model-tier.ts) | `TIER_TOOL_SURFACE`, `filterToolsByTier()` |

## Proposed Changes

### 1. Remove `general` Agent

- Delete the `general` agent definition from `agent.ts` (line ~201)
- Audit all references to `"general"` in session dispatch code
- Any task dispatch that routed to `general` now routes to the main agent (which already has all tools + exit gate)

### 2. Freeze `explore` as Read-Only

- Restrict `explore` tool surface to: `read`, `grep`, `glob`, `lsp`, `bash` (no `edit`, `rewrite_file`, `apply_patch`, `write`, `commit`)
- Add a `mode: "subagent"` flag if not already set (prevents it from being used as a primary agent)
- Update `explore.txt` system prompt to explicitly state "You are a read-only research agent. You cannot modify files."
- `resolveExitCondition()` for explore sessions: always allow exit (no mutation gate, since no mutations are possible)

### 3. Audit Session Dispatch

- Search all code paths that dispatch to agents
- Ensure every code-change capable agent routes through the exit gate
- Subagents (`scout`, `runner`, `scribe`, `reference`) are already scoped and do not bypass the gate

### 4. Backward Compatibility

- If user config references `general`, treat as main agent with a deprecation warning
- If user config references `explore`, apply the frozen tool surface

## Edge Cases

- User has `general` in their `fox.jsonc` agent config → deprecation warning, routes to main
- Subagent spawned with `general` name → routes to main with all harness discipline
- `explore` tries to run `bash rm -rf` → allowed (bash is in surface), but mutation tools blocked

## Verification Plan

- Unit: main agent with code-change task → full exit gate applies
- Unit: `explore` agent → mutation tools not in surface
- Integration: no agent path bypasses `resolveExitCondition()`
- Integration: `general` reference in config → deprecation warning + routes to main
- Smoke: `bun run test:smoke` passes

## Non-Goals / Do Not Break

- Local-first: no network calls
- Prefix stability: agent prompt changes don't affect `sysCache` for the main agent
- Transactional apply: explore can't apply, so not relevant
- Do NOT add new agent personas — Scout = capped tool, Scribe = fence-parse, Runner = verify pipeline
