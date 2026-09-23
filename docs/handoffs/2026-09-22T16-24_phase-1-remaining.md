# Handoff: Phase 1 Remaining Items

> **Created:** 2026-09-22
> **Status:** Phase 1 Complete in `fox-code-cli` (Items 2 & 3 Done; Item 1 deferred to `fox-acp-client`)
> **Priority:** Phase 2A Unblocked — Guardian Agent Architecture is next
> **Originating Session:** [`188a6acb`](../../.gemini/antigravity-ide/brain/188a6acb-cd0f-451e-873f-af0d1ba57900/walkthrough.md) → Completed in [`009a6611`](../../.gemini/antigravity-ide/brain/009a6611-f490-4be7-b11a-2200bcb4cf34/walkthrough.md)
> **Roadmap Reference:** [`docs/master-plan/`](../master-plan/) — archived from original mega-doc Phase 1 items 3, 4, 6

---

## Context

Phase 1 originally had 7 items. 6 are complete in `fox-code-cli`, and Item 1 is deferred to the VS Code client:

| # | Item | Status |
|---|------|--------|
| 1 | Patch Confidence Scoring (BP 6) | ✅ Done |
| 2 | Incremental AST Caching (BP 1) | ✅ Done |
| 3 | ACP Metadata Debounce & Batching (BP 8) | ⏳ Deferred (`fox-acp-client` VS Code extension) |
| 4 | Named Shadow Checkpoints & `/undo` | ✅ Done (`packages/core/src/checkpoint.ts`, `fox checkpoint`) |
| 5 | Static Tool Closure Resolution (BP 11.1) | ✅ Done |
| 6 | Local Open-Weights Model Profiles (BP 12) | ✅ Done (`model-profiles.json`, `--profile`) |
| 7 | CI Invariant & Compression Gate | ✅ Done (`test:challenge`) |

The implementation details for the completed items and remaining client item are documented below.

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
- [x] Checkpoint created after each successful `apply_patch` / `edit` tool call
- [x] `/undo` reverts all files to previous checkpoint state
- [x] `/diff` shows changes since last checkpoint
- [x] User's `git log` / `git status` is never affected by checkpoint internals
- [x] Old checkpoints evicted when limit exceeded

---

## Item 3: Local Open-Weights Model Profiles & Prompts Matrix

**Blueprint Reference:** Plan item #6, Blueprint 12
**Codebase:** `fox-code-cli/src/session/prompt/` + config files
**Effort Estimate:** ~1 day (testing-heavy)

### Problem
Fox works with any OpenAI-compatible endpoint, but different local models (Llama 3.1/3.3, Codestral/Mistral, Gemma, Nemotron, GPT-OSS) have different strengths, context windows, tool-calling conventions, and system prompt sensitivities. There are no curated profiles.

### What to Build
1. **Model family profiles** in a config file (e.g., `model-profiles.json`):
   - Context window size (for compaction thresholds)
   - Tool calling format (native vs. XML vs. JSON-in-markdown)
   - System prompt length budget
   - Recommended temperature / top_p
   - Known quirks (e.g., prompt hints or tool-calling hints)
2. **Auto-detection**: When connecting to a model, attempt to match the model ID against known profiles
3. **Manual override**: `--profile <name>` or in `fox.jsonc`

### Models Profiled (Non-Chinese Open-Weights Focus)
1. **Meta Llama 3.1 / 3.3** (8B, 70B) — Meta's open weights (`llama-3.1`, `llama-3.3`)
2. **Mistral Codestral / Mistral** (22B, 2508) — Mistral AI code models (`codestral`, `mistral`)
3. **Google Gemma 2 / 4** (9B, 27B, 31B) — Google open weights (`gemma`)
4. **Nvidia Nemotron 3 / 4** (Ultra 550B, etc.) — Nvidia open weights (`nemotron`)
5. **OpenAI GPT-OSS 120B** — Open weights (`gpt-oss`)

### Where to Look
- Current model config: [`src/foxcode/config/config.ts`](../../src/foxcode/config/config.ts) — `provider` and `models` schema
- LLM request construction: [`src/session/llm.ts`](../../src/session/llm.ts) and [`src/session/llm/request.ts`](../../src/session/llm/request.ts)
- System prompt: [`src/session/prompt/local.txt`](../../src/session/prompt/local.txt) and [`src/session/prompt/model-profiles.json`](../../src/session/prompt/model-profiles.json)
- The [LiteLLM proxy](../../../openai-proxy/) can be used for testing cloud-vs-local routing

### Acceptance Criteria
- [x] At least 3 model families profiled with tested configurations
- [x] Auto-detection works for common Ollama model names (e.g., `llama3.1:8b`, `codestral:22b`, `gemma2:9b`, `nemotron:latest`, `gpt-oss:120b`)
- [x] Context window size from profile is used for compaction thresholds
- [x] Manual `--profile` override works from CLI and `fox.jsonc`
- [x] Documentation in README listing supported models and recommended configurations

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
