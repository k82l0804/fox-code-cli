**Since you control only the agent CLI source code** (and not the hosted local model servers), all meaningful speedups come from reducing the volume and redundancy of tokens the agent *sends* on every turn, while keeping the information lossless or fully recoverable. Prefill cost on large 128K-context models is expensive; every unnecessary token hurts TTFT and overall iteration time.

Here are the highest-leverage, practical changes you can implement in the agent code itself.

### 1. Aggressive, Lossless Tool-Output Hygiene (Biggest Immediate Win)
Tool/command results are usually the main source of bloat.

- **Filter at the source inside the tool wrappers**:
  - Prefer terse flags: `git status --porcelain` / `--short`, `npm test --silent`, `cargo test --quiet`, `pytest -q`, etc.
  - Pipe through filters that keep only signal (errors, failures, changed files, summaries). Examples: keep FAIL/ERROR lines + stack traces; drop progress bars, successful test checkmarks, decorative output.
  - Cap raw output length hard (e.g. 4k–8k characters) and return a clear truncation notice + suggestion to refine the command. The model can re-query if needed.

- **Store full output locally, return a pointer or summary**:
  - Write the complete tool result to a content-addressed local store (file, SQLite FTS5, or simple key-value).
  - Return to the model only a short summary + retrieval key (e.g. `[full output stored as key=abc123; call retrieve_tool_output if needed]`).
  - This is fully lossless: the agent can fetch the original on demand. Projects like Context Mode, squeez, and Headroom-style layers do exactly this and report 80–98% reductions on noisy commands (tests, logs, git, ls, etc.).

- **Command-specific compressors**: Maintain a small map of known commands → deterministic filters/deduplicators. This is pure code, zero quality loss, and very effective.

### 2. Context / History Management Strategies (Client-Side)
Implement these in the prompt-assembly / message-history layer:

- **Age-aware or role-aware truncation of tool results**: Keep recent tool outputs fully (or with light caps); aggressively truncate or drop older ones while preserving the tool-call itself and the model’s reasoning. Re-apply the view each turn so the underlying history stays complete.
- **Sliding window + pinned anchors**: Always keep the original user goal, key decisions, and the most recent N turns. Drop or summarize older exploration.
- **Lossless structured compression for data the agent reads**:
  - For JSON/CSV/logs/tables: convert to compact reversible formats (codebooks, TOON-style, or simple columnar) that decode back exactly.
  - For code: prefer AST/signature views or tree-sitter-derived skeletons over full files when possible; only expand the specific functions/symbols needed.
- **Reversible compaction**: When you must compress history, store the full original turns locally and inject a compact summary + retrieval markers. The model can request the full history if it needs it.
- **Stable system prompt + tool schemas**: Keep them completely identical across turns so any server-side prefix caching (if the host supports it) can hit. Avoid injecting dynamic timestamps or varying tool lists every call.

Many open agents (OpenHands condensers, Cline’s auto-compact, Claude Code’s `/compact`, etc.) already do variants of the above. Port the patterns that fit your architecture.

### 3. Smarter Context Assembly (Avoid Dumping Whole Files)
- Prefer **search → selective read** over reading entire files or directories. Give the model a symbol/definition map or repo map (tree-sitter or simple graph ranking) first; only inject full content for the precise ranges it requests.
- Structure-first reads: return function signatures, class outlines, or dependency graphs before full source.
- Deduplicate across turns: if the same file or tool result appears again, send a reference instead of re-pasting.

### 4. Prompt & Tool Definition Hygiene
- Minimize the size of the system prompt and tool schemas. Load tool definitions lazily or progressively if your architecture allows.
- Force concise model behavior via the system prompt or a “terse mode” (many agents ship a “Caveman”-style skill that cuts output tokens 50–65% with no accuracy loss on coding tasks).
- Prefer structured edit formats (search/replace, minimal diffs, apply_patch) over asking the model to emit whole files.

### 5. Implementation Patterns That Work Well in Agent CLIs
- Hook points: Pre-tool-execution (rewrite command or wrap output), post-tool (compress before appending to history), and pre-LLM-call (transform the entire message list into a compressed *view* while keeping the full log).
- Local side-car storage + retrieval tools: Give the model a `retrieve_full_output(key)` or `search_past_tool_results(query)` tool. This keeps the active context small forever.
- Token budgeting: Estimate tokens before every call and apply progressive compression until under a soft limit (still leaving headroom inside the 128K window).
- Benchmark the actual agent loop (not synthetic prompts). Measure tokens per turn, TTFT impact (you can approximate by request size), and end-to-end task time.

### Expected Impact
- Tool-output filtering + capping alone commonly cuts 40–60% of input tokens on real coding sessions.
- Adding local storage + pointers / reversible compression routinely reaches 70–95% reduction on the noisy parts (tests, logs, large files, repeated history).
- Combined with better history management, agent iterations become dramatically cheaper in both tokens and wall-clock time even when the underlying model is fixed and slow.

These changes are entirely under your control in the CLI source, remain lossless (or fully recoverable), and compound with whatever the hosted models already do. Start with tool-output filtering and local full-output storage—they give the fastest, safest wins.