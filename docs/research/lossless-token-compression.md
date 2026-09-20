# Lossless Token Compression for Local LLMs

> **Status:** Research / Pre-RFC  
> **Date:** 2026-09-19  
> **Scope:** Fox CLI (`fox-code-cli`) agentic loop  
> **Audience:** Fox contributors, future implementation planning

---

## 1. Problem Statement

Fox CLI orchestrates multi-turn agentic sessions where every request to the LLM carries:

1. A **system prompt** (instructions, rules, project context)
2. **Tool schemas** (~20 registered tools, serialized as JSON Schema)
3. The full **conversation history** (prior assistant messages, tool calls, tool outputs)

While Fox is primarily a **coding agent**, its workloads extend beyond software engineering:

| Workload | Typical Context Payload |
|:---|:---|
| **Software Engineering** | Source files, diffs, compiler output, grep results, git status |
| **Data Analysis** | CSV/JSON datasets, SQL query results, statistical summaries, chart descriptions |
| **Research Paper Analysis** | Paper abstracts, citation graphs, methodology sections, extracted tables |
| **Documentation & Technical Writing** | Markdown files, API specs, changelog entries |
| **DevOps & Infrastructure** | Log files, YAML configs, Terraform state, container output |

All of these workloads share a common bottleneck: **redundant tokens in the prompt**.

With cloud models (Gemini, Claude), the cost is dollars per million tokens. With **local models** (Llama 3.3 70B, Nemotron, Codestral via llama.cpp / vLLM), the cost is **GPU time**: every input token must be prefilled through the model's attention layers before the first output token is generated. On a single A100, prefilling 8,000 tokens takes ~2–4 seconds; prefilling 4,000 takes ~1–2 seconds.

**Goal:** Reduce the input token count sent to local LLMs on every request — without losing any information the model needs to produce correct outputs — thereby cutting Time-To-First-Token (TTFT) and extending effective context window utilization across all workload types.

---

## 2. Definitions

| Term | Meaning |
|:---|:---|
| **Lossless** | Zero semantic information lost. The model receives every fact, constraint, and structural detail it would have received without compression. |
| **Semantically lossless** | The _meaning_ is preserved but the _representation_ changes (e.g., a stale `git status` output is replaced with `[superseded by step N]` — the current state is already in a later message). |
| **TTFT** | Time-To-First-Token — the latency before the model begins streaming its response. Dominated by prefill cost on local GPUs. |
| **KV-Cache** | Key-Value cache in the transformer's attention layers. Local engines (vLLM, llama.cpp, SGLang) can reuse cached prefixes across requests if the byte sequence is identical. |

---

## 3. Current State in Fox CLI

### 3.1 Tool Schema Serialization

