# Handoff: Phase 1 Remaining Items

> **Created:** 2026-09-22
> **Status:** Open — 3 items remaining (not blocking Phase 2A)
> **Priority:** Low — these improve UX/DX but don't block the autonomous loop
> **Originating Session:** [`188a6acb`](../../.gemini/antigravity-ide/brain/188a6acb-cd0f-451e-873f-af0d1ba57900/walkthrough.md)
> **Roadmap Reference:** [`2026-09-21T06-12_plan-competitive-features-roadmap.md`](../future/2026-09-21T06-12_plan-competitive-features-roadmap.md) Phase 1 items 3, 4, 6

---

## Context

Phase 1 originally had 7 items. 4 are complete:

| # | Item | Status |
|---|------|--------|
| 1 | Patch Confidence Scoring (BP 6) | ✅ Done |
| 2 | Incremental AST Caching (BP 1) | ✅ Done |
| 5 | Static Tool Closure Resolution (BP 11.1) | ✅ Done |
| 7 | CI Invariant & Compression Gate | ✅ Done (`test:challenge`) |

The 3 remaining items are documented below with implementation guidance.

---

## Item 1: ACP Metadata Debounce & Batching

**Blueprint Reference:** Plan item #3, Blueprint 8 (line 131 in competitor table)
**Codebase:** [`fox-acp-client/`](../../../fox-acp-client/)
**Effort Estimate:** ~0.5 day

### Problem
The ACP client (`fox-acp-client` VS Code extension) transmits editor metadata (cursor position, active file, open tabs) to the Fox CLI server. Currently there's no debounce — rapid cursor movements or file switches can cause streaming jitter and unnecessary JSON-RPC traffic.

### What to Build
1. **150ms debounce window** on `onDidChangeTextEditorSelection` and `onDidChangeActiveTextEditor` events
2. **Priority channels**: separate high-priority (user commands, tool approvals) from low-priority (metadata updates) so metadata never blocks user interactions
3. **Batch coalescing**: if multiple metadata fields change within the debounce window, send a single combined update

### Where to Look
- The ACP client source is in `fox-acp-client/src/`
- The JSON-RPC 2.0 protocol is over stdio (see `fox acp` command in `fox-code-cli/src/cli/cmd/acp/`)
- VS Code API: `vscode.window.onDidChangeTextEditorSelection`, `vscode.window.onDidChangeActiveTextEditor`

### Acceptance Criteria
- [ ] No metadata message sent more frequently than every 150ms
- [ ] User commands (tool approval, chat input) are never delayed by debounce
- [ ] Existing ACP e2e flow still works (extension ↔ CLI server)

---

## Item 2: Named Shadow Checkpoints & /undo

**Blueprint Reference:** Plan item #4
**Codebase:** `fox-code-cli/packages/core/` (new module) + `fox-code-cli/src/session/` (TUI commands)
**Effort Estimate:** ~1-2 days

### Problem
Fox makes file edits through `apply_patch` and `edit` tools. While the transactional patch engine provides atomic rollback within a single tool call, there's no way to undo a completed tool call's changes or revert to a named checkpoint across multiple tool calls.

### What to Build
1. **Shadow Git Snapshots**: After each successful file mutation, create a lightweight internal checkpoint (git stash or shadow branch — NOT in the user's commit history)
2. **Named Checkpoints**: Allow checkpoints to be named (e.g., `pre-refactor`, `working-state`)
3. **`/undo` TUI Command**: Revert workspace to the most recent checkpoint
4. **`/diff` TUI Command**: Show diff between current workspace state and a named checkpoint

### Design Constraints
- **Never pollute user's git log** — use shadow refs (`refs/fox/checkpoints/*`) or stash-like mechanism
- **Bounded storage** — keep at most N checkpoints (configurable, default 10), evict oldest
- **Don't couple with oscillation detector** — oscillation detection is pure/stateless; snapshots are a separate concern (see priorities doc, risk #4)

### Where to Look
- Transaction journal: [`packages/core/src/transaction.ts`](../../packages/core/src/transaction.ts) — already captures pre-image bytes
- File mutation API: [`packages/core/src/file-mutation.ts`](../../packages/core/src/file-mutation.ts) — the hook point for checkpoint creation
- TUI command registration: `src/session/` slash command infrastructure

### Acceptance Criteria
- [ ] Checkpoint created after each successful `apply_patch` / `edit` tool call
- [ ] `/undo` reverts all files to previous checkpoint state
- [ ] `/diff` shows changes since last checkpoint
- [ ] User's `git log` / `git status` is never affected by checkpoint internals
- [ ] Old checkpoints evicted when limit exceeded

---

## Item 3: Local Open-Weights Model Profiles & Prompts Matrix

**Blueprint Reference:** Plan item #6, Blueprint 12
**Codebase:** `fox-code-cli/src/session/prompt/` + config files
**Effort Estimate:** ~1 day (testing-heavy)

### Problem
Fox works with any OpenAI-compatible endpoint, but different local models (Qwen 2.5 Coder, DeepSeek R1/V3, Llama 3, Codestral, Mistral) have different strengths, context windows, tool-calling conventions, and system prompt sensitivities. There are no curated profiles.

### What to Build
1. **Model family profiles** in a config file (e.g., `prompts.json` or `models.json`):
   - Context window size (for compaction thresholds)
   - Tool calling format (native vs. XML vs. JSON-in-markdown)
   - System prompt length budget
   - Recommended temperature / top_p
   - Known quirks (e.g., "DeepSeek R1 needs explicit tool schema in system prompt")
2. **Auto-detection**: When connecting to a model, attempt to match the model ID against known profiles
3. **Manual override**: `--profile qwen-2.5-coder-32b` or in `fox.jsonc`

### Models to Profile (Priority Order)
1. **Qwen 2.5 Coder** (7B, 14B, 32B) — most popular local coding model
2. **DeepSeek Coder V2 / R1** — strong reasoning, different tool format
3. **Llama 3.1 / 3.2** (8B, 70B) — Meta's general-purpose family
4. **Codestral / Mistral** — Mistral AI's code-focused models
5. **Gemma 2** (9B, 27B) — Google's open model

### Where to Look
- Current model config: [`src/foxcode/config/config.ts`](../../src/foxcode/config/config.ts) — `provider` and `models` schema
- LLM request construction: [`src/session/llm.ts`](../../src/session/llm.ts) and [`src/session/llm/native-request.ts`](../../src/session/llm/native-request.ts)
- System prompt: [`src/session/prompt/default.txt`](../../src/session/prompt/default.txt)
- The [LiteLLM proxy](../../../openai-proxy/) can be used for testing cloud-vs-local routing

### Acceptance Criteria
- [ ] At least 3 model families profiled with tested configurations
- [ ] Auto-detection works for common Ollama model names (e.g., `qwen2.5-coder:32b`)
- [ ] Context window size from profile is used for compaction thresholds
- [ ] Manual `--profile` override works from CLI and `fox.jsonc`
- [ ] Documentation in README listing supported models and recommended configurations

---

## Relationship to Other Phases

These items are **independent of Phase 2A (Guardian)**. They can be done before, during, or after Guardian implementation:

```
Phase 1 Remaining (these items)     Phase 2A (Guardian)
         │                                  │
         │  No dependency                   │
         ▼                                  ▼
   UX/DX improvements              Autonomous loop closure
```

If forced to prioritize one, **Model Profiles (#3)** has the highest user-facing impact — it directly improves the experience for anyone running Fox with local models, which is Fox's core audience.
