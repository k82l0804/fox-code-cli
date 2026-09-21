# Fox Code CLI — Code Removal Plan (Lean & Mean)

> **Context:** Fox is moving to a national security R&D lab environment.
> **Model strategy:** Local OpenAI-compatible models only (via openai-proxy/LiteLLM).
> **Kept:** GitLab (local instance), web search, MCP, local providers.
> **Removed:** All cloud services (Anthropic, GitHub, OpenAI cloud, Codex, Modal), all migration code, all Kilo backward compat.

---

## Removal Summary

| Category | Files | Lines | Risk |
|---|:---:|:---:|:---:|
| 1. Cloud provider plugins | 4 | ~1,099 | Low |
| 2. Migration code (Claude, Kilo) | 9 | ~2,437 | Low |
| 3. Claude/Codex session resume | 1 | ~632 | Medium |
| 4. Dev/debug (non-production) | 3 | ~2,873 | Low |
| 5. Kilo-vs-Fox comparison tools | 3 | ~1,825 | None |
| 6. Cloud provider transforms | 1 | ~1,000 | High |
| 7. Kilo backward compat aliases | ~10 | ~150 | Low |
| **Total** | **~31** | **~10,000+** | |

---

## Category 1: Cloud Provider Plugins

Remove entirely — cloud-only services that won't exist in a lab environment.

| File | Lines | What It Is |
|---|:---:|---|
| `src/plugin/openai/codex.ts` | 664 | OpenAI Codex plugin (cloud ChatGPT API, OAuth, WebSocket pool) |
| `src/plugin/openai/ws-pool.ts` | 278 | WebSocket connection pool for Codex streaming |
| `src/plugin/modal/modal.ts` | 21 | Modal.com cloud compute plugin |
| `src/plugin/modal/models.ts` | 136 | Modal model catalog |
| **Subtotal** | **1,099** | |

> **Keep** `src/plugin/openai/openai.ts` and `src/plugin/openai/index.ts` if they handle the standard OpenAI-compatible API (which LiteLLM exposes). Verify before deleting the entire `openai/` directory.

---

## Category 2: Migration Code

Remove entirely — no users migrating from Claude Code, Kilo, or opencode.

| File | Lines | What It Is |
|---|:---:|---|
| `src/foxcode/config/claude-migration.ts` | 962 | One-time Claude Code → Fox config import |
| `src/foxcode/ignore-migrator.ts` | 225 | `.kiloignore` → `.foxignore` |
| `src/foxcode/mcp-migrator.ts` | 180 | Kilo MCP config → Fox MCP config |
| `src/foxcode/modes-migrator.ts` | 224 | Kilo modes → Fox modes |
| `src/foxcode/rules-migrator.ts` | 153 | Kilo rules → Fox rules |
| `src/foxcode/workflows-migrator.ts` | 159 | Kilo workflows → Fox workflows |
| `src/foxcode/docs/migration.md` | 389 | Migration documentation (checked into `src/`) |
| `src/foxcode/docs/rules-migration.md` | ~23 | Rules migration docs |
| `src/foxcode/provider/codex-refresh.ts` | 122 | Codex OAuth token refresh |
| **Subtotal** | **~2,437** | |

---

## Category 3: Claude/Codex Session Resume