Tools are defined via `Tool.make()` in [`packages/core/src/tool/tool.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/tool/tool.ts#L71-L131). Each tool produces a `ToolDefinition` (name, description, inputSchema as JSON Schema) that is serialized into the OpenAI wire format by [`ToolSchemaProjection.openAI()`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/llm/src/protocols/utils/tool-schema.ts#L18-L34).

The projection already performs one optimization: it flattens `anyOf` variants and strips `null` schemas. However, it does **not**:
- Remove redundant `additionalProperties: false` keys
- Strip self-evident parameter descriptions
- Compact nested `$defs` references
- Provide a compact (non-JSON-Schema) representation for local models

**Estimated overhead:** ~20 tools × ~150–250 tokens each = **3,000–5,000 tokens per request**.

### 3.2 Context Compaction

Fox already has a compaction system in [`src/session/message-v2.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/message-v2.ts#L80-L84) and [`src/session/overflow.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/overflow.ts). This system:

- **Truncates tool outputs** via `truncateToolOutput()` when compacting (char-level slice with `[Tool output truncated]` marker)
- **Clears old tool results** by replacing them with `"[Old tool result content cleared]"` when `part.state.time.compacted` is true
- **Triggers compaction** when token count exceeds `model.limit.input - COMPACTION_BUFFER` (buffer = 20,000 tokens)
- **Respects `compaction.auto`** config to allow users to disable automatic compaction

This is a **lossy, reactive** system — it kicks in only when the context overflows. The strategies below are **proactive** and **lossless**, reducing tokens on every request from turn 1.

### 3.3 LLM Request Pipeline

Requests flow through [`packages/llm/src/schema/messages.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/llm/src/schema/messages.ts#L256-L269) → protocol-specific lowering in [`openai-chat.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/llm/src/protocols/openai-chat.ts#L179-L186) or [`openai-responses.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/llm/src/protocols/openai-responses.ts). The `lowerTool()` function is the natural intercept point for schema minification.

---

## 4. Proposed Strategies

### 4.1 Tool Schema Minification

**Classification:** Lossless  
**Token savings:** 2,000–4,000 tokens / request  
**TTFT impact:** Instant (reduces prefill on every turn)  
**Effort:** Low

#### Problem

A standard JSON Schema tool definition includes significant boilerplate:

```json
{
  "name": "read",
  "description": "Read file contents from local disk",
  "parameters": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "The absolute or relative path to the file to read"
      },
      "offset": {
        "type": "integer",
        "description": "The line offset to start reading from",
        "minimum": 0
      }
    },
    "required": ["path"],
    "additionalProperties": false
  }
}
```

Across ~20 tools, this produces 3,000–5,000 tokens of schema boilerplate on _every single request_.

#### Proposed Solution

**A. Strip redundant metadata** (lossless for all models):
- Remove `$schema`, `additionalProperties: false`, redundant `title` tags
- Remove self-describing parameter descriptions (e.g., `path` of type `string` doesn't need `"description": "The path"`)
- Collapse single-variant `anyOf` wrappers (already partially done in `ToolSchemaProjection`)

**B. Compact schema serializer** (for local models only):
- Serialize tool signatures as TypeScript-like compact strings:
  ```
  read(path: string, offset?: int): string
  ```
- This cuts a ~200-token JSON Schema definition down to ~15 tokens — a **13x reduction**

**C. Dynamic tool masking** (lossless, agent-profile-aware):
- Only send schemas for tools the current agent profile actually uses
- If the agent is `review`, do not serialize `write`, `edit`, `patch`, or `git_commit` schemas
- This is orthogonal to A/B and stacks multiplicatively

#### Implementation Anchor

The intercept point is [`lowerTool()`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/llm/src/protocols/openai-chat.ts#L179-L186) in each protocol adapter. A new `ToolSchemaProjection.compact()` method in [`tool-schema.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/llm/src/protocols/utils/tool-schema.ts) could provide the minified representation, selected based on a `local: true` flag in the provider config.

---

### 4.2 Common Prefix Path Compression

**Classification:** Lossless  
**Token savings:** 300–1,000 tokens per tool call  
**TTFT impact:** ~20% reduction on tool-heavy turns  
**Effort:** Low

#### Problem

Tool outputs from `grep`, `glob`, `find`, compiler errors, and `git status` repeat long workspace paths:

```
/home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/tool/shell.ts: Line 15
/home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/tool/read.ts: Line 22
/home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/tool/write.ts: Line 8
```

Each occurrence of the workspace prefix (`/home/k82l0804/workarea/fox/fox-code-cli/`) costs ~12–15 tokens. Across a 50-line grep result, that is **~750 wasted tokens**.

#### Proposed Solution

Normalize tool outputs to workspace-relative paths:

```
[CWD: /home/k82l0804/workarea/fox/fox-code-cli]
packages/core/src/tool/shell.ts: Line 15
packages/core/src/tool/read.ts: Line 22
packages/core/src/tool/write.ts: Line 8
```

Zero information lost. The workspace root is stated once; all paths become relative. Savings: **~70% of path tokens**.

#### Implementation Anchor

Each tool's `toModelOutput()` callback (or a shared post-processor in the tool execution pipeline) would apply `path.relative(workspaceRoot, absolutePath)` before returning text content. The workspace root is already available via the `Location` service.

---

### 4.3 KV-Cache Alignment & Static Prefix Pinning

**Classification:** Lossless  
**Token savings:** 100% prefill bypass on cached prefix  
**TTFT impact:** 10x–50x speedup on cached system prompt  
**Effort:** Medium

#### Problem

Local inference engines (vLLM, llama.cpp, Ollama, SGLang) implement Radix Tree / Prompt Prefix Caching. If the byte-prefix of a new request is 100% identical to a previous request, the engine reuses the cached KV tensors — effectively evaluating **0 tokens** for that prefix.

**Anti-pattern:** If any dynamic metadata is injected into the system prompt — timestamps, step counters (`Step 3/10`), variable token counts, git branch names — the KV cache is invalidated from that injection point onward. The GPU re-evaluates the entire system prompt from scratch on every turn.

#### Proposed Solution

1. **Freeze the static prefix:** System prompt + tool schemas + project rules must be byte-identical across all turns in a session
2. **Push ephemeral data to the tail:** Dynamic data (current step, git branch, recent summaries) goes into the user message — at the end of the prompt, after the cached prefix
3. **Stable tool ordering:** Tool schemas must be serialized in a deterministic order (alphabetical by name) to avoid cache invalidation from tool registration order changes

#### Implementation Anchor

The system prompt is assembled in [`src/session/prompt.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt.ts). Any dynamic injections into the system parts array would need to be audited and relocated to user message content. The cache policy in [`packages/llm/src/cache-policy.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/llm/src/cache-policy.ts) already has infrastructure for marking cache boundaries — this could be extended to enforce prefix stability.

---

### 4.4 Tool Output Superseding (Historical Deduplication)

**Classification:** Semantically lossless  
**Token savings:** 1,000–5,000 tokens in multi-step sessions  
**TTFT impact:** Up to 40% context savings on long sessions  
**Effort:** Medium

#### Problem

During a multi-turn agentic loop:

| Step | Action | Tokens |
|:---|:---|:---:|
| 1 | Agent runs `git status` | +500 |
| 2 | Agent edits `foo.ts` | +200 |
| 3 | Agent runs `git status` again | +500 |

The output of `git status` from Step 1 is now **factually obsolete** — Step 3's output fully supersedes it. But the Step 1 output remains in the conversation history, forcing the model to process 500 stale tokens on Steps 3, 4, 5, etc.

Similarly: if the agent reads a file in Step 1, then edits it in Step 2, the Step 1 read output is partially stale. Keeping the full pre-edit content in context wastes tokens and can confuse the model.

#### Proposed Solution

When a tool is re-invoked (same tool name, same primary argument like file path), or when an edit supersedes a previous read:

1. **Retain the tool call record** (preserves conversation flow)
2. **Replace the historical output** with a compact marker:
   ```
   [Output superseded by step 3]
   ```
3. **Apply only to idempotent/read-like tools:** `git_status`, `read`, `glob`, `grep`, `bash` (for diagnostic commands). Never supersede write/edit tool outputs.

#### Implementation Anchor

Fox's compaction system already replaces old tool outputs with `"[Old tool result content cleared]"` (see [`message-v2.ts:397-398`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/message-v2.ts#L397-L398)). The superseding logic would be a more targeted version of this — applied proactively per-tool-type rather than reactively on overflow. A `SupersessionPolicy` per tool (configured in `Tool.make()`) would declare whether a tool's output can be superseded when re-invoked with the same arguments.

---

### 4.5 AST-Aware Code & Diff Compaction

**Classification:** Lossless (whitespace normalization) / Semantically lossless (diff trimming)  
**Token savings:** 30–50% of diff/code tokens  
**TTFT impact:** ~30% on code review and edit turns  
**Effort:** Low

#### Problem

Statistical token compressors (like LLMLingua) randomly drop words based on perplexity scores. This is **catastrophic for code** — dropping a closing brace, a semicolon, or an import statement produces invalid syntax that the model then hallucinates around.

#### Proposed Solution (Syntax-Safe)

**A. Whitespace & blank line normalization:**
- Collapse `\n\n\n+` → `\n\n` (multiple consecutive blank lines to one)
- Normalize 4-space indentation → 2-space for files read into context (lossless for model interpretation)
- Strip trailing whitespace on every line

**B. Diff context trimming:**
- Git defaults to 3 lines of unchanged context above and below each hunk (`-U3`)
- For tool-generated diffs, reduce to 1 line (`-U1`), which is mathematically sufficient for unique line anchoring
- Savings: **40–50%** of diff token count

#### Implementation Anchor

Diff context is controlled wherever Fox generates unified diffs for tool output (e.g., after `edit` or `write` operations). The whitespace normalization would be a post-processor on the `read` tool's `toModelOutput()`.

---

### 4.6 Indexing-Aware Context Retrieval

**Classification:** Lossless (retrieval selection) / Semantically lossless (chunk summarization)  
**Token savings:** 2,000–10,000+ tokens per turn (vs. naive full-file inclusion)  
**TTFT impact:** Proportional to token savings  
**Effort:** Medium (depends on indexing maturity)

#### Problem

Without indexing, the agent's primary strategy for understanding a codebase or document corpus is to `read` entire files and `grep` for patterns. This pulls large volumes of irrelevant content into the context window:

- Reading a 500-line file to find one 10-line function: ~490 lines wasted
- Grepping across a project returns dozens of partial matches with full surrounding context
- For non-code workloads (research papers, data files), the problem is worse — a 20-page PDF converted to text may be 8,000+ tokens when only 500 tokens of specific methodology are relevant

#### Proposed Solution

Fox CLI already has an indexing infrastructure via the [`@foxcode/indexing`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/fox-indexing/src/engine.ts) package. The `CodeIndexManager` supports vector search via `searchIndex(query, directoryPrefix)` which returns ranked `VectorStoreSearchResult` items with `Payload` containing `filePath`, `codeChunk`, `startLine`, and `endLine`.

When indexing is enabled, the compression pipeline can:

1. **Retrieve targeted chunks** instead of full files — the vector store returns only the relevant code/text chunks with their exact line ranges
2. **Deduplicate retrieved chunks** — if multiple queries return overlapping file regions, merge them instead of including duplicates
3. **Rank-and-budget** — given a token budget, include the top-K most relevant chunks rather than all results. Lower-scored results can be represented as summaries: `[Also relevant: engine.ts:40-54 (score: 0.72)]`
4. **Cross-workload applicability:**
   - **Code:** Retrieve specific functions/classes instead of full files
   - **Research papers:** Index by section (abstract, methodology, results); retrieve only the section the user asks about
   - **Data analysis:** Index column schemas and sample rows; avoid loading full datasets into context

#### Implementation Anchor

The `CodeIndexManager` in [`packages/fox-indexing/src/engine.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/fox-indexing/src/engine.ts) is currently a stub with disabled status. When fully enabled, the `searchIndex()` results should feed into a `ContextBudgetAllocator` that decides how many tokens to spend on each retrieved chunk based on relevance score and remaining budget.

---

### 4.7 Structured Data & Document Compression

**Classification:** Lossless to semantically lossless (depending on technique)  
**Token savings:** 40–80% on tabular data; 30–60% on documents  
**TTFT impact:** Proportional to token savings  
**Effort:** Low–Medium

#### Problem

Non-code workloads inject structured and semi-structured data into the context that has significant compression potential:

**Tabular data (CSV, SQL results, JSON arrays):**
```json
[{"name": "Alice", "age": 30, "city": "NYC"}, {"name": "Bob", "age": 25, "city": "LA"}, {"name": "Carol", "age": 35, "city": "NYC"}]
```
The key names (`name`, `age`, `city`) are repeated for every row. With 100 rows, key repetition alone wastes ~1,500 tokens.

**Research papers / long documents:**
Full text of a 20-page paper may be 8,000+ tokens. Often only the abstract, a specific methodology section, or a results table is relevant to the user's query.

#### Proposed Solution

**A. Columnar table encoding** (lossless):
Convert repeated-key JSON arrays to a header + rows format:
```
Columns: name | age | city
Alice | 30 | NYC
Bob | 25 | LA
Carol | 35 | NYC
```
This eliminates key repetition entirely. For a 100-row result set: **~60% token reduction**.

**B. JSON key shortening** (lossless with legend):
For deeply nested JSON (API responses, config dumps):
```
[Legend: n=name, a=age, c=city]
[{n:"Alice",a:30,c:"NYC"}, ...]
```

**C. Document sectioning with selective inclusion** (semantically lossless):
For research papers and long documents, instead of including full text:
1. Include the full abstract/summary (high information density)
2. Include the table of contents / section headers
3. Include only the specifically-requested sections in full
4. Summarize remaining sections as one-line descriptions:
   ```
   [Section 3.2 - Experimental Setup: 2,400 words - describes GPU cluster config and hyperparameters]
   ```

**D. Log file compression** (lossless):
Repetitive log output (build logs, test output, container logs) can be compressed by:
- Deduplicating identical lines with count: `[×47] npm WARN deprecated package@1.0.0`
- Collapsing success lines: `[142 tests passed]` instead of 142 individual `✓ test_name` lines
- Keeping only the first and last N lines of repetitive output with `[... 340 similar lines omitted ...]`

#### Implementation Anchor

This would be a set of format-specific post-processors applied in the tool output pipeline, keyed by content type detection (JSON array → columnar; `.csv` → columnar; `.md`/`.pdf` → sectional; `.log` → dedup). The `toModelOutput()` callback in each tool already provides the hook point.

---

## 5. Savings Summary

| # | Strategy | Workloads | Token Reduction | TTFT Impact | Effort | Type | Risk |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| 4.1 | Tool Schema Minification | All | 2,000–4,000 / req | 2x–3x TTFT | Low | Lossless | **Medium** — models are trained on JSON Schema tool use; stripping keys (A) is low-risk, but compact signatures (B) may break tool-calling for models that expect strict JSON Schema |
| 4.2 | Path Prefix Normalization | SWE, DevOps | 300–1,000 / tool call | ~20% | Low | Lossless | **Low** — only changes tool output text, not schema format; models already handle relative paths |
| 4.3 | KV-Cache Prefix Freezing | All | 100% prefill bypass | 10x–50x on prefix | Medium | Lossless | **Low** — no model-facing change; purely an infrastructure concern about prompt assembly discipline |
| 4.4 | Tool Output Superseding | All | 1,000–5,000 / session | Up to 40% context | Medium | Sem. lossless | **Medium** — replacing historical outputs with `[superseded]` markers may confuse models that reference prior tool results by position; needs careful per-tool policy |
| 4.5 | Diff Context Trimming | SWE | 30–50% of diffs | ~30% on review | Low | Lossless | **Low** — `-U1` diffs are valid unified diffs; models handle them correctly since the format is standard |
| 4.6 | Indexing-Aware Retrieval | All | 2,000–10,000+ / turn | Proportional | Medium | Lossless | **Low** — retrieval selection is transparent to the model; it simply sees less content, not different format |
| 4.7 | Structured Data Compression | Data, Research, DevOps | 40–80% on tables/logs | Proportional | Low–Med | Lossless | **Low–Med** — columnar encoding and log dedup change output format; most models handle tables well, but some may struggle with non-standard formats |

**Risk Legend:**
- **Low:** No change to model-facing schema/protocol; output content changes only. Safe to ship without extensive compatibility testing.
- **Medium:** Changes tool schema format or conversation structure. Models trained on specific formats (e.g., OpenAI function calling with JSON Schema) may degrade. Requires per-model validation.
- **High:** Fundamentally alters how the model interacts with tools. Would require fine-tuning or prompt engineering to compensate.

> [!WARNING]
> **The biggest risk is strategy 4.1B (compact TypeScript-like tool signatures).** Most local models (Llama 3.x, Mistral, Codestral) are fine-tuned on OpenAI-format JSON Schema tool definitions. Replacing schemas with `read(path: string, offset?: int): string` may cause the model to emit free-form text instead of structured tool calls. Strategy 4.1A (stripping redundant JSON Schema keys while keeping the format) is much safer and should be tested first.

**Combined potential on a 10-turn local session:** 8,000–25,000+ fewer input tokens, with KV-cache hits eliminating prefill entirely for the static prefix (~50–70% of the prompt). Non-SWE workloads (data analysis, research) benefit disproportionately from strategies 4.6 and 4.7 due to their high ratio of structured/repetitive content.

---

## 6. Recommended Implementation Order

**Phase 1 — Quick Wins (all workloads):**

1. **4.2 Path Prefix Normalization** — Lowest risk, immediate win, no protocol changes. Shared tool output post-processor.

2. **4.1 Tool Schema Minification** — High impact, low effort. Start with stripping redundant JSON Schema keys (solution A) which is safe for all models. The compact signature format (solution B) requires a `local` model flag.

3. **4.5 Diff Context Trimming** — Small, surgical change. Swap `-U3` to `-U1` in diff generation for tool outputs.

4. **4.7 Structured Data Compression** — Columnar encoding for tabular data and log deduplication. These are simple post-processors that benefit data analysis and DevOps workloads immediately.

**Phase 2 — Infrastructure (all workloads):**

5. **4.3 KV-Cache Prefix Freezing** — Requires auditing `prompt.ts` for dynamic injections and enforcing byte-stable system prompt assembly. Higher effort but massive payoff for local inference.

6. **4.4 Tool Output Superseding** — Requires per-tool supersession policy, argument hashing, and careful handling of partially-stale outputs. Implement after Phase 1 strategies prove value.

**Phase 3 — Indexing Integration (when `@foxcode/indexing` is fully enabled):**

7. **4.6 Indexing-Aware Retrieval** — Depends on the indexing pipeline being production-ready. Once enabled, this becomes the highest-impact strategy for all workloads, replacing naive full-file reads with targeted chunk retrieval.

---

## 7. Evaluation Framework

Each compression strategy must be validated for both **performance** (token savings, latency) and **accuracy** (does the agent still produce correct results?). The accuracy problem is harder because LLM outputs are stochastic — even with temperature=0, different prompt content produces different outputs. We need to define what "same result" means.

### 7.1 Accuracy Measurement: Three Layers

Accuracy is measured at three layers, from cheapest to most expensive:

**Layer 1 — Deterministic checks (automated, binary pass/fail):**
- Does the code compile? (`bun run typecheck` passes)
- Do unit tests pass? (`bun run test` passes)
- Does the expected file exist with expected content?
- Did all tool calls parse correctly? (no malformed JSON, no missing required args)
- Did the agent complete within the turn limit?

These are cheap, fast, and unambiguous. They catch catastrophic failures but miss subtle quality degradation.

**Layer 2 — Structural assertions (automated, task-specific):**
- Does the modified file contain the expected function signature?
- Is the diff within expected size bounds?
- Does the output match a regex pattern?
- Are the same tools called in roughly the same order?
- Is the total turn count within ±N of baseline?

These are defined per benchmark task and catch "the agent did something but did the wrong thing."

**Layer 3 — LLM-as-judge (semantic evaluation):**

Use a **separate frontier model** (not the one being tested) to evaluate the agent's output against the baseline output:

```
Judge prompt:
You are evaluating whether two coding agent sessions produced equivalent results.

TASK: {task_description}

BASELINE OUTPUT (no compression):
{baseline_session_transcript}

TEST OUTPUT (with compression strategy {strategy_name}):
{test_session_transcript}

Rate the test output on these dimensions:
1. CORRECTNESS: Did the agent produce functionally equivalent code? (1-5)
2. COMPLETENESS: Did the agent address all aspects of the task? (1-5)
3. EFFICIENCY: Did the agent take a reasonable number of steps? (1-5)
4. TOOL_USE: Were tool calls well-formed and appropriate? (1-5)

OVERALL VERDICT: EQUIVALENT / DEGRADED / FAILED
EXPLANATION: (brief rationale)
```

The judge model should be a **different model** from the one being tested (e.g., if testing Llama 3.3 70B with compression, use Gemini or Claude as judge). This avoids self-evaluation bias.

### 7.2 Benchmark Task Suite

A standardized set of tasks that exercise different agent capabilities. Each task has a prompt, acceptance criteria, and expected behavior:

**Tier 1 — Simple (single tool, 1–3 turns):**

| Task ID | Prompt | Deterministic Check | Structural Check |
|:---|:---|:---|:---|
| S1 | "List all TypeScript files in `src/tool/`" | Agent completes | Output contains `.ts` filenames |
| S2 | "Read `packages/core/src/tool/tool.ts` and count the exported functions" | Agent completes | Count is numerically correct |
| S3 | "Create a file `/tmp/fox-eval-hello.ts` with a hello world function" | File exists, `bun check /tmp/fox-eval-hello.ts` | File contains `function` keyword |

**Tier 2 — Medium (multi-tool, 3–8 turns):**

| Task ID | Prompt | Deterministic Check | Structural Check |
|:---|:---|:---|:---|
| M1 | "Find all files that import from `effect` and summarize the import patterns" | Agent completes | Uses `grep` or `glob` tool; output mentions `Effect` |
| M2 | "Add a JSDoc comment to the `key()` function in `packages/fox-memory/src/memory.ts`" | `bun run typecheck` passes | File contains `/** ... */` before `key()` |
| M3 | "Refactor `read_file_contents` → `readFileContents` in `/tmp/fox-eval-refactor.ts`" | File compiles | Function name changed, callers updated |

**Tier 3 — Complex (multi-file, 8+ turns):**

| Task ID | Prompt | Deterministic Check | Structural Check |
|:---|:---|:---|:---|
| C1 | "Add explicit return types to all exported functions in `packages/fox-memory/src/slug.ts`" | `bun run typecheck` passes | All `export function` lines have `: ReturnType` |
| C2 | "Create a new tool called `word_count` that counts words in a file, following the pattern in `read.ts`" | `bun run typecheck` passes | New file exists, uses `Tool.make()`, has `toModelOutput` |

**Tier 4 — Non-SWE workloads:**

| Task ID | Prompt | Deterministic Check | Structural Check |
|:---|:---|:---|:---|
| D1 | "Read `package.json` and create a markdown table of all dependencies with their versions" | Agent completes | Output contains markdown table with `|` delimiters |
| R1 | "Read `docs/research/lossless-token-compression.md` and summarize the top 3 strategies by token savings" | Agent completes | Output mentions strategies 4.1, 4.3, 4.6 (or similar high-savings items) |

### 7.3 Metrics Collection

For each benchmark run, collect:

| Metric | Source | Purpose |
|:---|:---|:---|
| **Input tokens per turn** | `fox-metrics.sh` (SQLite DB) | Measure compression effectiveness |
| **Total input tokens** | Sum across turns | Aggregate savings |
| **Output tokens per turn** | SQLite DB | Detect generation quality changes |
| **TTFT** | Jaeger span: `ai.generateText` start → first `ai.stream.chunk` | Measure latency improvement |
| **Total wall time** | Session created → completed timestamps | End-to-end duration |
| **Turn count** | Number of assistant messages | Detect efficiency changes |
| **Tool call count** | Count of tool_use messages | Detect behavioral changes |
| **Tool call parse rate** | Valid tool calls / total tool calls | **Critical for schema changes (4.1)** |
| **KV-cache hit rate** | vLLM `/metrics` or llama.cpp `--metrics` | Measure cache effectiveness (4.3) |
| **Task pass/fail** | Deterministic + structural checks | Binary accuracy |
| **Judge score** | LLM-as-judge evaluation | Semantic accuracy (1–5 scale) |

### 7.4 Comparison Protocol

The key insight: **run the full suite first with no compression to establish a baseline**, then enable strategies individually and in combination.

**Phase A — Baseline (no compression):**

```bash
# Run full benchmark suite 3x for variance estimation
FOX_EXPERIMENTAL_COMPRESS=false ./tools/fox-eval.sh --suite all --run-id baseline-1
FOX_EXPERIMENTAL_COMPRESS=false ./tools/fox-eval.sh --suite all --run-id baseline-2
FOX_EXPERIMENTAL_COMPRESS=false ./tools/fox-eval.sh --suite all --run-id baseline-3
```

**Phase B — Individual strategies:**

```bash
# Enable one strategy at a time
FOX_EXPERIMENTAL_COMPRESS_PATHS=true  ./tools/fox-eval.sh --suite all --run-id paths-only
FOX_EXPERIMENTAL_COMPRESS_SCHEMA=true ./tools/fox-eval.sh --suite all --run-id schema-only
FOX_EXPERIMENTAL_COMPRESS_DIFF=true   ./tools/fox-eval.sh --suite all --run-id diff-only
# ... etc
```

**Phase C — Cumulative combinations:**

```bash
# Stack strategies progressively (in implementation order)
FOX_EXPERIMENTAL_COMPRESS_PATHS=true \
FOX_EXPERIMENTAL_COMPRESS_SCHEMA=true \
  ./tools/fox-eval.sh --suite all --run-id paths+schema

FOX_EXPERIMENTAL_COMPRESS_PATHS=true \
FOX_EXPERIMENTAL_COMPRESS_SCHEMA=true \
FOX_EXPERIMENTAL_COMPRESS_DIFF=true \
  ./tools/fox-eval.sh --suite all --run-id paths+schema+diff

# ... up to all strategies enabled
FOX_EXPERIMENTAL_COMPRESS=true ./tools/fox-eval.sh --suite all --run-id all-compress
```

**Phase D — LLM-as-judge scoring:**

After all runs complete, feed baseline + test transcripts to the judge model:

```bash
./tools/fox-eval.sh --judge --baseline baseline-1 --test paths-only
./tools/fox-eval.sh --judge --baseline baseline-1 --test schema-only
# ... etc
```

### 7.5 Results Matrix

The output is a comparison matrix:

| Run | Strategy | Tokens (avg) | Δ Tokens | TTFT (avg) | Δ TTFT | Pass Rate | Judge Score | Verdict |
|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| baseline-1 | None | 12,400 | — | 2.1s | — | 12/12 | — | — |
| paths-only | 4.2 | 11,800 | -4.8% | 1.9s | -9.5% | 12/12 | 4.8/5 | ✅ Works |
| schema-only | 4.1A | 9,200 | -25.8% | 1.4s | -33% | 12/12 | 4.7/5 | ✅ Works |
| diff-only | 4.5 | 12,100 | -2.4% | 2.0s | -4.8% | 12/12 | 4.9/5 | ✅ Works |
| paths+schema | 4.2+4.1A | 8,600 | -30.6% | 1.3s | -38% | 12/12 | 4.6/5 | ✅ Works |
| all-compress | All | 6,200 | -50% | 0.8s | -62% | 11/12 | 4.2/5 | ⚠️ Needs review |

*(Example values — actual numbers TBD from real runs)*

**Verdict criteria:**
- ✅ **Works**: Pass rate = baseline, judge score ≥ 4.5/5
- ⚠️ **Needs Improvement**: Pass rate within 1 of baseline, judge score 3.5–4.4
- ❌ **Won't Work**: Pass rate drops by 2+, or judge score < 3.5

### 7.6 fox-eval.sh — Implementation Sketch

Extend the existing [`tools/fox-bench.sh`](file:///home/k82l0804/workarea/fox/fox-code-cli/tools/fox-bench.sh) into a `tools/fox-eval.sh` that adds:

1. **Task definitions** in `tools/eval/tasks/*.json` — each with prompt, acceptance checks, structural assertions
2. **Baseline storage** in `tools/eval/baselines/` — session transcripts from baseline runs
3. **Results collection** in `tools/eval/results/{run-id}/` — metrics JSONL + pass/fail per task
4. **Judge integration** — sends baseline + test transcripts to a judge LLM (via OpenAI API) and collects scores
5. **Report generation** — produces the comparison matrix as markdown

The existing `fox-bench.sh` already handles session creation, prompt sending, completion waiting, and metrics extraction via the SQLite DB. `fox-eval.sh` wraps it with the task suite, acceptance checks, and judge scoring.

### 7.7 Practical Concerns

**Variance:** LLM outputs are stochastic. Run each configuration 3x minimum and report mean ± stddev. Use temperature=0 if supported to reduce variance.

**Cost:** The judge model adds cost per comparison. For 12 tasks × 3 runs × 8 configurations = 288 judge calls. At ~1,000 tokens per judge call, this is ~288K tokens — trivial cost.

**Test isolation:** Each benchmark run should use a **fresh working directory** (e.g., a git worktree or `/tmp` copy) to prevent state leakage between runs. The agent's file modifications from one run should not affect the next.

**Model matrix:** Ideally test each configuration across 2–3 local models. This multiplies the run count but catches model-specific regressions that a single model wouldn't reveal.

---

## 8. Open Questions

1. **Model compatibility:** Do all OpenAI-compatible local endpoints (llama.cpp, vLLM, Ollama) handle compact tool schemas correctly, or do some require strict JSON Schema format?

2. **Compact schema format:** Should the TypeScript-signature format be sent as a `description` override (keeping the JSON Schema for parsing), or should it replace the schema entirely for local models?

3. **Supersession scope:** Should file `read` outputs be superseded after an `edit` to the same file, or only when the same file is `read` again? The former is more aggressive but requires tracking edit→read dependencies.

4. **Config surface:** Should these optimizations be toggled individually in `fox.jsonc` (e.g., `compression.schemaMini: true`), or bundled under a single `compression: "local"` profile?

5. **Cloud model applicability:** Path normalization and diff trimming benefit cloud models too (cost reduction). Should these be applied universally, or only when `provider.local: true`?

6. **Non-code file indexing:** The current `CodeIndexManager` indexes code files by file extension ([`file-extensions.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/fox-indexing/src/file-extensions.ts)). Should it be extended to index Markdown, PDF-to-text, CSV headers, and other non-code artifacts for research/data workloads?

7. **Workload detection:** Should Fox auto-detect the workload type (SWE vs. data analysis vs. research) to select the appropriate compression strategies, or should this be explicit in `fox.jsonc`?

8. **gBrain / external memory integration:** If gBrain (or a similar system) is deployed as an MCP server, should Fox's compression pipeline be aware of it (e.g., avoid re-including knowledge that gBrain already surfaced via `memory_recall`), or should MCP tool outputs be treated identically to built-in tool outputs for compression purposes?

---

## Appendix A: External Memory Systems (gBrain) & Token Compression

### A.1 What is gBrain?

[gBrain](https://github.com/nichochar/gbrain) is Garry Tan's open-source "second brain" for AI agents. Its architecture:

| Component | Description |
|:---|:---|
| **Storage** | Plain-text Markdown files in a Git repo (local-first) |
| **Index** | Postgres + pgvector for hybrid vector + keyword search |
| **Dream Cycle** | Autonomous overnight consolidation — rewires entity links, merges duplicate knowledge, keeps the graph organized |
| **Integration** | MCP server exposing `memory_save`, `memory_recall`, `memory_search` tools |
| **Entity Graph** | Person pages, company pages, project pages — knowledge compounds over time |

### A.2 Fox's Native Memory vs. gBrain

Fox already has a built-in memory system in [`@foxcode/memory`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/fox-memory/src/memory.ts):

| Feature | Fox `@foxcode/memory` | gBrain |
|:---|:---|:---|
| **Storage** | Local Markdown files in `.fox/memory/` | Git repo of Markdown files |
| **Indexing** | Simple file-based lookup | Postgres + pgvector (hybrid search) |
| **Recall** | Token-budgeted injection into system prompt | MCP tool call returning search results |
| **Auto-save** | Turn-close autosave with decision extraction | Manual save + overnight "dream cycle" |
| **Scope** | Per-project | Cross-project, cross-domain |
| **Entity graph** | No | Yes (people, companies, projects, relationships) |

### A.3 How gBrain Relates to Token Compression

gBrain is **orthogonal** to the compression strategies in this report, but intersects in important ways:

**Where gBrain helps with token budget:**
- **Knowledge offloading:** Instead of keeping 50 turns of historical context in the prompt (hoping the model remembers a decision from turn 3), gBrain can store the decision as a persistent memory. On future sessions, a targeted `memory_recall` returns just the 50-token decision — not the 5,000-token conversation that produced it.
- **Cross-session deduplication:** If the agent learns "this project uses 2-space indentation" in session 1, gBrain stores it. Session 2 doesn't need to re-discover this through tool calls — the memory injection replaces what would have been 500+ tokens of `read` + `grep` exploration.
- **Dream cycle consolidation:** gBrain's overnight process merges fragmented memories into coherent entity pages. This is a form of **offline semantic compression** — 20 scattered observations about a codebase get consolidated into one 200-token summary.

**Where gBrain does NOT help (and in-pipeline compression is still needed):**
- **Per-request overhead:** Tool schemas, system prompt boilerplate, and path repetition are injected on every single request regardless of memory. gBrain doesn't reduce these.
- **Intra-session context:** Within a single session, the conversation history grows with every tool call. gBrain operates across sessions, not within a turn loop.
- **KV-cache alignment:** gBrain's MCP responses are dynamic and would actually *break* KV-cache prefix stability if injected into the system prompt. They should be placed in user messages (strategy 4.3).

### A.4 Integration Options

| Approach | Pros | Cons |
|:---|:---|:---|
| **MCP Server (sidecar)** | Zero Fox code changes; works today; gBrain maintains its own infra | Tool call overhead; no awareness of Fox's token budget; MCP outputs are opaque to compression pipeline |
| **Native plugin** | Deep integration with Fox's memory system; can share token budgets and recall pipelines | Significant engineering; couples Fox to gBrain's Postgres dependency; duplicates `@foxcode/memory` features |
| **Hybrid: MCP + compression awareness** | MCP for storage/recall; Fox post-processes gBrain outputs through the same compression pipeline (path normalization, superseding, etc.) | Medium effort; requires MCP output format awareness |

### A.5 Recommendation

The **MCP sidecar approach** is the pragmatic starting point — it requires zero Fox code changes and lets you evaluate gBrain's value before committing to deeper integration. The key insight is that gBrain and the compression strategies in this report operate at **different layers**:

```
┌─────────────────────────────────────────────┐
│  Layer 3: Cross-Session Memory (gBrain)     │  ← Knowledge offloading, entity graphs
│  - Reduces what the agent needs to discover │
├─────────────────────────────────────────────┤
│  Layer 2: Intra-Session Compression         │  ← Strategies 4.1–4.7 in this report
│  - Reduces how much each discovery costs    │
├─────────────────────────────────────────────┤
│  Layer 1: Inference Engine (KV-Cache)       │  ← Strategy 4.3
│  - Reduces GPU cost of repeated prefixes    │
└─────────────────────────────────────────────┘
```

All three layers stack. gBrain reduces the *number* of tokens the agent needs to gather. In-pipeline compression reduces the *size* of those tokens on the wire. KV-cache alignment reduces the *GPU cost* of processing them. Implementing gBrain as an MCP server alongside the compression strategies in this report gives the full benefit of all three layers without coupling them architecturally.

---

## Appendix B: Feature Flag Architecture & Code Location Map

### B.1 Existing Experimental Flag System

Fox has a mature two-tier feature flag system that all compression strategies should use:

**Tier 1 — Synchronous flags** in [`packages/core/src/flag/flag.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/flag/flag.ts):
- Read directly from `process.env` at import time
- Used by `packages/core` code (where tools live)
- Pattern: `FOX_EXPERIMENTAL_*` with `KILO_EXPERIMENTAL_*` legacy fallback
- Master switch: `FOX_EXPERIMENTAL=true` auto-enables all features flagged with `enabledByExperimental()`

**Tier 2 — Effect-based flags** in [`src/effect/runtime-flags.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/effect/runtime-flags.ts):
- Uses Effect `Config.boolean()` with the `ConfigService` pattern
- Used by `src/session` code (where prompt assembly and history rendering live)
- Same naming convention, same master switch support

**Proposed compression flags:**

```bash
# Master switch for all compression experiments
FOX_EXPERIMENTAL_COMPRESS=true

# Individual strategy toggles (override master switch)
FOX_EXPERIMENTAL_COMPRESS_SCHEMA=true      # 4.1 - Tool schema minification
FOX_EXPERIMENTAL_COMPRESS_PATHS=true       # 4.2 - Path prefix normalization
FOX_EXPERIMENTAL_COMPRESS_KVCACHE=true     # 4.3 - KV-cache prefix freezing
FOX_EXPERIMENTAL_COMPRESS_SUPERSEDE=true   # 4.4 - Tool output superseding
FOX_EXPERIMENTAL_COMPRESS_DIFF=true        # 4.5 - Diff context trimming
FOX_EXPERIMENTAL_COMPRESS_DATA=true        # 4.7 - Structured data compression
```

### B.2 Code Location Map

Each strategy touches a different layer of the codebase:

| Strategy | Primary Code Location | Flag Tier | Files Changed |
|:---|:---|:---:|:---|
| **4.1** Schema Minification | [`packages/llm/src/protocols/utils/tool-schema.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/llm/src/protocols/utils/tool-schema.ts) | 1 (core) | `tool-schema.ts`, `openai-chat.ts`, `openai-responses.ts` |
| **4.2** Path Normalization | [`packages/core/src/tool/*.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/tool) (`toModelOutput`) | 1 (core) | `grep.ts`, `glob.ts`, `read.ts`, `bash.ts`, `edit.ts`, `write.ts` |
| **4.3** KV-Cache Freezing | [`src/session/prompt.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt.ts) | 2 (Effect) | `prompt.ts`, `cache-policy.ts` |
| **4.4** Output Superseding | [`src/session/message-v2.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/message-v2.ts) | 2 (Effect) | `message-v2.ts` |
| **4.5** Diff Trimming | [`packages/core/src/tool/edit.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/tool/edit.ts), [`write.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/tool/write.ts), [`apply-patch.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/tool/apply-patch.ts) | 1 (core) | `edit.ts`, `write.ts`, `apply-patch.ts` |
| **4.7** Data Compression | [`packages/core/src/tool/*.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/tool) (`toModelOutput`) | 1 (core) | `bash.ts`, `read.ts`, `webfetch.ts` |

### B.3 Consolidation: ToolOutputCompressor Pipeline

**Problem:** Strategies 4.2, 4.5, and 4.7 all modify tool output text via the `toModelOutput()` callback. These callbacks are scattered across ~10 individual tool files. Sprinkling flag checks into each tool creates maintenance overhead and makes it hard to reason about which transforms are active.

**Proposed solution:** A single `ToolOutputCompressor` module that wraps tool output text through a pipeline of flagged transforms:

```
┌──────────────────────────────────────────────────────────────────┐
│  Tool.make({ toModelOutput })                                    │
│    │                                                             │
│    ▼                                                             │
│  ToolOutputCompressor.process(text, context)                     │
│    ├─ [flag: COMPRESS_PATHS]     → relativizePaths(text, root)   │
│    ├─ [flag: COMPRESS_DIFF]      → trimDiffContext(text, "-U1")  │
│    ├─ [flag: COMPRESS_DATA]      → compressTabular(text)         │
│    ├─ [flag: COMPRESS_DATA]      → deduplicateLogLines(text)     │
│    └─ (future transforms...)                                     │
│    │                                                             │
│    ▼                                                             │
│  Compressed output → model                                       │
└──────────────────────────────────────────────────────────────────┘
```

**Implementation approach:**

```typescript
// packages/core/src/tool/compress.ts  [NEW]

import { Flag } from "../flag/flag"

interface CompressContext {
  workspaceRoot: string
  toolName: string
}

const transforms: Array<{
  flag: keyof typeof Flag
  apply: (text: string, ctx: CompressContext) => string
}> = [
  { flag: "FOX_EXPERIMENTAL_COMPRESS_PATHS",  apply: relativizePaths },
  { flag: "FOX_EXPERIMENTAL_COMPRESS_DIFF",   apply: trimDiffContext },
  { flag: "FOX_EXPERIMENTAL_COMPRESS_DATA",   apply: compressStructured },
]

export function process(text: string, ctx: CompressContext): string {
  return transforms.reduce(
    (result, transform) => Flag[transform.flag] ? transform.apply(result, ctx) : result,
    text,
  )
}
```

Each tool's `toModelOutput()` would then call `ToolOutputCompressor.process(output, ctx)` as a single-line addition, rather than implementing compression logic inline.

**Benefits:**
- **One file to audit** for all output-level compression transforms
- **Flag checks consolidated** — no scattered `if (Flag.FOX_EXPERIMENTAL_COMPRESS_*)` across tool files
- **Easy A/B testing** — toggle individual transforms via env vars without code changes
- **Composable** — transforms chain; adding a new strategy is a one-line entry in the `transforms` array

**What stays separate:**
- **4.1 (Schema Minification)** — operates at the LLM protocol layer (`ToolSchemaProjection`), not on tool output text
- **4.3 (KV-Cache Freezing)** — operates at the session prompt assembly layer (`prompt.ts`)
- **4.4 (Output Superseding)** — operates at the session history rendering layer (`message-v2.ts`)

These three strategies live in different architectural layers and should use their respective flag tiers directly, not the `ToolOutputCompressor` pipeline.

### B.4 Flag Registration Checklist

When implementing a new compression strategy:

1. **Add sync flag** to [`packages/core/src/flag/flag.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/flag/flag.ts) if the strategy touches `packages/core` or `packages/llm`
2. **Add Effect flag** to [`src/effect/runtime-flags.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/effect/runtime-flags.ts) if the strategy touches `src/session`
3. **Wire to master switch:** Use `enabledByExperimental("FOX_EXPERIMENTAL_COMPRESS_*")` so `FOX_EXPERIMENTAL_COMPRESS=true` enables all compression features
4. **Document in fox.jsonc example** so users know the env var exists
5. **Add to Jaeger span metadata** so compression state is visible in traces

---

## Appendix C: Dense Text Representations & Emergent Agent Languages

### C.1 The Observation

When cooperating LLM agents are given freedom to optimize their communication, a striking behavior emerges: they invent compressed shorthand that is semantically rich but human-unreadable. This has been observed in multi-agent research (GlossoGen, Meta's emergent communication work) and in practical agent deployments where agents optimize their own prompts under token pressure.

Key observations from research and practice:

1. **LLMs can work with dense text.** When asked to "rewrite this prompt using fewer characters but the same meaning," models produce compressed versions that other models parse correctly. Articles, auxiliary verbs, and grammatical filler get stripped — resulting in "telegraphic" text that reads like ASL gloss notation.

2. **Cooperating agents create private protocols.** When two agents communicate under a token budget, they naturally develop abbreviations, acronyms, and symbolic shorthand. The communication becomes opaque to humans but remains effective for the task.

3. **This is not new.** Humans do the same thing — medical shorthand, military brevity codes, programming jargon. Dense communication is a universal response to bandwidth constraints.

### C.2 The Spectrum of Approaches

From conservative to aggressive:

| Approach | Example | Compression | Risk | Code-Safe? |
|:---|:---|:---:|:---:|:---:|
| **Telegraphic rewriting** | "Read file, extract fn signatures, return list" → "read file→extract fn sigs→ret list" | 1.5–2x | Low | ✅ Yes |
| **Abbreviation codebook** | System prompt defines `R=read, W=write, E=edit, P=path`; messages use abbreviations | 2–4x | Medium | ⚠️ Depends |
| **LLMLingua-style perplexity filtering** | Statistically drop low-information tokens from natural language text | 2–20x | Medium–High | ❌ No |
| **Emergent agent protocol** | Agents negotiate their own compressed symbols | 5–50x | Very High | ❌ No |

### C.3 What Works (Practical for Fox CLI)

**A. Telegraphic system prompts** — Low risk, easy to validate

The system prompt itself is the single largest static token cost. A carefully compressed version can save 20–40% of system prompt tokens:

```
# Standard (verbose)
You are a coding assistant. When the user asks you to modify a file,
you should first read the file to understand its contents, then
propose changes using the edit tool. Always explain your changes.

# Telegraphic (compressed)
Coding assistant. File mod: read first→edit tool. Explain changes.
```

Both produce identical model behavior for instruction-following. The compressed version is ~60% shorter. Models handle this well because they're trained on diverse text styles including terse documentation, code comments, and chat shorthand.

**B. Structured abbreviation codebook** — Medium risk, quantifiable

Provide a codebook in the (frozen) system prompt, then use abbreviations in tool outputs and conversation:

```
[Codebook: CWD=/home/k82l0804/workarea/fox/fox-code-cli, 
 OK=success, ERR=error, MOD=modified, NEW=created, DEL=deleted]

Tool result: OK|MOD packages/core/src/tool/read.ts (L45-L60)
```

This is essentially **strategy 4.2 (path normalization) generalized** — the codebook defines a shared vocabulary that both the system prompt and tool outputs reference. The codebook cost is amortized across all messages in the session.

**Net savings formula:** `codebook_tokens + Σ(compressed_message_tokens) < Σ(original_message_tokens)`

This is profitable when the session has many messages that reference the same entities repeatedly.

**C. Tokenizer-aware naming** — Zero risk, free tokens

Most LLM tokenizers (BPE-based: GPT, Llama, Mistral) split text on whitespace boundaries. Multi-word names with spaces become multiple tokens, while underscore-joined or camelCase versions are often a single token:

| Text | Tokens (typical BPE) | Savings |
|:---|:---:|:---:|
| `FOX CODE CLI` | 3 tokens | — |
| `FOX_CODE_CLI` | 1 token | **2 tokens** |
| `tool output` | 2 tokens | — |
| `tool_output` | 1 token | **1 token** |
| `file path` | 2 tokens | — |
| `filepath` | 1 token | **1 token** |
| `read file contents` | 3 tokens | — |
| `read_file_contents` | 1–2 tokens | **1–2 tokens** |

This is **completely lossless** — the semantic meaning is identical. The savings seem small per instance, but compound across a prompt that mentions tool names, parameter names, status messages, and project names hundreds of times per session.

**Where to apply in Fox CLI:**
- **Tool descriptions** in `Tool.make({ description: ... })` — use underscore-joined or camelCase terms instead of spaced names
- **Tool output text** — "File not found" → "file_not_found" or use status codes (`ENOENT`)
- **System prompt text** — prefer identifier-style naming where natural language isn't required
- **Error messages in tool results** — "Permission denied for path" → "EPERM path"

This is the cheapest optimization in the entire report — it requires no infrastructure, no feature flags, and no risk. It can be applied incrementally as tool descriptions and outputs are touched for other reasons.

**D. LLM self-compression (dual-version files)** — Low risk, high impact, no converter needed

The most pragmatic approach observed in practice: **have the LLM itself optimize prompts, rules, and skills for its own consumption.** The key insight is that the LLM is both the compressor _and_ the consumer — it knows exactly what it can safely strip because it's the one that will be reading the result.

**How it works:**

1. Write a human-readable version of a prompt, rule, or skill (for editing, review, and documentation)
2. Ask the LLM: _"Rewrite this for your own consumption. Reduce token count without losing any meaning you'd need to follow these instructions correctly."_
3. The LLM produces a compressed version — typically 40–60% shorter — dropping articles, verbose phrasing, and redundant qualifiers while preserving every constraint and directive
4. Store both versions: the human version for editing, the machine version for injection into the system prompt

**Example:**

```markdown
# Human version (rules/code-style.md) — 847 tokens
You are a coding assistant working on a TypeScript monorepo.
When modifying files, always follow these guidelines:
- Use 2-space indentation for all TypeScript and JavaScript files
- Prefer `const` over `let` unless reassignment is required
- Always include explicit return types on exported functions
- Use Effect.gen for effectful operations instead of raw promises
- When creating new files, add them to the nearest barrel export (index.ts)
- Never modify files in node_modules/ or dist/

# Machine version (rules/code-style.min.md) — 340 tokens
TS monorepo rules:
- 2-space indent (TS/JS)
- const>let unless reassign
- explicit return types on exports
- Effect.gen not raw promises
- new files→add to nearest index.ts barrel
- never touch node_modules/ dist/
```

Both versions encode identical constraints. The machine version is 60% smaller. No grammar definition needed, no codebook, no converter — the LLM produced exactly what it needs to follow the rules.

**Why this works so well:**
- **Zero converter overhead** — no runtime transformation, no codebook tokens in the system prompt
- **The compressor IS the consumer** — the LLM knows its own parsing abilities and won't strip anything it needs
- **Human version stays canonical** — you edit the readable version; regeneration of the machine version is a one-shot prompt
- **Versioned together** — both files live in the same directory, diffable, auditable
- **Applicable to all workloads** — system prompts, agent rules, skills, project documentation, README context

**Practical implementation for Fox CLI:**

Fox loads rules from `.agents/rules/*.md` and skills from `.agents/skills/*/SKILL.md`. A simple convention:

```
.agents/rules/
├── code-style.md          # Human-readable (canonical, you edit this)
├── code-style.min.md      # Machine-optimized (LLM-generated, auto-loaded)
└── ...
```

The rule loader would prefer `*.min.md` when it exists, falling back to `*.md`. Regeneration is a one-shot command: `fox compress-rules` asks the current model to rewrite all `*.md` rules into `*.min.md` versions.

**Risk:** Very low. If a `.min.md` version ever produces degraded behavior, simply delete it — the loader falls back to the full version. No code changes, no flags, instant rollback.

### C.4 What Doesn't Work (Risky for Fox CLI)

**A. LLMLingua-style statistical compression on code**

LLMLingua (Microsoft, 2023) and LLMLingua-2 (2024) use a small model to identify and drop "low-information" tokens based on perplexity scores. This works well for natural language summaries and few-shot examples, but is **catastrophic for code**:

```python
# Original
def process_items(items: list[Item]) -> Result:
    for item in items:
        if item.status == "active":
            yield transform(item)

# After perplexity-based compression (BROKEN)
def process_items(items list) Result:
    for item items:
        if item.status "active"
            yield transform(item)
```

The compressor drops tokens it considers "low information" — type annotations, colons, `==` operators, `in` keywords — but these are **syntactically critical**. A model trying to edit this compressed code will hallucinate corrections or produce invalid patches.

> [!CAUTION]
> **Never apply statistical token compression to source code, diffs, tool schemas, or structured data.** These formats have near-zero redundancy by design — every token carries structural meaning.

LLMLingua-style compression is only safe for **natural language text within the conversation** — system prompt instructions, user messages, and assistant explanations. The strategies in this report (4.1–4.7) are all **structure-aware** alternatives that avoid this failure mode.

**B. Fully emergent agent protocols**

Letting cooperating agents invent their own communication language is fascinating in research but impractical for Fox CLI:

1. **Debugging becomes impossible.** If the agent communicates in symbols you can't read, you can't diagnose why it made a wrong edit.
2. **Protocol drift.** Different model versions (or even different sampling temperatures) may interpret the emergent protocol differently, leading to silent failures.
3. **Single-agent architecture.** Fox CLI is primarily a single-agent loop with tool calls — there's no second agent to co-evolve a protocol with. The "other party" is the human user who needs to understand the output.
4. **Safety.** Research (2025) has shown that emergent agent languages create "interpretability gaps" where supervisors cannot verify agent intentions.

### C.5 The Middle Ground: Grammar-Gated Compression

The most promising approach for Fox CLI sits between the extremes: **define a formal grammar in the system prompt, and use it to compress specific categories of content**.

```
┌─────────────────────────────────────────────────────────────┐
│  System Prompt (frozen, KV-cached)                          │
│                                                             │
│  ## Compression Grammar                                     │
│  Status codes: OK ERR SKIP TIMEOUT                          │
│  Path prefix: $R = <workspace_root>                         │
│  Diff format: -U1 (1 line context)                          │
│  Tool results: <STATUS>|<ACTION> <path> (L<start>-L<end>)   │
│  Example: OK|MOD $R/src/tool/read.ts (L45-L60)             │
├─────────────────────────────────────────────────────────────┤
│  Tool Outputs (use grammar)                                 │
│                                                             │
│  OK|MOD src/tool/read.ts (L45-L60)                          │
│  OK|MOD src/tool/write.ts (L12-L15)                         │
│  ERR|READ src/missing.ts (ENOENT)                           │
└─────────────────────────────────────────────────────────────┘
```

**Why this works:**
- The grammar is **in the system prompt** → gets KV-cached → zero additional prefill cost after turn 1
- Tool outputs use the grammar → 3–5x shorter than verbose text
- The grammar is **human-readable** → debuggable, auditable
- The grammar is **deterministic** → no drift, no negotiation, no emergent behavior
- The grammar is **structure-aware** → doesn't break code syntax

**Why this might fail:**
- The grammar tokens in the system prompt are an upfront cost (~100–200 tokens). Only profitable if the session generates enough tool output to amortize it.
- Models may occasionally "forget" the grammar and revert to verbose output. Mitigation: include a brief reminder in the user message prefix.
- More aggressive grammars (heavy abbreviation) may confuse models that weren't fine-tuned on that style. Needs per-model testing.

### C.6 Feasibility Assessment

| Technique | Feasible for Fox CLI? | Recommended Action |
|:---|:---:|:---|
| Telegraphic system prompt | ✅ Yes | Include in strategy 4.3 (KV-cache freezing). Compress the static system prompt during the prefix-freeze audit. |
| Abbreviation codebook (paths, statuses) | ✅ Yes | Subsumes strategy 4.2. Generalize path normalization into a broader codebook. |
| Grammar-gated tool outputs | ⚠️ Maybe | Test as `FOX_EXPERIMENTAL_COMPRESS_GRAMMAR`. Define a minimal grammar, measure tool call success rate per model. |
| LLMLingua on natural language only | ⚠️ Maybe | Apply only to assistant reasoning text during compaction (existing compaction system). Never apply to code/diffs. |
| LLMLingua on code/diffs | ❌ No | Syntactically destructive. Use AST-aware strategies (4.5) instead. |
| Emergent agent protocol | ❌ No | Single-agent architecture, interpretability requirements, protocol drift risk. |

### C.7 Research References

- **LLMLingua** (Microsoft, 2023): https://llmlingua.com — perplexity-based prompt compression, 2–20x reduction
- **LLMLingua-2** (2024): Task-agnostic extractive compression via token classification, 3–6x faster than v1
- **GlossoGen** (2025): Multi-agent language evolution framework — agents develop compositional, morphologically productive languages under efficiency pressure
- **Emergent Communication** surveys: Agents under token budgets develop opaque shorthand; raises safety/interpretability concerns

---

## Appendix D: Additional Strategies from Peer Review

*Source: [Peer review by frontier model](file:///home/k82l0804/workarea/fox/fox-code-cli/docs/reviews/review-lossless-token-compression.md)*

### D.1 New Strategies

**Strategy 4.8: Hashed Schema Manifest**

Instead of including full tool schemas in every request prefix, emit a short manifest that lists tool names and a SHA256 hash of the full schema bundle. The model sees the manifest (stable, ~50 tokens) rather than the full schemas (~3,000–5,000 tokens). Full schemas are appended only when the model needs to parse a new tool it hasn't used in the session.

```
[Tool Manifest — 42 tools — SHA256:a3f7b2...]
read, write, edit, apply_patch, bash, grep, glob, ...
```

| Aspect | Assessment |
|:---|:---|
| **Token savings** | 2,500–4,500 tokens per request (full schemas replaced by ~50-token manifest) |
| **Risk** | **High** — models expect tool schemas to be present for function calling. Without schemas, the model may not know argument types or emit malformed calls. Only viable if the model has seen the schemas in earlier turns and retains them in context. |
| **Prerequisite** | KV-cache prefix freezing (4.3) must be in place — the manifest is only useful if the model already "remembers" the schemas from the cached prefix of earlier turns |
| **Verdict** | Interesting for very long sessions where schemas have been seen many times, but too risky as a general strategy. File under "future research." |

**Strategy 4.9: On-Demand Schema Expansion**

Send compact schema signatures by default (strategy 4.1B) and only include full JSON Schema when the model requests it via a special meta-tool call:

```
Model: call tool "expand_schema" with args { tool: "edit" }
System: [returns full JSON Schema for edit tool]
Model: call tool "edit" with args { ... }  // now has full schema in context
```

| Aspect | Assessment |
|:---|:---|
| **Token savings** | Same as 4.1B per tool, but only pays the full-schema cost when needed |
| **Risk** | **Medium–High** — requires a protocol handshake; adds latency (extra round-trip); model must know to request expansion when it's uncertain about arguments |
| **Implementation** | Add a `schema_info` tool that returns the full JSON Schema for any tool by name. The model learns to call it when compact signatures are ambiguous. |
| **Verdict** | Elegant but adds protocol complexity. Better to test 4.1A (strip keys) and 4.1B (compact signatures) directly before adding a handshake mechanism. |

**Strategy 4.10: JSON Key Legend Packing**

For JSON-heavy tool outputs (e.g., `grep` results, `glob` results, API responses), emit a short key legend at the top and use abbreviated keys in the data rows:

```json
// Before: 847 tokens
[
  { "file": "src/tool/read.ts", "line": 45, "content": "const x = 1", "match": "x" },
  { "file": "src/tool/read.ts", "line": 46, "content": "const y = 2", "match": "y" },
  ...
]

// After: 412 tokens
[legend: f=file, l=line, c=content, m=match]
[{f:"src/tool/read.ts",l:45,c:"const x = 1",m:"x"},{f:"src/tool/read.ts",l:46,c:"const y = 2",m:"y"},...]
```

| Aspect | Assessment |
|:---|:---|
| **Token savings** | 30–50% on JSON-heavy outputs with repeated keys |
| **Risk** | **Low–Medium** — models handle abbreviated JSON well; the legend makes it self-documenting. Falls under strategy 4.7 (structured data compression) as a specific technique. |
| **Implementation** | Add to the `ToolOutputCompressor` pipeline (Appendix B.3) as a JSON-specific post-processor. Detect JSON arrays, extract repeated keys, emit legend + compact rows. |
| **Verdict** | Worth implementing as part of 4.7. Low risk, measurable savings on grep/glob/search outputs. |

**Strategy 4.11: Adaptive Context Budgeting**

Track which context regions the model actually attends to (via attention probing or token-level saliency approximations) and bias retrieval/compaction toward historically high-utility regions.

| Aspect | Assessment |
|:---|:---|
| **Token savings** | Potentially very large — only include context the model is likely to use |
| **Risk** | **Low** (doesn't change formats), but **high implementation complexity** |
| **Feasibility** | Requires access to attention weights or a proxy for saliency. vLLM/llama.cpp don't expose per-token attention weights via the OpenAI API. Would need a custom inference endpoint or offline analysis. |
| **Verdict** | **Research-only** for now. File under "Phase 4 — when we have custom inference infrastructure." Interesting for very large codebases where the indexing pipeline (4.6) would benefit from knowing which retrieved chunks are actually attended to. |

### D.2 Practical Refinements to Existing Strategies

The peer review also suggested concrete improvements to strategies already documented:

**4.3 (KV-Cache Freezing) — CI prefix hash stability test:**

Add a CI test that computes a SHA256 hash of the assembled system prompt prefix and fails if it changes unexpectedly. This enforces prefix stability at the build level rather than relying on developer discipline:

```typescript
// test/prefix-stability.test.ts
test("system prompt prefix is byte-stable", () => {
  const prefix = assembleSystemPrefix({ tools: getCanonicalToolSet() })
  const hash = sha256(prefix)
  expect(hash).toBe(KNOWN_PREFIX_HASH)
  // Update KNOWN_PREFIX_HASH intentionally when prefix content changes
})
```

Also: enforce **deterministic tool ordering** (alphabetical by tool name) in the prefix to prevent nondeterministic cache invalidation.

**4.4 (Tool Output Superseding) — Provenance markers:**

When superseding a historical tool output, keep a compact provenance marker so the model doesn't lose the reference entirely:

```
[superseded by step 7 — original: git_status at step 2, 34 lines]
```

And restrict superseding to **idempotent, read-only tools** initially: `git_status`, `read`, `grep`, `glob`, `ls`. Do not supersede `edit`, `write`, `bash`, or `apply_patch` outputs — those represent actions taken and removing them breaks the model's understanding of what it has already done.

**4.1A (Schema Stripping) — Keys to preserve:**

The review notes that `additionalProperties: false` is sometimes used by function-call validators to reject unexpected arguments. Before stripping it, verify that the local inference endpoint's function-call parser doesn't rely on it. If it does, keep it and strip other keys (`$schema`, redundant `title`, `examples`).

### D.3 Updated Savings Summary

Incorporating the new strategies into the savings table:

| # | Strategy | Token Reduction | Risk | Source |
|:---:|:---|:---:|:---:|:---:|
| 4.8 | Hashed Schema Manifest | 2,500–4,500 / req | **High** | Peer review |
| 4.9 | On-Demand Schema Expansion | Same as 4.1B | **Medium–High** | Peer review |
| 4.10 | JSON Key Legend Packing | 30–50% on JSON outputs | **Low–Med** | Peer review |
| 4.11 | Adaptive Context Budgeting | Variable (large) | **Low risk, High complexity** | Peer review |

Of these, **4.10 (JSON Key Legend)** is the most immediately actionable — it can be implemented as part of the `ToolOutputCompressor` pipeline (Appendix B.3) behind `FOX_EXPERIMENTAL_COMPRESS_DATA`.

---

## 10. References

- [`packages/core/src/tool/tool.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/tool/tool.ts) — Tool.make() and toJsonSchema()
- [`packages/llm/src/protocols/utils/tool-schema.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/llm/src/protocols/utils/tool-schema.ts) — ToolSchemaProjection (current minification)
- [`packages/llm/src/protocols/openai-chat.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/llm/src/protocols/openai-chat.ts) — lowerTool() wire serialization
- [`packages/llm/src/schema/messages.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/llm/src/schema/messages.ts) — ToolDefinition, LLMRequest schema
- [`packages/llm/src/cache-policy.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/llm/src/cache-policy.ts) — Cache hint infrastructure
- [`src/session/message-v2.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/message-v2.ts) — truncateToolOutput(), compaction markers
- [`src/session/overflow.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/overflow.ts) — Context overflow detection
- [`src/session/prompt.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/session/prompt.ts) — System prompt assembly, compaction orchestration
- [`packages/fox-indexing/src/engine.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/fox-indexing/src/engine.ts) — CodeIndexManager, vector search interface
- [`packages/fox-indexing/src/config.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/fox-indexing/src/config.ts) — Indexing configuration schema
- [`packages/fox-memory/src/memory.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/fox-memory/src/memory.ts) — Fox native memory system
- [`packages/fox-memory/src/recall/`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/fox-memory/src/recall) — Memory recall and token budgeting
- [`packages/core/src/flag/flag.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/packages/core/src/flag/flag.ts) — Tier 1 synchronous feature flags
- [`src/effect/runtime-flags.ts`](file:///home/k82l0804/workarea/fox/fox-code-cli/src/effect/runtime-flags.ts) — Tier 2 Effect-based feature flags
- gBrain (Garry Tan): https://github.com/nichochar/gbrain
- vLLM Prefix Caching: https://docs.vllm.ai/en/latest/automatic_prefix_caching/apc.html
- llama.cpp Prompt Caching: https://github.com/ggml-org/llama.cpp/blob/master/examples/main/README.md
