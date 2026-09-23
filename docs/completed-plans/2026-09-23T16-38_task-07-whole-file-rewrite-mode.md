# Task 7: Whole-File Rewrite Mode (Tier D)

> **Status**: Ready for implementation
> **Implementer**: Gemini Flash 3.8 High
> **Depends on**: Model Capability Tier System (Phase 1, complete)
> **Estimated scope**: Small — the tool already exists, work is integration + tests

## Background

The `rewrite_file` tool already exists at [`src/tool/rewrite_file.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/rewrite_file.ts). It is a deliberately simple full-file overwrite tool with:
- Two parameters: `file_path` (absolute) and `content` (complete file)
- No diff parsing, no hunk matching — just writes the whole file
- BOM-aware, creates parent directories, computes diff stats for output
- Uses `edit` permission (same as `write`)
- Already registered in [`src/tool/registry.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/registry.ts) at line 151

The tool is already included in [`TIER_SAFE_TOOLS`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/model-tier.ts#L240-L255) and excluded from [`TIER_COMPLEX_TOOLS`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/model-tier.ts#L262-L275). The [`filterToolsByTier`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/model-tier.ts#L288-L304) function already handles the Tier D case: it removes `edit`, `write`, and `apply_patch` for Tier D models while keeping `rewrite_file`.

**What remains**: Test coverage for the `rewrite_file` tool itself. The tool has zero dedicated test coverage. The tier filtering logic _around_ it is tested (94 tests in [`test/model-tier.test.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/test/model-tier.test.ts)), but the tool's own behavior (path resolution, BOM handling, permission checks, diff stats, create-vs-overwrite) is not.

## Proposed Changes

### Tests

#### [NEW] `test/rewrite-file.test.ts`

Create a focused unit test file for the `rewrite_file` tool. Test categories:

1. **File creation** — writing to a path that doesn't exist creates the file and parent directories, reports correct line count
2. **File overwrite** — writing to an existing file overwrites content, reports correct `+lines/-lines` stats
3. **Path resolution** — relative paths are resolved against `instance.directory`; absolute paths are used as-is
4. **BOM preservation** — if the existing file has a UTF-8 BOM, the rewritten file preserves it; if neither old nor new has BOM, none is added
5. **Permission check** — the tool calls `ctx.ask` with `permission: "edit"` and the relative file path pattern
6. **Diff stats accuracy** — verify `linesAdded` and `linesRemoved` metadata against known inputs

Use the same test patterns as [`test/model-tier.test.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/test/model-tier.test.ts) — `bun:test` with `describe`/`test`/`expect`. The tool's `execute` function requires Effect services (`FSUtil.Service`, `EventV2Bridge.Service`, `InstanceState`), so tests should either:
- Mock the services using Effect test layers, or
- Test the pure logic (diff stat computation, path resolution) directly

The simpler approach is to extract and test the pure logic separately (path resolution, diff stats) and leave full integration testing to a later phase. **Minimum required: 8 tests covering the 6 categories above.**

### Verification That Existing Wiring is Complete

Verify (no code changes expected, just confirm):

1. `rewrite_file` appears in [`TIER_SAFE_TOOLS`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/foxcode/model-tier.ts#L240) — ✅ confirmed
2. `rewrite_file` is NOT in `TIER_COMPLEX_TOOLS` — ✅ confirmed  
3. `filterToolsByTier` Tier D case removes `edit`/`write`/`apply_patch` but NOT `rewrite_file` — ✅ confirmed
4. The tool is registered in [`src/tool/registry.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/tool/registry.ts#L151) — ✅ confirmed
5. Permission uses `edit` (matches the existing `rewrite_file: "allow"` in scribe agent's permission config) — ✅ confirmed

### Optional Enhancements (if time permits)

#### [MODIFY] `src/tool/rewrite_file.ts`

- Add a `reason` parameter (optional string) so small models can explain _why_ they're rewriting, improving auditability. This is not required but would improve the tool's usability for small models that benefit from self-explanation.

## Verification Plan

### Automated Tests

```bash
timeout 30s CI=true bun test test/rewrite-file.test.ts
timeout 45s bun run typecheck
```

### Manual Verification

None required — this is a test-only change for an already-working tool.