Remove the Claude/Codex format support from session resume. Keep the core resume infrastructure (it's useful for local sessions).

| File | Lines | Action |
|---|:---:|---|
| `src/foxcode/session-resume/import.ts` | 632 | Remove `claude` and `codex` format handlers; keep Fox-native resume |

Also remove the `/resume-claude` and `/resume-codex` slash commands from `src/session/prompt.ts`.

---

## Category 4: Dev/Debug (Non-Production)

Remove from production builds. Extract demo event factories to `test/fixtures/` first.

| File | Lines | What It Is |
|---|:---:|---|
| `src/cli/cmd/run/demo.ts` | 1,274 | Hidden `--demo` flag, synthetic event generator |
| `src/foxcode/plugins/session-v2-debug.tsx` | 1,227 | Session v2 debug plugin (dev-only) |
| `src/foxcode/review/review.txt` | 372 | Review notes checked into source |
| **Subtotal** | **2,873** | |

---

## Category 5: Kilo-vs-Fox Comparison Tools

Remove entirely — historical comparison, Fox won.

| File | Lines |
|---|:---:|
| `tools/fork-showdown-kilo-vs-unoptimized-fox.sh` | 459 |
| `tools/fox-vs-kilo-realworld-eval.sh` | 506 |
| `tools/fox-vs-kilo-showdown.ts` | 860 |
| **Subtotal** | **1,825** |

---

## Category 6: Cloud Provider Transforms

Surgically remove cloud-provider-specific transforms from `transform.ts`. Keep the OpenAI-compatible transform.

| File | Lines | Action |
|---|:---:|---|
| `src/provider/transform.ts` | 1,268 | Remove transforms for: Anthropic, Google/Gemini, Bedrock, Vertex, Mistral, Groq, DeepSeek, OpenRouter, xAI, Cerebras, Fireworks, Together, SambaNova, Copilot. **Keep** OpenAI-compatible transform. |

> **This is the highest-risk removal.** The transform file has 50+ references to cloud providers woven throughout. Do this as a separate PR with typecheck verification.

Also consider:

| File | Lines | Action |
|---|:---:|---|
| `src/session/llm.ts` | ~20 | Remove `GitLabWorkflowLanguageModel` class and `instanceof` checks (this is for *cloud* GitLab Duo, not your local GitLab) |

---

## Category 7: Kilo Backward Compat Aliases

Remove all `KILO_*` env var aliases, `kilo.json`/`opencode.json` config file support, `.kilo`/`.kilocode` directory suffixes.

| Location | What to Remove |
|---|---|
| `src/index.ts` | `KILO_PRINT_LOGS`, `KILO_LOG_LEVEL`, `KILO_PURE`, `KILO_PID`, `KILO_CLIENT` env vars |
| `src/foxcode/config/config.ts` | `kilo.jsonc`, `kilo.json`, `opencode.jsonc`, `opencode.json` config file support |
| `src/foxcode/config/config.ts` | `.kilo`, `.kilocode` config directory suffixes |
| `bin/fox` | `KILO_CLIENT: "cli"` env var |
| Various | Any `KILO_*` references found via `git grep "KILO_"` |

---

## What We're KEEPING

| Component | Why |
|---|---|
| GitLab provider (local instance) | PR/MR workflows |
| Web search | Active feature |
| OpenAI-compatible provider | LiteLLM proxy at `localhost:8000/v1` |
| MCP | Tool ecosystem — local MCP servers |
| LSP | Language server support |
| Sandbox | Security isolation |
| Session/Tool/Prompt core | Core orchestration |
| TUI | Interactive interface |
| CLI | Command-line interface |
| Compression pipeline | Token optimization |
| All tests | Existing test coverage |
| Benchmark tools (except kilo-vs-fox) | Performance measurement |

---

## Execution Order

```
Step 1: Category 5 (comparison tools)     — safest, zero imports, just delete
Step 2: Category 4 (dev/debug)            — extract demo fixtures to test/ first
Step 3: Category 2 (migration code)       — delete files, remove callers
Step 4: Category 1 (cloud plugins)        — delete files, remove plugin registrations
Step 5: Category 7 (kilo compat)          — search and replace across codebase
Step 6: Category 3 (session resume)       — surgical edit, keep Fox-native resume
Step 7: Category 6 (provider transforms)  — highest risk, separate PR, full typecheck
```

After each step: `timeout 45s bun run typecheck`

---

## Verification

After all removals:
```bash
timeout 45s bun run typecheck        # Must pass clean
timeout 180s bun run test            # All existing tests must pass
timeout 60s bun run build            # Production build must succeed
```
